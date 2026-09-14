import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { contactSchema } from '../validators/crm.validators';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { writeAuditLog } from '../services/audit.service';
import { prisma } from '../config/prisma';
import { toRefLite, parsePagination, parseSort, paginationMeta, searchOr } from '../utils/prismaCrud';
import { Prisma } from '@prisma/client';

const router = Router();
router.use(requireAuth);

const INCLUDE = { owner: { select: { id: true, name: true } }, company: { select: { id: true, name: true } } } as const;

function toResponse(c: Prisma.ContactGetPayload<{ include: typeof INCLUDE }>) {
  return {
    _id: c.id,
    organization: c.organizationId,
    name: c.name,
    email: c.email ?? undefined,
    phone: c.phone ?? undefined,
    company: toRefLite(c.company),
    jobTitle: c.jobTitle ?? undefined,
    owner: toRefLite(c.owner),
    source: c.source ?? undefined,
    tags: c.tags,
    isDecisionMaker: c.isDecisionMaker,
    customFields: c.customFields,
    createdBy: c.createdById,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

router.get(
  '/',
  catchAsync(async (req, res) => {
    const orgId = req.user!.organizationId;
    const { page, limit, skip } = parsePagination(req);
    const where: Prisma.ContactWhereInput = { organizationId: orgId };
    if (req.query.owner) where.ownerId = String(req.query.owner);
    if (req.query.company) where.companyId = String(req.query.company);
    const or = searchOr(['name', 'email', 'phone'], req.query.search);
    if (or) where.OR = or as Prisma.ContactWhereInput[];

    const [items, total] = await Promise.all([
      prisma.contact.findMany({ where, orderBy: parseSort(req.query.sort), skip, take: limit, include: INCLUDE }),
      prisma.contact.count({ where }),
    ]);

    res.json({ success: true, data: items.map(toResponse), pagination: paginationMeta(page, limit, total) });
  })
);

router.post(
  '/',
  validateBody(contactSchema),
  catchAsync(async (req, res) => {
    const orgId = req.user!.organizationId;
    const body = req.body as Record<string, unknown>;
    const contact = await prisma.contact.create({
      data: {
        organizationId: orgId,
        name: body.name as string,
        email: (body.email as string) || undefined,
        phone: body.phone as string | undefined,
        companyId: (body.company as string | undefined) || undefined,
        jobTitle: body.jobTitle as string | undefined,
        ownerId: (body.owner as string | undefined) || undefined,
        source: body.source as string | undefined,
        tags: (body.tags as string[]) ?? [],
        isDecisionMaker: (body.isDecisionMaker as boolean) ?? false,
        customFields: (body.customFields as Prisma.InputJsonValue) ?? {},
        createdById: req.user!.id,
      },
      include: INCLUDE,
    });

    await writeAuditLog({
      organization: orgId,
      actorType: 'user',
      actor: req.user!.id,
      action: 'contact.created',
      entityType: 'Contact',
      entityId: contact.id,
      after: contact as unknown as Record<string, unknown>,
    });

    res.status(201).json({ success: true, data: toResponse(contact) });
  })
);

router.get(
  '/:id',
  catchAsync(async (req, res) => {
    const contact = await prisma.contact.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId }, include: INCLUDE });
    if (!contact) throw AppError.notFound('Contact not found');
    res.json({ success: true, data: toResponse(contact) });
  })
);

router.patch(
  '/:id',
  validateBody(contactSchema.partial()),
  catchAsync(async (req, res) => {
    const orgId = req.user!.organizationId;
    const existing = await prisma.contact.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!existing) throw AppError.notFound('Contact not found');

    const body = req.body as Record<string, unknown>;
    const data: Prisma.ContactUncheckedUpdateInput = {};
    if (body.name !== undefined) data.name = body.name as string;
    if (body.email !== undefined) data.email = (body.email as string) || null;
    if (body.phone !== undefined) data.phone = body.phone as string;
    if (body.company !== undefined) data.companyId = (body.company as string) || null;
    if (body.jobTitle !== undefined) data.jobTitle = body.jobTitle as string;
    if (body.owner !== undefined) data.ownerId = (body.owner as string) || null;
    if (body.source !== undefined) data.source = body.source as string;
    if (body.tags !== undefined) data.tags = body.tags as string[];
    if (body.isDecisionMaker !== undefined) data.isDecisionMaker = body.isDecisionMaker as boolean;
    if (body.customFields !== undefined) data.customFields = body.customFields as Prisma.InputJsonValue;

    const contact = await prisma.contact.update({ where: { id: req.params.id }, data, include: INCLUDE });

    await writeAuditLog({
      organization: orgId,
      actorType: 'user',
      actor: req.user!.id,
      action: 'contact.updated',
      entityType: 'Contact',
      entityId: contact.id,
      before: existing as unknown as Record<string, unknown>,
      after: contact as unknown as Record<string, unknown>,
    });

    res.json({ success: true, data: toResponse(contact) });
  })
);

router.delete(
  '/:id',
  catchAsync(async (req, res) => {
    const orgId = req.user!.organizationId;
    const existing = await prisma.contact.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!existing) throw AppError.notFound('Contact not found');
    await prisma.contact.delete({ where: { id: req.params.id } });

    await writeAuditLog({
      organization: orgId,
      actorType: 'user',
      actor: req.user!.id,
      action: 'contact.deleted',
      entityType: 'Contact',
      entityId: req.params.id,
      before: existing as unknown as Record<string, unknown>,
    });

    res.json({ success: true, data: { id: req.params.id } });
  })
);

router.get(
  '/:id/activities',
  catchAsync(async (req, res) => {
    const contact = await prisma.contact.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
    if (!contact) throw AppError.notFound('Contact not found');
    const activities = await prisma.activity.findMany({
      where: { organizationId: req.user!.organizationId, contactId: contact.id },
      orderBy: { createdAt: 'desc' },
      include: { owner: { select: { id: true, name: true } }, assignedTo: { select: { id: true, name: true } } },
    });
    res.json({ success: true, data: activities.map((a) => ({ ...a, _id: a.id, owner: toRefLite(a.owner), assignedTo: toRefLite(a.assignedTo) })) });
  })
);

router.get(
  '/:id/conversations',
  catchAsync(async (req, res) => {
    const contact = await prisma.contact.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
    if (!contact) throw AppError.notFound('Contact not found');
    const conversations = await prisma.conversation.findMany({
      where: { organizationId: req.user!.organizationId, contactId: contact.id },
      orderBy: { occurredAt: 'desc' },
    });
    res.json({ success: true, data: conversations.map((c) => ({ ...c, _id: c.id })) });
  })
);

export default router;
