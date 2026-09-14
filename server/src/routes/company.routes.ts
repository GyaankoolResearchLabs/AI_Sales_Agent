import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { companySchema } from '../validators/crm.validators';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { writeAuditLog } from '../services/audit.service';
import { prisma } from '../config/prisma';
import { toRefLite, parsePagination, parseSort, paginationMeta, searchOr } from '../utils/prismaCrud';
import { Prisma } from '@prisma/client';

const router = Router();
router.use(requireAuth);

function toResponse(c: Prisma.CompanyGetPayload<{ include: { owner: { select: { id: true; name: true } } } }>) {
  return {
    _id: c.id,
    organization: c.organizationId,
    name: c.name,
    industry: c.industry ?? undefined,
    website: c.website ?? undefined,
    employees: c.employees ?? undefined,
    location: c.location ?? undefined,
    notes: c.notes ?? undefined,
    owner: toRefLite(c.owner),
    customFields: c.customFields,
    createdBy: c.createdById,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

const OWNER_INCLUDE = { owner: { select: { id: true, name: true } } } as const;

router.get(
  '/',
  catchAsync(async (req, res) => {
    const orgId = req.user!.organizationId;
    const { page, limit, skip } = parsePagination(req);
    const where: Prisma.CompanyWhereInput = { organizationId: orgId };
    if (req.query.owner) where.ownerId = String(req.query.owner);
    const or = searchOr(['name', 'industry', 'website'], req.query.search);
    if (or) where.OR = or as Prisma.CompanyWhereInput[];

    const [items, total] = await Promise.all([
      prisma.company.findMany({ where, orderBy: parseSort(req.query.sort), skip, take: limit, include: OWNER_INCLUDE }),
      prisma.company.count({ where }),
    ]);

    res.json({ success: true, data: items.map(toResponse), pagination: paginationMeta(page, limit, total) });
  })
);

router.post(
  '/',
  validateBody(companySchema),
  catchAsync(async (req, res) => {
    const orgId = req.user!.organizationId;
    const body = req.body as Record<string, unknown>;
    const company = await prisma.company.create({
      data: {
        organizationId: orgId,
        name: body.name as string,
        industry: body.industry as string | undefined,
        website: body.website as string | undefined,
        employees: body.employees as number | undefined,
        location: body.location as string | undefined,
        notes: body.notes as string | undefined,
        ownerId: (body.owner as string | undefined) || undefined,
        customFields: (body.customFields as Prisma.InputJsonValue) ?? {},
        createdById: req.user!.id,
      },
      include: OWNER_INCLUDE,
    });

    await writeAuditLog({
      organization: orgId,
      actorType: 'user',
      actor: req.user!.id,
      action: 'company.created',
      entityType: 'Company',
      entityId: company.id,
      after: company as unknown as Record<string, unknown>,
    });

    res.status(201).json({ success: true, data: toResponse(company) });
  })
);

router.get(
  '/:id',
  catchAsync(async (req, res) => {
    const company = await prisma.company.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId }, include: OWNER_INCLUDE });
    if (!company) throw AppError.notFound('Company not found');
    res.json({ success: true, data: toResponse(company) });
  })
);

router.patch(
  '/:id',
  validateBody(companySchema.partial()),
  catchAsync(async (req, res) => {
    const orgId = req.user!.organizationId;
    const existing = await prisma.company.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!existing) throw AppError.notFound('Company not found');

    const body = req.body as Record<string, unknown>;
    const data: Prisma.CompanyUncheckedUpdateInput = {};
    if (body.name !== undefined) data.name = body.name as string;
    if (body.industry !== undefined) data.industry = body.industry as string;
    if (body.website !== undefined) data.website = body.website as string;
    if (body.employees !== undefined) data.employees = body.employees as number;
    if (body.location !== undefined) data.location = body.location as string;
    if (body.notes !== undefined) data.notes = body.notes as string;
    if (body.owner !== undefined) data.ownerId = (body.owner as string) || null;
    if (body.customFields !== undefined) data.customFields = body.customFields as Prisma.InputJsonValue;

    const company = await prisma.company.update({ where: { id: req.params.id }, data, include: OWNER_INCLUDE });

    await writeAuditLog({
      organization: orgId,
      actorType: 'user',
      actor: req.user!.id,
      action: 'company.updated',
      entityType: 'Company',
      entityId: company.id,
      before: existing as unknown as Record<string, unknown>,
      after: company as unknown as Record<string, unknown>,
    });

    res.json({ success: true, data: toResponse(company) });
  })
);

router.delete(
  '/:id',
  catchAsync(async (req, res) => {
    const orgId = req.user!.organizationId;
    const existing = await prisma.company.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!existing) throw AppError.notFound('Company not found');
    await prisma.company.delete({ where: { id: req.params.id } });

    await writeAuditLog({
      organization: orgId,
      actorType: 'user',
      actor: req.user!.id,
      action: 'company.deleted',
      entityType: 'Company',
      entityId: req.params.id,
      before: existing as unknown as Record<string, unknown>,
    });

    res.json({ success: true, data: { id: req.params.id } });
  })
);

router.get(
  '/:id/contacts',
  catchAsync(async (req, res) => {
    const company = await prisma.company.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
    if (!company) throw AppError.notFound('Company not found');
    const contacts = await prisma.contact.findMany({ where: { organizationId: req.user!.organizationId, companyId: company.id } });
    res.json({ success: true, data: contacts.map((c) => ({ ...c, _id: c.id })) });
  })
);

router.get(
  '/:id/deals',
  catchAsync(async (req, res) => {
    const company = await prisma.company.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
    if (!company) throw AppError.notFound('Company not found');
    const deals = await prisma.deal.findMany({ where: { organizationId: req.user!.organizationId, companyId: company.id } });
    res.json({ success: true, data: deals.map((d) => ({ ...d, _id: d.id })) });
  })
);

export default router;
