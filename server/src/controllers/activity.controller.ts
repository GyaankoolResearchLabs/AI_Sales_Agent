import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { writeAuditLog } from '../services/audit.service';
import { prisma } from '../config/prisma';
import { toRefLite, parsePagination, parseSort, paginationMeta, searchOr } from '../utils/prismaCrud';
import { scoreAndSaveDeal } from '../ai/dealScoring.service';
import { scoreAndSaveLead } from '../ai/leadScoring.service';

const INCLUDE = { owner: { select: { id: true, name: true } }, assignedTo: { select: { id: true, name: true } } } as const;

function toResponse(a: Prisma.ActivityGetPayload<{ include: typeof INCLUDE }>) {
  return {
    _id: a.id,
    organization: a.organizationId,
    type: a.type,
    subject: a.subject,
    body: a.body ?? undefined,
    deal: a.dealId ?? undefined,
    lead: a.leadId ?? undefined,
    contact: a.contactId ?? undefined,
    company: a.companyId ?? undefined,
    owner: toRefLite(a.owner),
    assignedTo: toRefLite(a.assignedTo),
    scheduledAt: a.scheduledAt ?? undefined,
    completedAt: a.completedAt ?? undefined,
    isCompleted: a.isCompleted,
    direction: a.direction ?? undefined,
    createdBy: a.createdById,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

async function bumpLastActivity(activity: { dealId: string | null; leadId: string | null; organizationId: string; completedAt: Date | null; createdAt: Date }) {
  const now = activity.completedAt ?? activity.createdAt ?? new Date();
  if (activity.dealId) {
    await prisma.deal.update({ where: { id: activity.dealId }, data: { lastActivityAt: now } });
    await scoreAndSaveDeal(activity.dealId, activity.organizationId);
  }
  if (activity.leadId) {
    await prisma.lead.update({ where: { id: activity.leadId }, data: { lastActivityAt: now } });
    await scoreAndSaveLead(activity.leadId, activity.organizationId);
  }
}

export const list = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const { page, limit, skip } = parsePagination(req);
  const where: Prisma.ActivityWhereInput = { organizationId: orgId };
  if (req.query.type) where.type = req.query.type as never;
  if (req.query.deal) where.dealId = String(req.query.deal);
  if (req.query.lead) where.leadId = String(req.query.lead);
  if (req.query.contact) where.contactId = String(req.query.contact);
  if (req.query.owner) where.ownerId = String(req.query.owner);
  if (req.query.isCompleted !== undefined) where.isCompleted = req.query.isCompleted === 'true';
  const or = searchOr(['subject'], req.query.search);
  if (or) where.OR = or as Prisma.ActivityWhereInput[];

  const [items, total] = await Promise.all([
    prisma.activity.findMany({ where, orderBy: parseSort(req.query.sort), skip, take: limit, include: INCLUDE }),
    prisma.activity.count({ where }),
  ]);

  res.json({ success: true, data: items.map(toResponse), pagination: paginationMeta(page, limit, total) });
});

export const getOne = catchAsync(async (req: Request, res: Response) => {
  const activity = await prisma.activity.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId }, include: INCLUDE });
  if (!activity) throw AppError.notFound('Activity not found');
  res.json({ success: true, data: toResponse(activity) });
});

export const create = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const body = req.body as Record<string, unknown>;
  const activity = await prisma.activity.create({
    data: {
      organizationId: orgId,
      type: body.type as never,
      subject: body.subject as string,
      body: body.body as string | undefined,
      dealId: (body.deal as string | undefined) || undefined,
      leadId: (body.lead as string | undefined) || undefined,
      contactId: (body.contact as string | undefined) || undefined,
      companyId: (body.company as string | undefined) || undefined,
      ownerId: (body.owner as string | undefined) || req.user!.id,
      assignedToId: (body.assignedTo as string | undefined) || undefined,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt as string) : undefined,
      isCompleted: (body.isCompleted as boolean) ?? false,
      direction: body.direction as never,
      createdById: req.user!.id,
    },
    include: INCLUDE,
  });

  await writeAuditLog({
    organization: orgId,
    actorType: 'user',
    actor: req.user!.id,
    action: 'activity.created',
    entityType: 'Activity',
    entityId: activity.id,
    after: activity as unknown as Record<string, unknown>,
  });

  await bumpLastActivity(activity);

  res.status(201).json({ success: true, data: toResponse(activity) });
});

export const update = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const existing = await prisma.activity.findFirst({ where: { id: req.params.id, organizationId: orgId } });
  if (!existing) throw AppError.notFound('Activity not found');

  const body = req.body as Record<string, unknown>;
  const data: Prisma.ActivityUncheckedUpdateInput = {};
  if (body.type !== undefined) data.type = body.type as never;
  if (body.subject !== undefined) data.subject = body.subject as string;
  if (body.body !== undefined) data.body = body.body as string;
  if (body.deal !== undefined) data.dealId = (body.deal as string) || null;
  if (body.lead !== undefined) data.leadId = (body.lead as string) || null;
  if (body.contact !== undefined) data.contactId = (body.contact as string) || null;
  if (body.company !== undefined) data.companyId = (body.company as string) || null;
  if (body.assignedTo !== undefined) data.assignedToId = (body.assignedTo as string) || null;
  if (body.scheduledAt !== undefined) data.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt as string) : null;
  if (body.isCompleted !== undefined) data.isCompleted = body.isCompleted as boolean;
  if (body.direction !== undefined) data.direction = body.direction as never;
  if (body.completedAt !== undefined) data.completedAt = body.completedAt ? new Date(body.completedAt as string) : null;

  const activity = await prisma.activity.update({ where: { id: req.params.id }, data, include: INCLUDE });

  await writeAuditLog({
    organization: orgId,
    actorType: 'user',
    actor: req.user!.id,
    action: 'activity.updated',
    entityType: 'Activity',
    entityId: activity.id,
    before: existing as unknown as Record<string, unknown>,
    after: activity as unknown as Record<string, unknown>,
  });

  await bumpLastActivity(activity);

  res.json({ success: true, data: toResponse(activity) });
});

export const remove = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const existing = await prisma.activity.findFirst({ where: { id: req.params.id, organizationId: orgId } });
  if (!existing) throw AppError.notFound('Activity not found');
  await prisma.activity.delete({ where: { id: req.params.id } });

  await writeAuditLog({
    organization: orgId,
    actorType: 'user',
    actor: req.user!.id,
    action: 'activity.deleted',
    entityType: 'Activity',
    entityId: req.params.id,
    before: existing as unknown as Record<string, unknown>,
  });

  res.json({ success: true, data: { id: req.params.id } });
});
