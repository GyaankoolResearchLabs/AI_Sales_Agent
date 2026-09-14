import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export type AuditActorType = 'user' | 'ai_agent' | 'system';

interface LogParams {
  organization: string;
  actorType: AuditActorType;
  actor?: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  approvalRequired?: boolean;
  approvedBy?: string;
  metadata?: Record<string, unknown>;
}

/** Migrated to Prisma/Postgres — writes to the real Supabase `audit_logs` table. */
export async function writeAuditLog(params: LogParams) {
  return prisma.auditLog.create({
    data: {
      organizationId: params.organization,
      actorType: params.actorType,
      actorId: params.actor,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      before: params.before as Prisma.InputJsonValue | undefined,
      after: params.after as Prisma.InputJsonValue | undefined,
      approvalRequired: params.approvalRequired ?? false,
      approvedById: params.approvedBy,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
