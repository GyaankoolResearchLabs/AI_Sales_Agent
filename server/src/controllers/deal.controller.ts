import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { scoreAndSaveDeal } from '../ai/dealScoring.service';
import { writeAuditLog } from '../services/audit.service';
import { prisma } from '../config/prisma';
import { toRefLite, parsePagination, parseSort, paginationMeta, searchOr } from '../utils/prismaCrud';

const LIST_INCLUDE = {
  owner: { select: { id: true, name: true } },
  company: { select: { id: true, name: true } },
} as const;

const DETAIL_INCLUDE = {
  owner: { select: { id: true, name: true } },
  company: { select: { id: true, name: true } },
  primaryContact: { select: { id: true, name: true, email: true, phone: true, isDecisionMaker: true } },
  products: { include: { product: { select: { id: true, name: true, price: true } } } },
} as const;

type DealWithDetail = Prisma.DealGetPayload<{ include: typeof DETAIL_INCLUDE }>;
type DealWithList = Prisma.DealGetPayload<{ include: typeof LIST_INCLUDE }>;

function toResponse(d: DealWithDetail | DealWithList) {
  const primaryContact = 'primaryContact' in d ? d.primaryContact : undefined;
  const products = 'products' in d ? d.products : undefined;
  return {
    _id: d.id,
    organization: d.organizationId,
    name: d.name,
    company: toRefLite(d.company),
    primaryContact: primaryContact
      ? { _id: primaryContact.id, name: primaryContact.name, email: primaryContact.email ?? undefined, phone: primaryContact.phone ?? undefined, isDecisionMaker: primaryContact.isDecisionMaker }
      : undefined,
    owner: toRefLite(d.owner),
    value: d.value,
    currency: d.currency,
    stageKey: d.stageKey,
    probability: d.probability,
    expectedCloseDate: d.expectedCloseDate ?? undefined,
    source: d.source ?? undefined,
    products: products?.map((p) => ({ product: p.product ? { _id: p.product.id, name: p.product.name, price: p.product.price } : undefined, quantity: p.quantity, price: p.price })),
    aiScore: d.aiScore ?? undefined,
    lastActivityAt: d.lastActivityAt ?? undefined,
    wonAt: d.wonAt ?? undefined,
    lostAt: d.lostAt ?? undefined,
    lostReason: d.lostReason ?? undefined,
    notes: d.notes ?? undefined,
    customFields: d.customFields,
    createdBy: d.createdById,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

/** Applies won/lost timestamps + configured stage probability when a deal's stageKey changes, exactly mirroring the old Mongoose applyStageSideEffects. */
async function stageSideEffectData(orgId: string, stageKey: string, current: { wonAt: Date | null; lostAt: Date | null }): Promise<Prisma.DealUncheckedUpdateInput> {
  const stage = await prisma.dealStageConfig.findFirst({ where: { organizationId: orgId, key: stageKey } });
  const data: Prisma.DealUncheckedUpdateInput = {};
  if (stage?.isWon && !current.wonAt) data.wonAt = new Date();
  if (stage?.isLost && !current.lostAt) data.lostAt = new Date();
  if (stage) data.probability = stage.probability;
  return data;
}

export const list = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const { page, limit, skip } = parsePagination(req);
  const where: Prisma.DealWhereInput = { organizationId: orgId };
  if (req.query.stageKey) where.stageKey = String(req.query.stageKey);
  if (req.query.owner) where.ownerId = String(req.query.owner);
  if (req.query.source) where.source = String(req.query.source);
  const or = searchOr(['name'], req.query.search);
  if (or) where.OR = or as Prisma.DealWhereInput[];

  const [items, total] = await Promise.all([
    prisma.deal.findMany({ where, orderBy: parseSort(req.query.sort), skip, take: limit, include: LIST_INCLUDE }),
    prisma.deal.count({ where }),
  ]);

  res.json({ success: true, data: items.map(toResponse), pagination: paginationMeta(page, limit, total) });
});

export const getOne = catchAsync(async (req: Request, res: Response) => {
  const deal = await prisma.deal.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId }, include: DETAIL_INCLUDE });
  if (!deal) throw AppError.notFound('Deal not found');
  res.json({ success: true, data: toResponse(deal) });
});

export const create = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const body = req.body as Record<string, unknown>;
  const products = (body.products as Array<{ product: string; quantity?: number; price?: number }> | undefined) ?? [];

  const deal = await prisma.deal.create({
    data: {
      organizationId: orgId,
      name: body.name as string,
      companyId: (body.company as string | undefined) || undefined,
      primaryContactId: (body.primaryContact as string | undefined) || undefined,
      ownerId: (body.owner as string | undefined) || req.user!.id,
      value: (body.value as number) ?? 0,
      currency: (body.currency as string) || 'USD',
      stageKey: (body.stageKey as string) || 'lead',
      probability: (body.probability as number) ?? 10,
      expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate as string) : undefined,
      source: body.source as string | undefined,
      notes: body.notes as string | undefined,
      customFields: (body.customFields as Prisma.InputJsonValue) ?? {},
      createdById: req.user!.id,
      products: products.length ? { create: products.map((p) => ({ productId: p.product, quantity: p.quantity ?? 1, price: p.price ?? 0 })) } : undefined,
    },
    include: DETAIL_INCLUDE,
  });

  await writeAuditLog({
    organization: orgId,
    actorType: 'user',
    actor: req.user!.id,
    action: 'deal.created',
    entityType: 'Deal',
    entityId: deal.id,
    after: deal as unknown as Record<string, unknown>,
  });

  await scoreAndSaveDeal(deal.id, orgId);
  const scored = await prisma.deal.findUnique({ where: { id: deal.id }, include: DETAIL_INCLUDE });

  res.status(201).json({ success: true, data: toResponse(scored!) });
});

export const update = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const existing = await prisma.deal.findFirst({ where: { id: req.params.id, organizationId: orgId } });
  if (!existing) throw AppError.notFound('Deal not found');

  const body = req.body as Record<string, unknown>;
  const data: Prisma.DealUncheckedUpdateInput = {};
  if (body.name !== undefined) data.name = body.name as string;
  if (body.company !== undefined) data.companyId = (body.company as string) || null;
  if (body.primaryContact !== undefined) data.primaryContactId = (body.primaryContact as string) || null;
  if (body.owner !== undefined) data.ownerId = body.owner as string;
  if (body.value !== undefined) data.value = body.value as number;
  if (body.currency !== undefined) data.currency = body.currency as string;
  if (body.stageKey !== undefined) data.stageKey = body.stageKey as string;
  if (body.probability !== undefined) data.probability = body.probability as number;
  if (body.expectedCloseDate !== undefined) data.expectedCloseDate = body.expectedCloseDate ? new Date(body.expectedCloseDate as string) : null;
  if (body.source !== undefined) data.source = body.source as string;
  if (body.notes !== undefined) data.notes = body.notes as string;
  if (body.customFields !== undefined) data.customFields = body.customFields as Prisma.InputJsonValue;

  if (body.stageKey !== undefined && body.stageKey !== existing.stageKey) {
    Object.assign(data, await stageSideEffectData(orgId, body.stageKey as string, existing));
  }

  await prisma.deal.update({ where: { id: req.params.id }, data });

  await writeAuditLog({
    organization: orgId,
    actorType: 'user',
    actor: req.user!.id,
    action: 'deal.updated',
    entityType: 'Deal',
    entityId: req.params.id,
    before: existing as unknown as Record<string, unknown>,
  });

  await scoreAndSaveDeal(req.params.id, orgId);
  const deal = await prisma.deal.findUnique({ where: { id: req.params.id }, include: DETAIL_INCLUDE });

  res.json({ success: true, data: toResponse(deal!) });
});

export const remove = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const existing = await prisma.deal.findFirst({ where: { id: req.params.id, organizationId: orgId } });
  if (!existing) throw AppError.notFound('Deal not found');
  await prisma.deal.delete({ where: { id: req.params.id } });

  await writeAuditLog({
    organization: orgId,
    actorType: 'user',
    actor: req.user!.id,
    action: 'deal.deleted',
    entityType: 'Deal',
    entityId: req.params.id,
    before: existing as unknown as Record<string, unknown>,
  });

  res.json({ success: true, data: { id: req.params.id } });
});

export const changeStage = catchAsync(async (req: Request, res: Response) => {
  const { stageKey } = req.body;
  const orgId = req.user!.organizationId;
  const existing = await prisma.deal.findFirst({ where: { id: req.params.id, organizationId: orgId } });
  if (!existing) throw AppError.notFound('Deal not found');

  const before = { stageKey: existing.stageKey };
  const data: Prisma.DealUncheckedUpdateInput = { stageKey, ...(await stageSideEffectData(orgId, stageKey, existing)) };
  const deal = await prisma.deal.update({ where: { id: req.params.id }, data, include: DETAIL_INCLUDE });
  await scoreAndSaveDeal(deal.id, orgId);

  await writeAuditLog({
    organization: orgId,
    actorType: 'user',
    actor: req.user!.id,
    action: 'deal.stage_changed',
    entityType: 'Deal',
    entityId: deal.id,
    before,
    after: { stageKey: deal.stageKey },
  });

  const refreshed = await prisma.deal.findUnique({ where: { id: deal.id }, include: DETAIL_INCLUDE });
  res.json({ success: true, data: toResponse(refreshed!) });
});

export const analyze = catchAsync(async (req: Request, res: Response) => {
  const deal = await scoreAndSaveDeal(req.params.id, req.user!.organizationId);
  res.json({ success: true, data: deal.aiScore });
});

/**
 * Full deal detail: the deal plus its activities, conversations, contacts,
 * and tasks — every relation is a real query scoped to the same
 * organization as the deal itself. 404s (not a data leak) if the deal
 * doesn't exist or belongs to a different organization.
 */
export const getDealDetail = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const deal = await prisma.deal.findFirst({ where: { id: req.params.id, organizationId: orgId }, include: DETAIL_INCLUDE });
  if (!deal) throw AppError.notFound('Deal not found');

  const USER_SELECT = { select: { id: true, name: true } } as const;
  const [activities, conversations, tasks, contacts] = await Promise.all([
    prisma.activity.findMany({
      where: { organizationId: orgId, dealId: deal.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { owner: USER_SELECT, assignedTo: USER_SELECT },
    }),
    prisma.conversation.findMany({ where: { organizationId: orgId, dealId: deal.id }, orderBy: { occurredAt: 'desc' }, take: 50 }),
    prisma.task.findMany({
      where: { organizationId: orgId, dealId: deal.id },
      orderBy: { dueDate: 'asc' },
      include: { assignedTo: USER_SELECT },
    }),
    deal.primaryContactId ? prisma.contact.findMany({ where: { organizationId: orgId, id: deal.primaryContactId } }) : Promise.resolve([]),
  ]);

  res.json({
    success: true,
    data: {
      deal: toResponse(deal),
      activities: activities.map((a) => ({ ...a, _id: a.id, owner: toRefLite(a.owner), assignedTo: toRefLite(a.assignedTo) })),
      conversations: conversations.map((c) => ({ ...c, _id: c.id })),
      tasks: tasks.map((t) => ({ ...t, _id: t.id, assignedTo: toRefLite(t.assignedTo) })),
      contacts: contacts.map((c) => ({ ...c, _id: c.id })),
    },
  });
});

// Retained under the original path for the existing frontend; same handler as getDealDetail.
export const getFullDetail = getDealDetail;

/**
 * Deals grouped by the organization's actually-configured stages (Organization.dealStages),
 * never a hardcoded stage list. Supports ?owner=<userId> and ?minValue=/?maxValue= filters.
 */
export const getPipeline = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const stages = await prisma.dealStageConfig.findMany({ where: { organizationId: orgId }, orderBy: { order: 'asc' } });

  const where: Prisma.DealWhereInput = { organizationId: orgId };
  if (req.query.owner) where.ownerId = String(req.query.owner);
  if (req.query.minValue || req.query.maxValue) {
    where.value = {
      ...(req.query.minValue ? { gte: Number(req.query.minValue) } : {}),
      ...(req.query.maxValue ? { lte: Number(req.query.maxValue) } : {}),
    };
  }

  const deals = await prisma.deal.findMany({ where, include: LIST_INCLUDE });
  const dealsResponse = deals.map(toResponse);

  const result = stages.map((stage) => {
    const stageDeals = dealsResponse.filter((d) => d.stageKey === stage.key);
    return {
      stageKey: stage.key,
      label: stage.label,
      order: stage.order,
      isWon: stage.isWon,
      isLost: stage.isLost,
      count: stageDeals.length,
      value: stageDeals.reduce((sum, d) => sum + d.value, 0),
      deals: stageDeals,
    };
  });

  res.json({ success: true, data: result });
});
