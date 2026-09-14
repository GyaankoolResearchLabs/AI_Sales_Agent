import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { prisma } from '../config/prisma';
import { UserRole } from '@prisma/client';

export type { UserRole };

export interface AccessTokenPayload {
  sub: string; // user id
  org: string; // organization id
  role: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        organizationId: string;
        role: UserRole;
      };
    }
  }
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtAccessTtl } as jwt.SignOptions);
}

export function signRefreshToken(payload: { sub: string; version: number }): string {
  return jwt.sign(payload, env.jwtRefreshSecret, { expiresIn: env.jwtRefreshTtl } as jwt.SignOptions);
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw AppError.unauthorized('Missing access token');

    const decoded = jwt.verify(token, env.jwtSecret) as AccessTokenPayload;

    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user || !user.isActive) throw AppError.unauthorized('User no longer active');
    if (user.organizationId !== decoded.org) throw AppError.unauthorized('Invalid session');

    req.user = { id: user.id, organizationId: user.organizationId, role: user.role };
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(AppError.unauthorized('Invalid or expired access token'));
  }
}

/** Restrict a route to specific roles. Admins & directors typically pass every gate implicitly where noted. */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };
}

export const managerUp = requireRole('sales_manager', 'sales_director', 'admin');
export const directorUp = requireRole('sales_director', 'admin');
export const adminOnly = requireRole('admin');
