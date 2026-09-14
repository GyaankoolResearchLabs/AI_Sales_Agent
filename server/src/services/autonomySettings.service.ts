import { prisma } from '../config/prisma';
import { PermissionMode, Prisma, AutonomySettings as PrismaAutonomySettings } from '@prisma/client';

export type AutonomyLevel = 1 | 2 | 3 | 4;
export type PermissionCategory =
  | 'emailSending'
  | 'whatsappSending'
  | 'crmUpdates'
  | 'meetingScheduling'
  | 'proposalCreation'
  | 'taskCreation';

const PERMISSION_CATEGORIES: PermissionCategory[] = [
  'emailSending',
  'whatsappSending',
  'crmUpdates',
  'meetingScheduling',
  'proposalCreation',
  'taskCreation',
];

export interface AutonomyPermissions {
  emailSending: PermissionMode;
  whatsappSending: PermissionMode;
  crmUpdates: PermissionMode;
  meetingScheduling: PermissionMode;
  proposalCreation: PermissionMode;
  taskCreation: PermissionMode;
}

/**
 * Response/consumer shape kept identical to the old Mongoose document
 * ({ organization, level, permissions: {...}, updatedBy }) so the frontend
 * and every call site written against that shape keeps working unchanged
 * even though the real storage is now flat Prisma columns.
 */
export interface AutonomySettingsView {
  id: string;
  _id: string;
  organization: string;
  level: number;
  permissions: AutonomyPermissions;
  updatedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toView(row: PrismaAutonomySettings): AutonomySettingsView {
  return {
    id: row.id,
    _id: row.id,
    organization: row.organizationId,
    level: row.level,
    permissions: {
      emailSending: row.emailSending,
      whatsappSending: row.whatsappSending,
      crmUpdates: row.crmUpdates,
      meetingScheduling: row.meetingScheduling,
      proposalCreation: row.proposalCreation,
      taskCreation: row.taskCreation,
    },
    updatedBy: row.updatedById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Real lookup — returns null if the organization has no row yet (should not happen for orgs created after this migration; signup always creates one). */
export async function getAutonomySettings(orgId: string): Promise<AutonomySettingsView | null> {
  const row = await prisma.autonomySettings.findUnique({ where: { organizationId: orgId } });
  return row ? toView(row) : null;
}

/** Convenience for permission-gate checks — defaults to 'approval_required' (the safe default) when no row exists. */
export async function getLevelAndPermission(
  orgId: string,
  category: PermissionCategory
): Promise<{ level: number; permission: PermissionMode }> {
  const row = await prisma.autonomySettings.findUnique({ where: { organizationId: orgId } });
  return { level: row?.level ?? 1, permission: row ? row[category] : 'approval_required' };
}

export async function createDefaultAutonomySettings(orgId: string): Promise<AutonomySettingsView> {
  const row = await prisma.autonomySettings.create({ data: { organizationId: orgId } });
  return toView(row);
}

/** Upserts level/permissions (partial) for an org, stamping who changed it. Creates the row with defaults + the patch if it doesn't exist yet. */
export async function upsertAutonomySettings(
  orgId: string,
  updatedBy: string,
  patch: { level?: number; permissions?: Partial<AutonomyPermissions> }
): Promise<AutonomySettingsView> {
  const permissionFields: Partial<Record<PermissionCategory, PermissionMode>> = {};
  if (patch.permissions) {
    for (const key of PERMISSION_CATEGORIES) {
      if (patch.permissions[key] !== undefined) permissionFields[key] = patch.permissions[key];
    }
  }

  const updateData: Prisma.AutonomySettingsUncheckedUpdateInput = { updatedById: updatedBy, ...permissionFields };
  if (patch.level !== undefined) updateData.level = patch.level;

  const createData: Prisma.AutonomySettingsUncheckedCreateInput = {
    organizationId: orgId,
    updatedById: updatedBy,
    level: patch.level ?? 1,
    ...permissionFields,
  };

  const row = await prisma.autonomySettings.upsert({
    where: { organizationId: orgId },
    update: updateData,
    create: createData,
  });
  return toView(row);
}
