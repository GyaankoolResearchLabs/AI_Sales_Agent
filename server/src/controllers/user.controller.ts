import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { writeAuditLog } from '../services/audit.service';
import { prisma } from '../config/prisma';
import { UserRole } from '@prisma/client';

export const listUsers = catchAsync(async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    where: { organizationId: req.user!.organizationId },
    select: { id: true, name: true, email: true, role: true, title: true, avatarColor: true, isActive: true, lastLoginAt: true, createdAt: true, updatedAt: true },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: users });
});

export const inviteUser = catchAsync(async (req: Request, res: Response) => {
  const { name, email, role, title } = req.body as { name: string; email: string; role?: UserRole; title?: string };
  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) throw AppError.conflict('A user with this email already exists');

  // Development adapter: generates a temporary password instead of sending a real invite email
  // (see EMAIL_PROVIDER in .env — wire a production email adapter to send this instead).
  const tempPassword = Math.random().toString(36).slice(-10);
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const user = await prisma.user.create({
    data: {
      organizationId: req.user!.organizationId,
      name,
      email,
      role: role || 'sales_rep',
      title,
      passwordHash,
    },
  });

  await writeAuditLog({
    organization: req.user!.organizationId,
    actorType: 'user',
    actor: req.user!.id,
    action: 'user.invited',
    entityType: 'User',
    entityId: user.id,
  });

  res.status(201).json({
    success: true,
    data: { id: user.id, name: user.name, email: user.email, role: user.role, temporaryPassword: tempPassword },
  });
});

export const updateUser = catchAsync(async (req: Request, res: Response) => {
  const existing = await prisma.user.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
  if (!existing) throw AppError.notFound('User not found');

  const { name, role, title, isActive } = req.body as { name?: string; role?: UserRole; title?: string; isActive?: boolean };
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(title !== undefined ? { title } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
  });

  await writeAuditLog({
    organization: req.user!.organizationId,
    actorType: 'user',
    actor: req.user!.id,
    action: 'user.updated',
    entityType: 'User',
    entityId: user.id,
  });

  res.json({ success: true, data: { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive } });
});

export const removeUser = catchAsync(async (req: Request, res: Response) => {
  const existing = await prisma.user.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
  if (!existing) throw AppError.notFound('User not found');
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json({ success: true, data: { id: user.id } });
});
