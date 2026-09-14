import { Router } from 'express';
import { requireAuth, managerUp } from '../middleware/auth';
import { catchAsync } from '../utils/catchAsync';
import { prisma } from '../config/prisma';

const router = Router();
router.use(requireAuth, managerUp);

router.get(
  '/',
  catchAsync(async (req, res) => {
    const page = Math.max(parseInt(String(req.query.page ?? '1'), 10), 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '30'), 10), 1), 100);
    const where: Record<string, unknown> = { organizationId: req.user!.organizationId };
    if (req.query.entityType) where.entityType = req.query.entityType;
    if (req.query.actorType) where.actorType = req.query.actorType;

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.auditLog.count({ where }),
    ]);

    const userIds = Array.from(new Set(items.flatMap((i) => [i.actorId, i.approvedById]).filter((v): v is string => Boolean(v))));
    const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [];
    const nameById = new Map(users.map((u) => [u.id, u.name]));
    const data = items.map((i) => ({
      ...i,
      _id: i.id,
      actor: i.actorId ? { _id: i.actorId, name: nameById.get(i.actorId) } : undefined,
      approvedBy: i.approvedById ? { _id: i.approvedById, name: nameById.get(i.approvedById) } : undefined,
    }));

    res.json({ success: true, data, pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } });
  })
);

export default router;
