import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { prisma } from '../config/prisma';

const router = Router();
router.use(requireAuth);

function toResponse(n: Prisma.NotificationGetPayload<true>) {
  return {
    _id: n.id,
    organization: n.organizationId,
    user: n.userId,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link ?? undefined,
    isRead: n.isRead,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  };
}

router.get(
  '/',
  catchAsync(async (req, res) => {
    const where: Prisma.NotificationWhereInput = { organizationId: req.user!.organizationId, userId: req.user!.id };
    if (req.query.unreadOnly === 'true') where.isRead = false;
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.notification.count({ where: { organizationId: req.user!.organizationId, userId: req.user!.id, isRead: false } }),
    ]);
    res.json({ success: true, data: notifications.map(toResponse), unreadCount });
  })
);

router.post(
  '/:id/read',
  catchAsync(async (req, res) => {
    const existing = await prisma.notification.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!existing) throw AppError.notFound('Notification not found');
    const n = await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true } });
    res.json({ success: true, data: toResponse(n) });
  })
);

router.post(
  '/read-all',
  catchAsync(async (req, res) => {
    await prisma.notification.updateMany({ where: { organizationId: req.user!.organizationId, userId: req.user!.id, isRead: false }, data: { isRead: true } });
    res.json({ success: true, data: null });
  })
);

export default router;
