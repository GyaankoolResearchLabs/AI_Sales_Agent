import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { taskSchema } from '../validators/crm.validators';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { writeAuditLog } from '../services/audit.service';
import { prisma } from '../config/prisma';
import { toRefLite, parsePagination, parseSort, paginationMeta, searchOr } from '../utils/prismaCrud';

const router = Router();
router.use(requireAuth);

const INCLUDE = { assignedTo: { select: { id: true, name: true } } } as const;

function toResponse(t: Prisma.TaskGetPayload<{ include: typeof INCLUDE }>) {
  return {
    _id: t.id,
    organization: t.organizationId,
    title: t.title,
    description: t.description ?? undefined,
    deal: t.dealId ?? undefined,
    lead: t.leadId ?? undefined,
    contact: t.contactId ?? undefined,
    assignedTo: toRefLite(t.assignedTo),
    dueDate: t.dueDate ?? undefined,
    priority: t.priority,
    status: t.status,
    completedAt: t.completedAt ?? undefined,
    createdByAI: t.createdByAI,
    createdBy: t.createdById,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

router.get(
  '/',
  catchAsync(async (req, res) => {
    const orgId = req.user!.organizationId;
    const { page, limit, skip } = parsePagination(req);
    const where: Prisma.TaskWhereInput = { organizationId: orgId };
    if (req.query.status) where.status = req.query.status as never;
    if (req.query.priority) where.priority = req.query.priority as never;
    if (req.query.assignedTo) where.assignedToId = String(req.query.assignedTo);
    if (req.query.deal) where.dealId = String(req.query.deal);
    const or = searchOr(['title'], req.query.search);
    if (or) where.OR = or as Prisma.TaskWhereInput[];

    const [items, total] = await Promise.all([
      prisma.task.findMany({ where, orderBy: parseSort(req.query.sort, 'dueDate'), skip, take: limit, include: INCLUDE }),
      prisma.task.count({ where }),
    ]);

    res.json({ success: true, data: items.map(toResponse), pagination: paginationMeta(page, limit, total) });
  })
);

router.post(
  '/',
  validateBody(taskSchema),
  catchAsync(async (req, res) => {
    const orgId = req.user!.organizationId;
    const body = req.body as Record<string, unknown>;
    const task = await prisma.task.create({
      data: {
        organizationId: orgId,
        title: body.title as string,
        description: body.description as string | undefined,
        dealId: (body.deal as string | undefined) || undefined,
        leadId: (body.lead as string | undefined) || undefined,
        contactId: (body.contact as string | undefined) || undefined,
        assignedToId: body.assignedTo as string,
        dueDate: body.dueDate ? new Date(body.dueDate as string) : undefined,
        priority: (body.priority as never) || 'medium',
        status: (body.status as never) || 'open',
        createdById: req.user!.id,
      },
      include: INCLUDE,
    });

    await writeAuditLog({
      organization: orgId,
      actorType: 'user',
      actor: req.user!.id,
      action: 'task.created',
      entityType: 'Task',
      entityId: task.id,
      after: task as unknown as Record<string, unknown>,
    });

    res.status(201).json({ success: true, data: toResponse(task) });
  })
);

router.get(
  '/:id',
  catchAsync(async (req, res) => {
    const task = await prisma.task.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId }, include: INCLUDE });
    if (!task) throw AppError.notFound('Task not found');
    res.json({ success: true, data: toResponse(task) });
  })
);

router.patch(
  '/:id',
  validateBody(taskSchema.partial()),
  catchAsync(async (req, res) => {
    const orgId = req.user!.organizationId;
    const existing = await prisma.task.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!existing) throw AppError.notFound('Task not found');

    const body = req.body as Record<string, unknown>;
    const data: Prisma.TaskUncheckedUpdateInput = {};
    if (body.title !== undefined) data.title = body.title as string;
    if (body.description !== undefined) data.description = body.description as string;
    if (body.deal !== undefined) data.dealId = (body.deal as string) || null;
    if (body.lead !== undefined) data.leadId = (body.lead as string) || null;
    if (body.contact !== undefined) data.contactId = (body.contact as string) || null;
    if (body.assignedTo !== undefined) data.assignedToId = body.assignedTo as string;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate as string) : null;
    if (body.priority !== undefined) data.priority = body.priority as never;
    if (body.status !== undefined) data.status = body.status as never;

    const task = await prisma.task.update({ where: { id: req.params.id }, data, include: INCLUDE });

    await writeAuditLog({
      organization: orgId,
      actorType: 'user',
      actor: req.user!.id,
      action: 'task.updated',
      entityType: 'Task',
      entityId: task.id,
      before: existing as unknown as Record<string, unknown>,
      after: task as unknown as Record<string, unknown>,
    });

    res.json({ success: true, data: toResponse(task) });
  })
);

router.delete(
  '/:id',
  catchAsync(async (req, res) => {
    const orgId = req.user!.organizationId;
    const existing = await prisma.task.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!existing) throw AppError.notFound('Task not found');
    await prisma.task.delete({ where: { id: req.params.id } });

    await writeAuditLog({
      organization: orgId,
      actorType: 'user',
      actor: req.user!.id,
      action: 'task.deleted',
      entityType: 'Task',
      entityId: req.params.id,
      before: existing as unknown as Record<string, unknown>,
    });

    res.json({ success: true, data: { id: req.params.id } });
  })
);

router.post(
  '/:id/complete',
  catchAsync(async (req, res) => {
    const orgId = req.user!.organizationId;
    const existing = await prisma.task.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!existing) throw AppError.notFound('Task not found');
    const task = await prisma.task.update({ where: { id: req.params.id }, data: { status: 'completed', completedAt: new Date() }, include: INCLUDE });
    res.json({ success: true, data: toResponse(task) });
  })
);

export default router;
