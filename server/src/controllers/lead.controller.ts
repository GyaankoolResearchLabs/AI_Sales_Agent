import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { writeAuditLog } from '../services/audit.service';
import { prisma } from '../config/prisma';
import { toRefLite, parsePagination, parseSort, paginationMeta, searchOr } from '../utils/prismaCrud';
import { scoreAndSaveLead } from '../ai/leadScoring.service';

const INCLUDE = { owner: { select: { id: true, name: true } } } as const;

function toResponse(l: Prisma.LeadGetPayload<{ include: typeof INCLUDE }>) {
  return {
    _id: l.id,
    organization: l.organizationId,
    name: l.name,
    email: l.email ?? undefined,
    phone: l.phone ?? undefined,
    companyName: l.companyName ?? undefined,
    jobTitle: l.jobTitle ?? undefined,
    source: l.source,
    status: l.status,
    score: l.score,
    scoreBreakdown: l.scoreBreakdown ?? undefined,
    owner: toRefLite(l.owner),
    convertedToContact: l.convertedToContactId ?? undefined,
    convertedToDeal: l.convertedToDealId ?? undefined,
    notes: l.notes ?? undefined,
    customFields: l.customFields,
    lastActivityAt: l.lastActivityAt ?? undefined,
    createdBy: l.createdById,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  };
}

export const list = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const { page, limit, skip } = parsePagination(req);
  const where: Prisma.LeadWhereInput = { organizationId: orgId };
  if (req.query.status) where.status = req.query.status as never;
  if (req.query.owner) where.ownerId = String(req.query.owner);
  if (req.query.source) where.source = String(req.query.source);
  const or = searchOr(['name', 'email', 'companyName'], req.query.search);
  if (or) where.OR = or as Prisma.LeadWhereInput[];

  const [items, total] = await Promise.all([
    prisma.lead.findMany({ where, orderBy: parseSort(req.query.sort), skip, take: limit, include: INCLUDE }),
    prisma.lead.count({ where }),
  ]);

  res.json({ success: true, data: items.map(toResponse), pagination: paginationMeta(page, limit, total) });
});

export const getOne = catchAsync(async (req: Request, res: Response) => {
  const lead = await prisma.lead.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId }, include: INCLUDE });
  if (!lead) throw AppError.notFound('Lead not found');
  res.json({ success: true, data: toResponse(lead) });
});

export const create = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const body = req.body as Record<string, unknown>;
  const lead = await prisma.lead.create({
    data: {
      organizationId: orgId,
      name: body.name as string,
      email: (body.email as string) || undefined,
      phone: body.phone as string | undefined,
      companyName: body.companyName as string | undefined,
      jobTitle: body.jobTitle as string | undefined,
      source: (body.source as string) || 'manual',
      status: (body.status as never) || 'new',
      ownerId: (body.owner as string | undefined) || undefined,
      notes: body.notes as string | undefined,
      customFields: (body.customFields as Prisma.InputJsonValue) ?? {},
      createdById: req.user!.id,
    },
    include: INCLUDE,
  });

  await writeAuditLog({
    organization: orgId,
    actorType: 'user',
    actor: req.user!.id,
    action: 'lead.created',
    entityType: 'Lead',
    entityId: lead.id,
    after: lead as unknown as Record<string, unknown>,
  });

  await scoreAndSaveLead(lead.id, orgId);
  const scored = await prisma.lead.findUnique({ where: { id: lead.id }, include: INCLUDE });

  res.status(201).json({ success: true, data: toResponse(scored!) });
});

export const update = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const existing = await prisma.lead.findFirst({ where: { id: req.params.id, organizationId: orgId } });
  if (!existing) throw AppError.notFound('Lead not found');

  const body = req.body as Record<string, unknown>;
  const data: Prisma.LeadUncheckedUpdateInput = {};
  if (body.name !== undefined) data.name = body.name as string;
  if (body.email !== undefined) data.email = (body.email as string) || null;
  if (body.phone !== undefined) data.phone = body.phone as string;
  if (body.companyName !== undefined) data.companyName = body.companyName as string;
  if (body.jobTitle !== undefined) data.jobTitle = body.jobTitle as string;
  if (body.source !== undefined) data.source = body.source as string;
  if (body.status !== undefined) data.status = body.status as never;
  if (body.owner !== undefined) data.ownerId = (body.owner as string) || null;
  if (body.notes !== undefined) data.notes = body.notes as string;
  if (body.customFields !== undefined) data.customFields = body.customFields as Prisma.InputJsonValue;

  await prisma.lead.update({ where: { id: req.params.id }, data });

  await writeAuditLog({
    organization: orgId,
    actorType: 'user',
    actor: req.user!.id,
    action: 'lead.updated',
    entityType: 'Lead',
    entityId: req.params.id,
    before: existing as unknown as Record<string, unknown>,
  });

  await scoreAndSaveLead(req.params.id, orgId);
  const lead = await prisma.lead.findUnique({ where: { id: req.params.id }, include: INCLUDE });

  res.json({ success: true, data: toResponse(lead!) });
});

export const remove = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const existing = await prisma.lead.findFirst({ where: { id: req.params.id, organizationId: orgId } });
  if (!existing) throw AppError.notFound('Lead not found');
  await prisma.lead.delete({ where: { id: req.params.id } });

  await writeAuditLog({
    organization: orgId,
    actorType: 'user',
    actor: req.user!.id,
    action: 'lead.deleted',
    entityType: 'Lead',
    entityId: req.params.id,
    before: existing as unknown as Record<string, unknown>,
  });

  res.json({ success: true, data: { id: req.params.id } });
});

export const getTimeline = catchAsync(async (req: Request, res: Response) => {
  const lead = await prisma.lead.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
  if (!lead) throw AppError.notFound('Lead not found');
  // Activity has already been migrated to Prisma in this same batch.
  const activities = await prisma.activity.findMany({
    where: { organizationId: req.user!.organizationId, leadId: lead.id },
    orderBy: { createdAt: 'desc' },
    include: { owner: { select: { id: true, name: true } }, assignedTo: { select: { id: true, name: true } } },
  });
  res.json({ success: true, data: activities.map((a) => ({ ...a, _id: a.id, owner: toRefLite(a.owner), assignedTo: toRefLite(a.assignedTo) })) });
});

export const rescore = catchAsync(async (req: Request, res: Response) => {
  const lead = await scoreAndSaveLead(req.params.id, req.user!.organizationId);
  res.json({ success: true, data: { score: lead.score, breakdown: lead.scoreBreakdown } });
});

export const assignOwner = catchAsync(async (req: Request, res: Response) => {
  const existing = await prisma.lead.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
  if (!existing) throw AppError.notFound('Lead not found');
  const lead = await prisma.lead.update({ where: { id: req.params.id }, data: { ownerId: req.body.ownerId }, include: INCLUDE });
  res.json({ success: true, data: toResponse(lead) });
});
