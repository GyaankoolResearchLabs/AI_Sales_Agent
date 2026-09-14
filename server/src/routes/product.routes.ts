import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { productSchema } from '../validators/crm.validators';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { writeAuditLog } from '../services/audit.service';
import { prisma } from '../config/prisma';
import { parsePagination, parseSort, paginationMeta, searchOr } from '../utils/prismaCrud';
import { Prisma } from '@prisma/client';

const router = Router();
router.use(requireAuth);

function toResponse(p: { id: string; organizationId: string; name: string; description: string | null; price: number; currency: string; sku: string | null; isActive: boolean; createdAt: Date; updatedAt: Date }) {
  return {
    _id: p.id,
    organization: p.organizationId,
    name: p.name,
    description: p.description ?? undefined,
    price: p.price,
    currency: p.currency,
    sku: p.sku ?? undefined,
    isActive: p.isActive,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

router.get(
  '/',
  catchAsync(async (req, res) => {
    const orgId = req.user!.organizationId;
    const { page, limit, skip } = parsePagination(req);
    const where: Prisma.ProductWhereInput = { organizationId: orgId };
    if (req.query.isActive !== undefined) where.isActive = req.query.isActive === 'true';
    const or = searchOr(['name', 'sku'], req.query.search);
    if (or) where.OR = or as Prisma.ProductWhereInput[];

    const [items, total] = await Promise.all([
      prisma.product.findMany({ where, orderBy: parseSort(req.query.sort, 'name'), skip, take: limit }),
      prisma.product.count({ where }),
    ]);

    res.json({ success: true, data: items.map(toResponse), pagination: paginationMeta(page, limit, total) });
  })
);

router.post(
  '/',
  validateBody(productSchema),
  catchAsync(async (req, res) => {
    const orgId = req.user!.organizationId;
    const body = req.body as Record<string, unknown>;
    const product = await prisma.product.create({
      data: {
        organizationId: orgId,
        name: body.name as string,
        description: body.description as string | undefined,
        price: (body.price as number) ?? 0,
        currency: (body.currency as string) || 'USD',
        sku: body.sku as string | undefined,
        isActive: (body.isActive as boolean) ?? true,
      },
    });

    await writeAuditLog({
      organization: orgId,
      actorType: 'user',
      actor: req.user!.id,
      action: 'product.created',
      entityType: 'Product',
      entityId: product.id,
      after: product as unknown as Record<string, unknown>,
    });

    res.status(201).json({ success: true, data: toResponse(product) });
  })
);

router.get(
  '/:id',
  catchAsync(async (req, res) => {
    const product = await prisma.product.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
    if (!product) throw AppError.notFound('Product not found');
    res.json({ success: true, data: toResponse(product) });
  })
);

router.patch(
  '/:id',
  validateBody(productSchema.partial()),
  catchAsync(async (req, res) => {
    const orgId = req.user!.organizationId;
    const existing = await prisma.product.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!existing) throw AppError.notFound('Product not found');

    const body = req.body as Record<string, unknown>;
    const data: Prisma.ProductUncheckedUpdateInput = {};
    if (body.name !== undefined) data.name = body.name as string;
    if (body.description !== undefined) data.description = body.description as string;
    if (body.price !== undefined) data.price = body.price as number;
    if (body.currency !== undefined) data.currency = body.currency as string;
    if (body.sku !== undefined) data.sku = body.sku as string;
    if (body.isActive !== undefined) data.isActive = body.isActive as boolean;

    const product = await prisma.product.update({ where: { id: req.params.id }, data });

    await writeAuditLog({
      organization: orgId,
      actorType: 'user',
      actor: req.user!.id,
      action: 'product.updated',
      entityType: 'Product',
      entityId: product.id,
      before: existing as unknown as Record<string, unknown>,
      after: product as unknown as Record<string, unknown>,
    });

    res.json({ success: true, data: toResponse(product) });
  })
);

router.delete(
  '/:id',
  catchAsync(async (req, res) => {
    const orgId = req.user!.organizationId;
    const existing = await prisma.product.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!existing) throw AppError.notFound('Product not found');
    await prisma.product.delete({ where: { id: req.params.id } });

    await writeAuditLog({
      organization: orgId,
      actorType: 'user',
      actor: req.user!.id,
      action: 'product.deleted',
      entityType: 'Product',
      entityId: req.params.id,
      before: existing as unknown as Record<string, unknown>,
    });

    res.json({ success: true, data: { id: req.params.id } });
  })
);

export default router;
