import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { getLevelAndPermission, getAutonomySettings, upsertAutonomySettings } from '../services/autonomySettings.service';
import { writeAuditLog } from '../services/audit.service';
import { notifyUser } from '../services/notification.service';
import { resolveEmailProvider, resolveWhatsAppProvider } from '../integrations/factory';
import { aiService } from '../ai/aiService';
import { recommendNextActionForDeal } from '../ai/nextBestAction.service';
import { prisma } from '../config/prisma';

const DEAL_INCLUDE = { company: { select: { name: true } }, primaryContact: true } as const;
const LIST_INCLUDE = { targetUser: { select: { id: true, name: true } }, deal: { select: { id: true, name: true, value: true } } } as const;

function toResponse(r: Prisma.AIRecommendationGetPayload<{ include: typeof LIST_INCLUDE }>) {
  return {
    _id: r.id,
    organization: r.organizationId,
    deal: r.deal ? { _id: r.deal.id, name: r.deal.name, value: r.deal.value } : undefined,
    lead: r.leadId ?? undefined,
    contact: r.contactId ?? undefined,
    targetUser: r.targetUser ? { _id: r.targetUser.id, name: r.targetUser.name } : undefined,
    action: r.action,
    channel: r.channel ?? undefined,
    title: r.title,
    reason: r.reason,
    priority: r.priority,
    confidence: r.confidence,
    generatedContent: r.generatedContent ?? undefined,
    permissionRequirement: r.permissionRequirement,
    status: r.status,
    approvedBy: r.approvedById ?? undefined,
    approvedAt: r.approvedAt ?? undefined,
    rejectedReason: r.rejectedReason ?? undefined,
    executedAt: r.executedAt ?? undefined,
    expiresAt: r.expiresAt ?? undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export const list = catchAsync(async (req: Request, res: Response) => {
  const where: Prisma.AIRecommendationWhereInput = { organizationId: req.user!.organizationId };
  if (req.query.status) where.status = req.query.status as never;
  else where.status = { in: ['pending', 'approved'] };
  if (req.user!.role === 'sales_rep') where.targetUserId = req.user!.id;

  const recs = await prisma.aIRecommendation.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100, include: LIST_INCLUDE });
  res.json({ success: true, data: recs.map(toResponse) });
});

export const generateForDeal = catchAsync(async (req: Request, res: Response) => {
  const deal = await prisma.deal.findFirst({ where: { id: req.body.dealId, organizationId: req.user!.organizationId } });
  if (!deal) throw AppError.notFound('Deal not found');
  const rec = await recommendNextActionForDeal(deal.id, req.user!.organizationId, deal.ownerId);
  res.status(201).json({ success: true, data: rec });
});

const CHANNEL_TO_ACTION: Record<string, string> = {
  email: 'send_email',
  whatsapp: 'send_whatsapp',
  call: 'make_call',
  meeting: 'schedule_meeting',
  proposal: 'send_proposal',
  task: 'create_task',
};

const CHANNEL_TO_PERMISSION_KEY: Record<string, string> = {
  email: 'emailSending',
  whatsapp: 'whatsappSending',
  meeting: 'meetingScheduling',
  proposal: 'proposalCreation',
  task: 'taskCreation',
  crm: 'crmUpdates',
};

/**
 * Creates a recommendation for a *specific* user-chosen channel/content
 * (e.g. from the "Prepare follow-up" composer), rather than letting the AI
 * pick the next best action. Still runs through the same permission gate
 * and approval/execute flow as an AI-initiated recommendation.
 */
export const createQuickRecommendation = catchAsync(async (req: Request, res: Response) => {
  const { dealId, channel, title, reason, subject, body } = req.body as {
    dealId: string;
    channel: 'email' | 'whatsapp' | 'call' | 'meeting' | 'proposal' | 'task';
    title: string;
    reason: string;
    subject?: string;
    body?: string;
  };
  const deal = await prisma.deal.findFirst({ where: { id: dealId, organizationId: req.user!.organizationId } });
  if (!deal) throw AppError.notFound('Deal not found');

  const permissionKey = (CHANNEL_TO_PERMISSION_KEY[channel] ?? 'crmUpdates') as Parameters<typeof getLevelAndPermission>[1];
  const { permission } = await getLevelAndPermission(req.user!.organizationId, permissionKey);

  const rec = await prisma.aIRecommendation.create({
    data: {
      organizationId: req.user!.organizationId,
      dealId,
      targetUserId: deal.ownerId,
      action: (CHANNEL_TO_ACTION[channel] ?? 'create_task') as never,
      channel: channel as never,
      title: title || `Send ${channel} to ${deal.name}`,
      reason: reason || 'Prepared from the deal workspace',
      priority: 'medium',
      confidence: 60,
      generatedContent: { subject, body },
      permissionRequirement: permission === 'allowed' ? 'allowed' : 'approval_required',
      status: 'pending',
      expiresAt: new Date(Date.now() + 7 * 86400000),
    },
    include: LIST_INCLUDE,
  });

  res.status(201).json({ success: true, data: toResponse(rec) });
});

async function ensureContentPrepared(rec: Prisma.AIRecommendationGetPayload<true>) {
  const generatedContent = rec.generatedContent as { subject?: string; body?: string } | null;
  if (generatedContent?.body) return rec;
  if (!rec.dealId) return rec;

  const deal = await prisma.deal.findUnique({ where: { id: rec.dealId }, include: DEAL_INCLUDE });
  if (!deal) return rec;

  const ctx = {
    dealName: deal.name,
    dealValue: deal.value,
    currency: deal.currency,
    companyName: deal.company?.name,
    contactName: deal.primaryContact?.name,
    reason: rec.reason,
  };

  let newContent: Prisma.InputJsonValue | undefined;
  if (rec.channel === 'email') {
    newContent = await aiService.generateEmail(ctx);
  } else if (rec.channel === 'whatsapp') {
    const content = await aiService.generateWhatsApp(ctx);
    newContent = { body: content.body };
  }
  if (!newContent) return rec;
  return prisma.aIRecommendation.update({ where: { id: rec.id }, data: { generatedContent: newContent } });
}

export const prepare = catchAsync(async (req: Request, res: Response) => {
  const rec = await prisma.aIRecommendation.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
  if (!rec) throw AppError.notFound('Recommendation not found');
  const prepared = await ensureContentPrepared(rec);
  const withInclude = await prisma.aIRecommendation.findUnique({ where: { id: prepared.id }, include: LIST_INCLUDE });
  res.json({ success: true, data: toResponse(withInclude!) });
});

export const editContent = catchAsync(async (req: Request, res: Response) => {
  const existing = await prisma.aIRecommendation.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
  if (!existing) throw AppError.notFound('Recommendation not found');
  const generatedContent = existing.generatedContent as { subject?: string; body?: string } | null;
  const rec = await prisma.aIRecommendation.update({
    where: { id: req.params.id },
    data: { generatedContent: { subject: req.body.subject ?? generatedContent?.subject, body: req.body.body } },
    include: LIST_INCLUDE,
  });
  res.json({ success: true, data: toResponse(rec) });
});

export const approve = catchAsync(async (req: Request, res: Response) => {
  const existing = await prisma.aIRecommendation.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
  if (!existing) throw AppError.notFound('Recommendation not found');
  if (existing.status !== 'pending') throw AppError.badRequest('Recommendation is not pending');

  const rec = await prisma.aIRecommendation.update({
    where: { id: req.params.id },
    data: { status: 'approved', approvedById: req.user!.id, approvedAt: new Date() },
    include: LIST_INCLUDE,
  });

  await writeAuditLog({
    organization: req.user!.organizationId,
    actorType: 'user',
    actor: req.user!.id,
    action: 'ai_recommendation.approved',
    entityType: 'AIRecommendation',
    entityId: rec.id,
    approvalRequired: true,
    approvedBy: req.user!.id,
  });

  res.json({ success: true, data: toResponse(rec) });
});

export const reject = catchAsync(async (req: Request, res: Response) => {
  const existing = await prisma.aIRecommendation.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
  if (!existing) throw AppError.notFound('Recommendation not found');

  const rec = await prisma.aIRecommendation.update({
    where: { id: req.params.id },
    data: { status: 'rejected', rejectedReason: req.body.reason },
    include: LIST_INCLUDE,
  });

  await writeAuditLog({
    organization: req.user!.organizationId,
    actorType: 'user',
    actor: req.user!.id,
    action: 'ai_recommendation.rejected',
    entityType: 'AIRecommendation',
    entityId: rec.id,
    metadata: { reason: req.body.reason },
  });

  res.json({ success: true, data: toResponse(rec) });
});

/**
 * Executes an approved (or, if autonomy permission is "allowed", not-yet-approved)
 * recommendation. This is the terminal step of the AI Action Flow (Section 43):
 * permission check -> execute -> CRM updated -> audit log -> notify.
 */
export const execute = catchAsync(async (req: Request, res: Response) => {
  const existing = await prisma.aIRecommendation.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
  if (!existing) throw AppError.notFound('Recommendation not found');
  if (!['pending', 'approved'].includes(existing.status)) throw AppError.badRequest('Recommendation cannot be executed in its current state');

  if (existing.permissionRequirement === 'approval_required' && existing.status !== 'approved') {
    throw AppError.forbidden('This action requires approval before it can be executed');
  }

  const rec = await ensureContentPrepared(existing);
  const generatedContent = rec.generatedContent as { subject?: string; body?: string } | null;
  const orgId = req.user!.organizationId;
  const deal = rec.dealId ? await prisma.deal.findFirst({ where: { id: rec.dealId, organizationId: orgId } }) : null;

  let outcome: { success: boolean; error?: string } = { success: false };

  if (rec.action === 'send_email' && deal) {
    const contact = deal.primaryContactId ? await prisma.contact.findUnique({ where: { id: deal.primaryContactId } }) : null;
    if (!contact?.email) {
      outcome = { success: false, error: 'No contact email on file for this deal' };
    } else {
      const provider = await resolveEmailProvider(orgId);
      const result = await provider.send({ from: 'no-reply@yourcompany.com', to: contact.email, subject: generatedContent?.subject ?? rec.title, body: generatedContent?.body ?? '' });
      await prisma.email.create({
        data: {
          organizationId: orgId,
          dealId: deal.id,
          contactId: contact.id,
          from: 'no-reply@yourcompany.com',
          to: contact.email,
          subject: generatedContent?.subject ?? rec.title,
          body: generatedContent?.body ?? '',
          status: result.success ? 'sent' : 'failed',
          provider: provider.name,
          generatedByAI: true,
          sentAt: result.success ? new Date() : undefined,
          error: result.error,
          createdById: req.user!.id,
        },
      });
      outcome = result;
    }
  } else if (rec.action === 'send_whatsapp' && deal) {
    const contact = deal.primaryContactId ? await prisma.contact.findUnique({ where: { id: deal.primaryContactId } }) : null;
    if (!contact?.phone) {
      outcome = { success: false, error: 'No contact phone number on file for this deal' };
    } else {
      const provider = await resolveWhatsAppProvider(orgId);
      const result = await provider.send({ fromNumber: 'org-number', toNumber: contact.phone, body: generatedContent?.body ?? '' });
      await prisma.message.create({
        data: {
          organizationId: orgId,
          dealId: deal.id,
          contactId: contact.id,
          direction: 'outbound',
          fromNumber: 'org-number',
          toNumber: contact.phone,
          body: generatedContent?.body ?? '',
          status: result.success ? 'sent' : 'failed',
          provider: provider.name,
          generatedByAI: true,
          createdById: req.user!.id,
        },
      });
      outcome = result;
    }
  } else if (rec.action === 'create_task' && deal) {
    await prisma.task.create({
      data: {
        organizationId: orgId,
        title: rec.title,
        description: rec.reason,
        dealId: deal.id,
        assignedToId: deal.ownerId,
        priority: rec.priority,
        createdById: req.user!.id,
        createdByAI: true,
      },
    });
    outcome = { success: true };
  } else {
    outcome = { success: false, error: `Execution for action "${rec.action}" is not automated yet — handle it manually.` };
  }

  const updated = await prisma.aIRecommendation.update({
    where: { id: rec.id },
    data: outcome.success ? { status: 'executed', executedAt: new Date() } : {},
    include: LIST_INCLUDE,
  });

  await writeAuditLog({
    organization: orgId,
    actorType: 'ai_agent',
    action: `ai_recommendation.${outcome.success ? 'executed' : 'execution_failed'}`,
    entityType: 'AIRecommendation',
    entityId: rec.id,
    approvalRequired: rec.permissionRequirement === 'approval_required',
    approvedBy: rec.approvedById ?? undefined,
    metadata: { error: outcome.error },
  });

  if (outcome.success) {
    await notifyUser({
      organization: orgId,
      user: deal ? deal.ownerId : req.user!.id,
      type: 'ai_recommendation',
      title: 'AI action executed',
      message: `${rec.title} was completed.`,
      link: deal ? `/deals/${deal.id}` : undefined,
    });
  }

  res.json({ success: true, data: { recommendation: toResponse(updated), outcome } });
});

export const autonomySettings = {
  get: catchAsync(async (req: Request, res: Response) => {
    const settings = await getAutonomySettings(req.user!.organizationId);
    res.json({ success: true, data: settings });
  }),
  update: catchAsync(async (req: Request, res: Response) => {
    const { level, permissions } = req.body as { level?: number; permissions?: Record<string, string> };
    const settings = await upsertAutonomySettings(req.user!.organizationId, req.user!.id, { level, permissions: permissions as never });
    await writeAuditLog({
      organization: req.user!.organizationId,
      actorType: 'user',
      actor: req.user!.id,
      action: 'autonomy_settings.updated',
      entityType: 'AutonomySettings',
      entityId: settings.id,
      after: settings as unknown as Record<string, unknown>,
    });
    res.json({ success: true, data: settings });
  }),
};
