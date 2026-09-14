import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { prisma } from '../config/prisma';
import { DEFAULT_DEAL_STAGES, DEFAULT_ACTIVITY_TYPES } from '../config/organizationDefaults'; // plain data constants only, no Mongoose runtime dependency
import { createDefaultAutonomySettings } from '../services/autonomySettings.service';
import { signAccessToken, signRefreshToken } from '../middleware/auth';
import { env } from '../config/env';
import { writeAuditLog } from '../services/audit.service';

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function issueSession(res: Response, userId: string, orgId: string, role: string, req: Request) {
  const accessToken = signAccessToken({ sub: userId, org: orgId, role: role as never });
  const refreshToken = signRefreshToken({ sub: userId, version: 0 });

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      expiresAt: new Date(Date.now() + REFRESH_COOKIE_MAX_AGE_MS),
    },
  });

  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: '/api/auth',
  });

  return accessToken;
}

export const signup = catchAsync(async (req: Request, res: Response) => {
  const { name, email, password, organizationName } = req.body;

  // Preserves the original behavior exactly: email uniqueness is checked globally
  // here at the application layer, even though the DB constraint is scoped to
  // (organizationId, email) — that's intentional, not a migration oversight.
  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) throw AppError.conflict('An account with this email already exists');

  const organization = await prisma.organization.create({
    data: {
      name: organizationName,
      // Mongoose populated these via schema-level array defaults; Prisma child
      // tables need them created explicitly to preserve the same "new org
      // starts with a sensible default pipeline" behavior.
      dealStages: { create: DEFAULT_DEAL_STAGES.map(({ key, label, order, probability, isWon, isLost }) => ({ key, label, order, probability, isWon, isLost })) },
      activityTypes: { create: DEFAULT_ACTIVITY_TYPES.map(({ key, label, icon }) => ({ key, label, icon })) },
    },
  });

  // Real permission defaults (level 1, everything approval_required) — the Prisma
  // AutonomySettings table, now the single real store for autonomy permissions
  // (recommendation/approval controllers, approval.service.ts, nextBestAction.service.ts
  // all read/write it via services/autonomySettings.service.ts).
  await createDefaultAutonomySettings(organization.id);

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name,
      email,
      passwordHash,
      role: 'admin',
    },
  });

  await writeAuditLog({
    organization: organization.id,
    actorType: 'user',
    actor: user.id,
    action: 'user.signed_up',
    entityType: 'User',
    entityId: user.id,
  });

  const accessToken = await issueSession(res, user.id, organization.id, user.role, req);

  res.status(201).json({
    success: true,
    data: {
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      organization: { id: organization.id, name: organization.name, onboardingCompleted: organization.onboardingCompleted },
    },
  });
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await prisma.user.findFirst({ where: { email } });
  if (!user || !user.isActive) throw AppError.unauthorized('Invalid email or password');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw AppError.unauthorized('Invalid email or password');

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const organization = await prisma.organization.findUnique({ where: { id: user.organizationId } });

  const accessToken = await issueSession(res, user.id, user.organizationId, user.role, req);

  res.json({
    success: true,
    data: {
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      organization: organization
        ? { id: organization.id, name: organization.name, onboardingCompleted: organization.onboardingCompleted }
        : null,
    },
  });
});

export const refresh = catchAsync(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw AppError.unauthorized('No refresh token');

  let decoded: { sub: string };
  try {
    decoded = jwt.verify(token, env.jwtRefreshSecret) as { sub: string };
  } catch {
    throw AppError.unauthorized('Invalid refresh token');
  }

  const stored = await prisma.refreshToken.findFirst({ where: { userId: decoded.sub, tokenHash: hashToken(token) } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw AppError.unauthorized('Refresh token expired or revoked');
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
  if (!user || !user.isActive) throw AppError.unauthorized('User no longer active');

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

  const accessToken = await issueSession(res, user.id, user.organizationId, user.role, req);

  res.json({ success: true, data: { accessToken } });
});

export const logout = catchAsync(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
  }
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.json({ success: true, data: null });
});

export const me = catchAsync(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) throw AppError.notFound('User not found');
  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    include: { dealStages: true, activityTypes: true, customFields: true },
  });

  res.json({
    success: true,
    data: {
      user: { id: user.id, name: user.name, email: user.email, role: user.role, title: user.title, avatarColor: user.avatarColor },
      organization,
    },
  });
});
