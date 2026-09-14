import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { getLevelAndPermission } from '../services/autonomySettings.service';
import { createApproval, executeContentSend } from '../services/approval.service';
import { writeAuditLog } from '../services/audit.service';
import { prisma } from '../config/prisma';

const INCLUDE = {
  deal: { select: { id: true, name: true, value: true } },
  lead: { select: { id: true, name: true } },
  contact: { select: { id: true, name: true } },
  contentDraft: true,
  decidedBy: { select: { id: true, name: true } },
} as const;

function toResponse(a: Prisma.ApprovalGetPayload<{ include: typeof INCLUDE }>) {
  return {
    _id: a.id,
    organization: a.organizationId,
    title: a.title,
    reason: a.reason,
    deal: a.deal ? { _id: a.deal.id, name: a.deal.name, value: a.deal.value } : undefined,
    lead: a.lead ? { _id: a.lead.id, name: a.lead.name } : undefined,
    contact: a.contact ? { _id: a.contact.id, name: a.contact.name } : undefined,
    contentDraft: a.contentDraft
      ? {
          _id: a.contentDraft.id,
          organization: a.contentDraft.organizationId,
          type: a.contentDraft.type,
          deal: a.contentDraft.dealId ?? undefined,
          contact: a.contentDraft.contactId ?? undefined,
          purpose: a.contentDraft.purpose ?? undefined,
          tone: a.contentDraft.tone ?? undefined,
          section: a.contentDraft.section ?? undefined,
          content: a.contentDraft.content,
          status: a.contentDraft.status,
          regeneratedFrom: a.contentDraft.regeneratedFromId ?? undefined,
          createdAt: a.contentDraft.createdAt,
          updatedAt: a.contentDraft.updatedAt,
        }
      : undefined,
    confidence: a.confidence,
    permissionCategory: a.permissionCategory,
    status: a.status,
    decidedBy: a.decidedBy ? { _id: a.decidedBy.id, name: a.decidedBy.name } : undefined,
    decidedAt: a.decidedAt ?? undefined,
    rejectedReason: a.rejectedReason ?? undefined,
    autoExecuted: a.autoExecuted,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

export const list = catchAsync(async (req: Request, res: Response) => {
  const where: Prisma.ApprovalWhereInput = { organizationId: req.user!.organizationId };
  if (req.query.status) where.status = req.query.status as never;
  const approvals = await prisma.approval.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100, include: INCLUDE });
  res.json({ success: true, data: approvals.map(toResponse) });
});

export const getOne = catchAsync(async (req: Request, res: Response) => {
  const approval = await prisma.approval.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId }, include: INCLUDE });
  if (!approval) throw AppError.notFound('Approval not found');
  res.json({ success: true, data: toResponse(approval) });
});

/**
 * Internal/AI-triggered creation — real trigger paths are anomaly detection and
 * next-best-action (see approval.service.ts's proposeApprovalForAtRiskDeal), but this
 * endpoint exists so the same permission-aware creation path is directly testable and
 * usable by other internal callers.
 */
export const create = catchAsync(async (req: Request, res: Response) => {
  const { dealId, leadId, contactId, contentDraftId, title, reason, confidence, permissionCategory } = req.body;

  if (dealId) {
    const deal = await prisma.deal.findFirst({ where: { id: dealId, organizationId: req.user!.organizationId } });
    if (!deal) throw AppError.notFound('Deal not found');
  }
  if (contentDraftId) {
    const draft = await prisma.contentDraft.findFirst({ where: { id: contentDraftId, organizationId: req.user!.organizationId } });
    if (!draft) throw AppError.notFound('Content draft not found');
  }

  const result = await createApproval({
    organization: req.user!.organizationId,
    title,
    reason,
    dealId,
    leadId,
    contactId,
    contentDraftId,
    confidence: confidence ?? 50,
    permissionCategory,
    dedupeKey: `manual:${dealId ?? leadId ?? contactId}:${title}`,
  });

  const withInclude = await prisma.approval.findUnique({ where: { id: result.approval.id }, include: INCLUDE });

  res.status(201).json({ success: true, data: toResponse(withInclude!), autoExecuted: result.autoExecuted, sendResult: result.sendResult });
});

export const approve = catchAsync(async (req: Request, res: Response) => {
  const existing = await prisma.approval.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
  if (!existing) throw AppError.notFound('Approval not found');
  if (existing.status !== 'pending') throw AppError.badRequest(`Approval is already ${existing.status}`);

  const { permission } = await getLevelAndPermission(req.user!.organizationId, existing.permissionCategory);
  if (permission === 'disabled') {
    throw AppError.forbidden(`${existing.permissionCategory} is disabled by your organization's autonomy settings — this action cannot be approved.`);
  }

  const approval = await prisma.approval.update({
    where: { id: req.params.id },
    data: { status: 'approved', decidedById: req.user!.id, decidedAt: new Date() },
  });

  if (approval.contentDraftId) {
    await prisma.contentDraft.update({ where: { id: approval.contentDraftId }, data: { status: 'approved' } });
  }

  await writeAuditLog({
    organization: req.user!.organizationId,
    actorType: 'user',
    actor: req.user!.id,
    action: 'approval.approved',
    entityType: 'Approval',
    entityId: approval.id,
    approvalRequired: true,
    approvedBy: req.user!.id,
  });

  // Real send-execution: if this is an email/whatsapp approval with prepared content,
  // actually attempt delivery now. Failure is reported back, not swallowed — the
  // ContentDraft stays "approved" (not "sent") and a separate audit entry records it.
  const sendResult = await executeContentSend(approval);
  if (sendResult.attempted) {
    await writeAuditLog({
      organization: req.user!.organizationId,
      actorType: 'user',
      actor: req.user!.id,
      action: sendResult.success ? 'approval.executed' : 'approval.execution_failed',
      entityType: 'Approval',
      entityId: approval.id,
      metadata: { provider: sendResult.provider, environment: sendResult.environment, providerMessageId: sendResult.providerMessageId, error: sendResult.error },
    });
  }

  const withInclude = await prisma.approval.findUnique({ where: { id: approval.id }, include: INCLUDE });
  res.json({ success: true, data: toResponse(withInclude!), sendResult });
});

export const reject = catchAsync(async (req: Request, res: Response) => {
  const { reason } = req.body as { reason?: string };
  if (!reason || !reason.trim()) throw AppError.badRequest('A reason is required to reject an approval');

  const existing = await prisma.approval.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
  if (!existing) throw AppError.notFound('Approval not found');
  if (existing.status !== 'pending') throw AppError.badRequest(`Approval is already ${existing.status}`);

  const approval = await prisma.approval.update({
    where: { id: req.params.id },
    data: { status: 'rejected', rejectedReason: reason, decidedById: req.user!.id, decidedAt: new Date() },
    include: INCLUDE,
  });

  await writeAuditLog({
    organization: req.user!.organizationId,
    actorType: 'user',
    actor: req.user!.id,
    action: 'approval.rejected',
    entityType: 'Approval',
    entityId: approval.id,
    metadata: { reason },
  });

  res.json({ success: true, data: toResponse(approval) });
});
