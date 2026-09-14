import { Request, Response } from 'express';
import { Prisma, Deal, Contact } from '@prisma/client';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { prisma } from '../config/prisma';
import { aiService } from '../ai/aiService';
import { ContentContext } from '../ai/contentTemplates';

const DEAL_INCLUDE = { company: { select: { name: true } }, primaryContact: { select: { name: true } } } as const;
type DealWithRelations = Prisma.DealGetPayload<{ include: typeof DEAL_INCLUDE }>;
const CONTACT_INCLUDE = { company: { select: { name: true } } } as const;
type ContactWithRelations = Prisma.ContactGetPayload<{ include: typeof CONTACT_INCLUDE }>;
type ContentDraftType = Prisma.ContentDraftGetPayload<true>['type'];

interface LoadedEntities {
  deal: DealWithRelations | null;
  contact: ContactWithRelations | null;
}

function toResponse(d: Prisma.ContentDraftGetPayload<true>) {
  return {
    _id: d.id,
    organization: d.organizationId,
    type: d.type,
    deal: d.dealId ?? undefined,
    contact: d.contactId ?? undefined,
    purpose: d.purpose ?? undefined,
    tone: d.tone ?? undefined,
    section: d.section ?? undefined,
    content: d.content,
    status: d.status,
    regeneratedFrom: d.regeneratedFromId ?? undefined,
    createdBy: d.createdById,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

/** Loads the deal/contact for this request, strictly org-scoped — 404s if an id was given but doesn't resolve inside the caller's org. */
async function loadEntities(orgId: string, dealId?: string, contactId?: string): Promise<LoadedEntities> {
  let deal: DealWithRelations | null = null;
  let contact: ContactWithRelations | null = null;

  if (dealId) {
    deal = await prisma.deal.findFirst({ where: { id: dealId, organizationId: orgId }, include: DEAL_INCLUDE });
    if (!deal) throw AppError.notFound('Deal not found');
  }
  if (contactId) {
    contact = await prisma.contact.findFirst({ where: { id: contactId, organizationId: orgId }, include: CONTACT_INCLUDE });
    if (!contact) throw AppError.notFound('Contact not found');
  }
  if (!deal && !contact) throw AppError.badRequest('At least one of dealId or contactId is required');

  return { deal, contact };
}

/** Summarizes real recent Activity records into one grounded sentence — never fabricated, empty string if none exist. */
async function summarizeRecentActivity(orgId: string, dealId?: string): Promise<string | undefined> {
  if (!dealId) return undefined;
  const activities = await prisma.activity.findMany({ where: { organizationId: orgId, dealId }, orderBy: { createdAt: 'desc' }, take: 3 });
  if (activities.length === 0) return undefined;
  const latest = activities[0];
  const daysSince = Math.floor((Date.now() - new Date(latest.createdAt).getTime()) / 86400000);
  return `The most recent activity was a ${latest.type} ("${latest.subject}") ${daysSince === 0 ? 'today' : `${daysSince} day(s) ago`}.`;
}

async function buildContext(orgId: string, deal: DealWithRelations | null, contact: ContactWithRelations | null, body: Record<string, unknown>): Promise<ContentContext> {
  const recentActivitySummary = await summarizeRecentActivity(orgId, deal?.id);

  return {
    dealName: deal?.name,
    dealValue: deal?.value,
    currency: deal?.currency,
    companyName: deal?.company?.name ?? contact?.company?.name,
    contactName: contact?.name ?? deal?.primaryContact?.name,
    purpose: typeof body.purpose === 'string' ? body.purpose : undefined,
    tone: typeof body.tone === 'string' ? (body.tone as ContentContext['tone']) : undefined,
    reason: typeof body.reason === 'string' ? body.reason : undefined,
    section: typeof body.section === 'string' ? body.section : undefined,
    recentActivitySummary,
  };
}

async function saveDraft(
  orgId: string,
  userId: string,
  type: ContentDraftType,
  deal: Deal | DealWithRelations | null,
  contact: Contact | ContactWithRelations | null,
  ctx: ContentContext,
  content: Prisma.InputJsonValue,
  regeneratedFrom?: string
) {
  return prisma.contentDraft.create({
    data: {
      organizationId: orgId,
      type,
      dealId: deal?.id,
      contactId: contact?.id,
      purpose: ctx.purpose,
      tone: ctx.tone,
      section: ctx.section,
      content,
      createdById: userId,
      regeneratedFromId: regeneratedFrom,
    },
  });
}

export const createEmailDraft = catchAsync(async (req: Request, res: Response) => {
  const { dealId, contactId } = req.body as { dealId?: string; contactId?: string };
  const { deal, contact } = await loadEntities(req.user!.organizationId, dealId, contactId);
  const ctx = await buildContext(req.user!.organizationId, deal, contact, req.body);

  const content = await aiService.generateEmail(ctx);
  const draft = await saveDraft(req.user!.organizationId, req.user!.id, 'email', deal, contact, ctx, content);

  res.status(201).json({ success: true, data: toResponse(draft) });
});

export const createWhatsAppDraft = catchAsync(async (req: Request, res: Response) => {
  const { dealId, contactId } = req.body as { dealId?: string; contactId?: string };
  const { deal, contact } = await loadEntities(req.user!.organizationId, dealId, contactId);
  const ctx = await buildContext(req.user!.organizationId, deal, contact, req.body);

  const content = await aiService.generateWhatsApp(ctx);
  const draft = await saveDraft(req.user!.organizationId, req.user!.id, 'whatsapp', deal, contact, ctx, content);

  res.status(201).json({ success: true, data: toResponse(draft) });
});

export const createCallScriptDraft = catchAsync(async (req: Request, res: Response) => {
  const { dealId, contactId } = req.body as { dealId?: string; contactId?: string };
  const { deal, contact } = await loadEntities(req.user!.organizationId, dealId, contactId);
  const ctx = await buildContext(req.user!.organizationId, deal, contact, req.body);

  const content = await aiService.generateCallScript(ctx);
  const draft = await saveDraft(req.user!.organizationId, req.user!.id, 'call_script', deal, contact, ctx, content as unknown as Prisma.InputJsonValue);

  res.status(201).json({ success: true, data: toResponse(draft) });
});

export const createProposalDraft = catchAsync(async (req: Request, res: Response) => {
  const { dealId } = req.body as { dealId?: string };
  if (!dealId) throw AppError.badRequest('dealId is required');
  const { deal, contact } = await loadEntities(req.user!.organizationId, dealId, undefined);
  const ctx = await buildContext(req.user!.organizationId, deal, contact, req.body);

  const content = await aiService.generateProposalSectionContent(ctx);
  const draft = await saveDraft(req.user!.organizationId, req.user!.id, 'proposal', deal, contact, ctx, content);

  res.status(201).json({ success: true, data: toResponse(draft) });
});

/** Regenerates from an existing draft's stored parameters — creates a NEW draft document, never mutates the original. */
export const regenerateDraft = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const original = await prisma.contentDraft.findFirst({ where: { id: req.params.id, organizationId: orgId } });
  if (!original) throw AppError.notFound('Draft not found');

  const deal = original.dealId ? await prisma.deal.findFirst({ where: { id: original.dealId, organizationId: orgId }, include: DEAL_INCLUDE }) : null;
  const contact = original.contactId ? await prisma.contact.findFirst({ where: { id: original.contactId, organizationId: orgId }, include: CONTACT_INCLUDE }) : null;

  const ctx = await buildContext(orgId, deal, contact, {
    purpose: original.purpose,
    tone: original.tone,
    section: original.section,
  });

  let content: Prisma.InputJsonValue;
  if (original.type === 'email') content = await aiService.generateEmail(ctx);
  else if (original.type === 'whatsapp') content = await aiService.generateWhatsApp(ctx);
  else if (original.type === 'call_script') content = (await aiService.generateCallScript(ctx)) as unknown as Prisma.InputJsonValue;
  else content = await aiService.generateProposalSectionContent(ctx);

  const regenerated = await saveDraft(orgId, req.user!.id, original.type, deal, contact, ctx, content, original.id);

  res.status(201).json({ success: true, data: toResponse(regenerated) });
});

export const getDraft = catchAsync(async (req: Request, res: Response) => {
  const draft = await prisma.contentDraft.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
  if (!draft) throw AppError.notFound('Draft not found');
  res.json({ success: true, data: toResponse(draft) });
});

export const listDrafts = catchAsync(async (req: Request, res: Response) => {
  const where: Prisma.ContentDraftWhereInput = { organizationId: req.user!.organizationId };
  if (req.query.dealId) where.dealId = String(req.query.dealId);
  if (req.query.type) where.type = req.query.type as never;
  const drafts = await prisma.contentDraft.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 });
  res.json({ success: true, data: drafts.map(toResponse) });
});
