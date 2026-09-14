import { prisma } from '../../config/prisma';
import { DEFAULT_DEAL_STAGES, IDealStageConfig } from '../../config/organizationDefaults';

/**
 * Real Organization + User rows in Prisma/Supabase Postgres — the actual
 * store auth and Organization/User consumers read from post-migration.
 * Returns `_id` (string) alongside `id` so existing call sites written
 * against the old Mongoose `org._id` / `owner._id` shape keep working.
 */
export async function makeOrgAndOwner(opts: { orgName: string; ownerEmail: string; dealStages?: IDealStageConfig[] }) {
  const stages = opts.dealStages ?? DEFAULT_DEAL_STAGES;
  const org = await prisma.organization.create({
    data: {
      name: opts.orgName,
      dealStages: { create: stages.map(({ key, label, order, probability, isWon, isLost }) => ({ key, label, order, probability, isWon, isLost })) },
    },
  });
  const owner = await prisma.user.create({
    data: { organizationId: org.id, name: 'Owner', email: opts.ownerEmail, passwordHash: 'x', role: 'sales_rep' },
  });
  return {
    org: { ...org, _id: org.id },
    owner: { ...owner, _id: owner.id },
  };
}
