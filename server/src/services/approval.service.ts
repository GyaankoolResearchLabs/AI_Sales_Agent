import { PermissionCategory, Prisma, Contact } from '@prisma/client';
import { getLevelAndPermission } from './autonomySettings.service';
import { writeAuditLog } from './audit.service';
import { decideNextAction } from '../ai/nextBestAction.service';
import { aiService } from '../ai/aiService';
import { resolveEmailExecutionProvider, resolveWhatsAppExecutionProvider } from '../integrations/executionProviders';
import { logger } from '../utils/logger';
import { prisma } from '../config/prisma';

export type ActionChannel = 'email' | 'whatsapp' | 'call' | 'meeting' | 'proposal' | 'task' | 'crm';
export type ApprovalWithRelations = Prisma.ApprovalGetPayload<true>;

/**
 * Maps a proposed action's channel to the AutonomySettings permission category that
 * gates it. There's no dedicated "calling" category in AutonomySettings, so phone
 * calls and generic CRM changes both fall under crmUpdates — documented here rather
 * than silently guessed at the call site.
 */
export const CHANNEL_TO_PERMISSION_CATEGORY: Record<ActionChannel, PermissionCategory> = {
  email: 'emailSending',
  whatsapp: 'whatsappSending',
  meeting: 'meetingScheduling',
  proposal: 'proposalCreation',
  task: 'taskCreation',
  call: 'crmUpdates',
  crm: 'crmUpdates',
};

interface CreateApprovalParams {
  organization: string;
  title: string;
  reason: string;
  dealId?: string;
  leadId?: string;
  contactId?: string;
  contentDraftId?: string;
  confidence: number;
  permissionCategory: PermissionCategory;
  dedupeKey: string;
}

interface CreateApprovalResult {
  approval: ApprovalWithRelations;
  autoExecuted: boolean;
  sendResult?: SendExecutionResult;
}

export interface SendExecutionResult {
  attempted: boolean;
  success?: boolean;
  provider?: string;
  environment?: 'production' | 'development';
  providerMessageId?: string;
  error?: string;
}

/**
 * Real send-execution for an approved email/whatsapp approval. Reuses the existing
 * Email/Message models as the "sent record" store (they already have exactly the
 * shape needed — provider, status, sentAt/error — rather than introducing a third,
 * overlapping "SentMessage" model). Never fakes success: the ContentDraft is only
 * marked "sent" if the provider actually reported success; on failure it stays
 * "approved" and the error is returned to the caller, not swallowed.
 */
export async function executeContentSend(approval: ApprovalWithRelations): Promise<SendExecutionResult> {
  if (approval.permissionCategory !== 'emailSending' && approval.permissionCategory !== 'whatsappSending') {
    return { attempted: false };
  }
  if (!approval.contentDraftId) return { attempted: false };

  const draft = await prisma.contentDraft.findUnique({ where: { id: approval.contentDraftId } });
  if (!draft) return { attempted: false };

  let contact: Contact | null = draft.contactId ? await prisma.contact.findUnique({ where: { id: draft.contactId } }) : null;
  if (!contact && approval.dealId) {
    const deal = await prisma.deal.findUnique({ where: { id: approval.dealId }, include: { primaryContact: true } });
    contact = deal?.primaryContact ?? null;
  }

  if (approval.permissionCategory === 'emailSending') {
    const content = draft.content as { subject?: string; body?: string };
    if (!contact?.email) {
      const error = 'No contact email on file for this deal — cannot send.';
      logger.warn('executeContentSend: email send skipped', { approvalId: approval.id, error });
      return { attempted: true, success: false, error };
    }

    let providerName = 'unknown';
    let providerEnvironment: 'production' | 'development' = 'development';
    let result: { success: boolean; providerMessageId?: string; error?: string };
    try {
      const provider = resolveEmailExecutionProvider();
      providerName = provider.name;
      providerEnvironment = provider.environment;
      result = await provider.send({ from: 'no-reply@yourcompany.com', to: contact.email, subject: content.subject ?? approval.title, body: content.body ?? '' });
    } catch (err) {
      // A throwing provider (construction failure, or send() itself rejecting) must not
      // crash the approve request — it's reported as a failed send, not swallowed.
      result = { success: false, error: (err as Error).message };
    }

    await prisma.email.create({
      data: {
        organizationId: approval.organizationId,
        dealId: approval.dealId,
        contactId: contact.id,
        from: 'no-reply@yourcompany.com',
        to: contact.email,
        subject: content.subject ?? approval.title,
        body: content.body ?? '',
        status: result.success ? 'sent' : 'failed',
        provider: providerName,
        generatedByAI: true,
        sentAt: result.success ? new Date() : undefined,
        error: result.error,
        createdById: draft.createdById,
      },
    });

    if (result.success) await prisma.contentDraft.update({ where: { id: draft.id }, data: { status: 'sent' } });

    return { attempted: true, success: result.success, provider: providerName, environment: providerEnvironment, providerMessageId: result.providerMessageId, error: result.error };
  }

  // whatsappSending
  const content = draft.content as { body?: string };
  if (!contact?.phone) {
    const error = 'No contact phone number on file for this deal — cannot send.';
    logger.warn('executeContentSend: whatsapp send skipped', { approvalId: approval.id, error });
    return { attempted: true, success: false, error };
  }

  let waProviderName = 'unknown';
  let waProviderEnvironment: 'production' | 'development' = 'development';
  let waResult: { success: boolean; providerMessageId?: string; error?: string };
  try {
    const provider = resolveWhatsAppExecutionProvider();
    waProviderName = provider.name;
    waProviderEnvironment = provider.environment;
    waResult = await provider.send({ fromNumber: 'org-number', toNumber: contact.phone, body: content.body ?? '' });
  } catch (err) {
    waResult = { success: false, error: (err as Error).message };
  }

  await prisma.message.create({
    data: {
      organizationId: approval.organizationId,
      dealId: approval.dealId,
      contactId: contact.id,
      direction: 'outbound',
      fromNumber: 'org-number',
      toNumber: contact.phone,
      body: content.body ?? '',
      status: waResult.success ? 'sent' : 'failed',
      provider: waProviderName,
      generatedByAI: true,
      createdById: draft.createdById,
    },
  });

  if (waResult.success) await prisma.contentDraft.update({ where: { id: draft.id }, data: { status: 'sent' } });

  return { attempted: true, success: waResult.success, provider: waProviderName, environment: waProviderEnvironment, providerMessageId: waResult.providerMessageId, error: waResult.error };
}

/**
 * Creates (or returns the existing pending) Approval for a dedupeKey, respecting the
 * organization's current AutonomySettings: at level 4 with that category "allowed", it
 * is approved immediately (auto-executed) — still logged. Otherwise it's created pending.
 */
export async function createApproval(params: CreateApprovalParams): Promise<CreateApprovalResult> {
  const existingPending = await prisma.approval.findFirst({ where: { organizationId: params.organization, dedupeKey: params.dedupeKey, status: 'pending' } });
  if (existingPending) return { approval: existingPending, autoExecuted: false };

  const { level, permission } = await getLevelAndPermission(params.organization, params.permissionCategory);
  const autoExecute = level === 4 && permission === 'allowed';

  const approval = await prisma.approval.create({
    data: {
      organizationId: params.organization,
      title: params.title,
      reason: params.reason,
      dealId: params.dealId,
      leadId: params.leadId,
      contactId: params.contactId,
      contentDraftId: params.contentDraftId,
      confidence: params.confidence,
      permissionCategory: params.permissionCategory,
      dedupeKey: params.dedupeKey,
      status: autoExecute ? 'approved' : 'pending',
      decidedAt: autoExecute ? new Date() : undefined,
      autoExecuted: autoExecute,
    },
  });

  let sendResult: SendExecutionResult | undefined;
  if (autoExecute && params.contentDraftId) {
    // Mark the draft "approved" before attempting the real send — it only becomes
    // "sent" if executeContentSend actually reports success.
    await prisma.contentDraft.update({ where: { id: params.contentDraftId }, data: { status: 'approved' } });
    sendResult = await executeContentSend(approval);
  }

  await writeAuditLog({
    organization: params.organization,
    actorType: autoExecute ? 'ai_agent' : 'system',
    action: autoExecute ? (sendResult?.success === false ? 'approval.auto_execution_failed' : 'approval.auto_executed') : 'approval.created',
    entityType: 'Approval',
    entityId: approval.id,
    approvalRequired: !autoExecute,
    metadata: { permissionCategory: params.permissionCategory, level, permission, sendResult },
  });

  return { approval, autoExecuted: autoExecute, sendResult };
}

/**
 * Wires real anomaly-detection findings to the approval flow: for a given at-risk deal,
 * decides the concrete next action from its live signals and proposes it as a real
 * Approval (not just an AIInsight), respecting the organization's autonomy settings.
 */
export async function proposeApprovalForAtRiskDeal(orgId: string, dealId: string): Promise<CreateApprovalResult | null> {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, organizationId: orgId },
    include: { company: { select: { name: true } }, primaryContact: { select: { id: true, name: true } } },
  });
  const aiScore = deal?.aiScore as { factors?: Array<{ key: string; contribution: number; weight: number }>; probability?: number; health?: string } | null;
  if (!deal || !aiScore) return null;

  const daysSinceActivity = deal.lastActivityAt ? Math.floor((Date.now() - deal.lastActivityAt.getTime()) / 86400000) : null;
  const dmFactor = aiScore.factors?.find((f) => f.key === 'decision_maker');
  const dmScore = dmFactor ? (dmFactor.contribution / dmFactor.weight) * 100 : 50;

  const next = decideNextAction(daysSinceActivity, aiScore.probability ?? deal.probability, dmScore, aiScore.health ?? 'unknown');
  const permissionCategory = CHANNEL_TO_PERMISSION_CATEGORY[next.channel];
  const dedupeKey = `${dealId}:${next.action}`;

  // Don't do any work (including generating content below) if a decision is already
  // outstanding for this exact proposal — mirrors createApproval's own dedup check, but
  // checked here too so we don't generate an orphan ContentDraft on every detection run.
  const existingPending = await prisma.approval.findFirst({ where: { organizationId: orgId, dedupeKey, status: 'pending' } });
  if (existingPending) return { approval: existingPending, autoExecuted: false };

  // When the proposed action is an email or WhatsApp send, prepare the actual content now
  // (Autonomy Level 3 — "Prepare") so the approval already carries something concrete to
  // review, rather than just a bare intent to act.
  let contentDraftId: string | undefined;
  if (next.channel === 'email' || next.channel === 'whatsapp') {
    const ctx = {
      dealName: deal.name,
      dealValue: deal.value,
      currency: deal.currency,
      companyName: deal.company?.name,
      contactName: deal.primaryContact?.name,
      reason: next.reason,
    };
    const content = next.channel === 'email' ? await aiService.generateEmail(ctx) : await aiService.generateWhatsApp(ctx);
    const draft = await prisma.contentDraft.create({
      data: {
        organizationId: orgId,
        type: next.channel,
        dealId,
        contactId: deal.primaryContact?.id,
        content,
        createdById: deal.ownerId,
      },
    });
    contentDraftId = draft.id;
  }

  return createApproval({
    organization: orgId,
    title: next.title,
    reason: next.reason,
    dealId,
    contentDraftId,
    confidence: next.confidence,
    permissionCategory,
    dedupeKey,
  });
}
