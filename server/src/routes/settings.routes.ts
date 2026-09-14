import { Router } from 'express';
import { requireAuth, directorUp } from '../middleware/auth';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { prisma } from '../config/prisma';
import { autonomySettings } from '../controllers/recommendation.controller';

const router = Router();
router.use(requireAuth);

// Canonical path per spec: GET/PATCH /api/settings/autonomy (requires admin or sales_director to change).
// The controller logic is shared with the older /api/autonomy routes (kept for the existing frontend).
router.get('/autonomy', autonomySettings.get);
router.patch('/autonomy', directorUp, autonomySettings.update);

router.get(
  '/security/sessions',
  catchAsync(async (req, res) => {
    const sessions = await prisma.refreshToken.findMany({
      where: { userId: req.user!.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: sessions.map((s) => ({ id: s.id, userAgent: s.userAgent, ip: s.ip, createdAt: s.createdAt, expiresAt: s.expiresAt })) });
  })
);

router.delete(
  '/security/sessions/:id',
  catchAsync(async (req, res) => {
    const session = await prisma.refreshToken.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!session) throw AppError.notFound('Session not found');
    await prisma.refreshToken.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    res.json({ success: true, data: { id: req.params.id } });
  })
);

router.get(
  '/security',
  catchAsync(async (req, res) => {
    const org = await prisma.organization.findUnique({
      where: { id: req.user!.organizationId },
      select: { ssoEnabled: true, ipAllowlist: true },
    });
    res.json({ success: true, data: org });
  })
);

router.patch(
  '/security',
  directorUp,
  catchAsync(async (req, res) => {
    const org = await prisma.organization.update({
      where: { id: req.user!.organizationId },
      data: { ssoEnabled: req.body.ssoEnabled, ipAllowlist: req.body.ipAllowlist },
      select: { ssoEnabled: true, ipAllowlist: true },
    });
    res.json({ success: true, data: org });
  })
);

export default router;
