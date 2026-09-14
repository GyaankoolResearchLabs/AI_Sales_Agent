import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { prisma } from '../config/prisma';

const router = Router();
router.use(requireAuth);

const INCLUDE = { deal: { select: { id: true, name: true, value: true } }, lead: { select: { id: true, name: true } } } as const;

function toResponse(i: Prisma.AIInsightGetPayload<{ include: typeof INCLUDE }>) {
  return {
    _id: i.id,
    organization: i.organizationId,
    deal: i.deal ? { _id: i.deal.id, name: i.deal.name, value: i.deal.value } : undefined,
    lead: i.lead ? { _id: i.lead.id, name: i.lead.name } : undefined,
    type: i.type,
    severity: i.severity,
    message: i.message,
    data: i.data,
    dedupeKey: i.dedupeKey,
    isRead: i.isRead,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}

router.get(
  '/',
  catchAsync(async (req, res) => {
    const where: Prisma.AIInsightWhereInput = { organizationId: req.user!.organizationId };
    if (req.query.unreadOnly === 'true') where.isRead = false;
    const insights = await prisma.aIInsight.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100, include: INCLUDE });
    res.json({ success: true, data: insights.map(toResponse) });
  })
);

router.post(
  '/:id/read',
  catchAsync(async (req, res) => {
    const existing = await prisma.aIInsight.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
    if (!existing) throw AppError.notFound('Insight not found');
    const insight = await prisma.aIInsight.update({ where: { id: req.params.id }, data: { isRead: true }, include: INCLUDE });
    res.json({ success: true, data: toResponse(insight) });
  })
);

export default router;
