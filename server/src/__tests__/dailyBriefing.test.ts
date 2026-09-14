import { prisma } from '../config/prisma';
import { getAtRiskDeals } from '../services/dailyBriefing.service';
import { makeOrgAndOwner as makeOrgAndOwnerFixture } from './helpers/prismaFixtures';

async function makeOrgAndOwner() {
  return makeOrgAndOwnerFixture({ orgName: 'Briefing Test Co', ownerEmail: `owner-${Date.now()}-${Math.random().toString(36).slice(2)}@briefingtest.example.com` });
}

describe('Daily Briefing — At-Risk Deals', () => {
  it('flags a deal with no activity in 8 days and excludes one with activity yesterday', async () => {
    const { org, owner } = await makeOrgAndOwner();

    const staleDeal = await prisma.deal.create({
      data: {
        organizationId: org._id,
        name: 'Stale deal',
        ownerId: owner._id,
        value: 10000,
        stageKey: 'qualified',
        createdById: owner._id,
        lastActivityAt: new Date(Date.now() - 8 * 86400000),
      },
    });

    const freshDeal = await prisma.deal.create({
      data: {
        organizationId: org._id,
        name: 'Fresh deal',
        ownerId: owner._id,
        value: 20000,
        stageKey: 'qualified',
        createdById: owner._id,
        lastActivityAt: new Date(Date.now() - 1 * 86400000),
      },
    });

    const atRisk = await getAtRiskDeals(org._id);
    const ids = atRisk.map((d) => d.dealId);

    expect(ids).toContain(staleDeal.id);
    expect(ids).not.toContain(freshDeal.id);

    const staleItem = atRisk.find((d) => d.dealId === staleDeal.id);
    expect(staleItem?.daysSinceActivity).toBe(8);
    expect(staleItem?.reason).toMatch(/no activity for 8 days/i);
  });

  it('excludes won/lost deals from at-risk even if stale', async () => {
    const { org, owner } = await makeOrgAndOwner();

    await prisma.deal.create({
      data: {
        organizationId: org._id,
        name: 'Old won deal',
        ownerId: owner._id,
        value: 5000,
        stageKey: 'won',
        createdById: owner._id,
        lastActivityAt: new Date(Date.now() - 60 * 86400000),
        wonAt: new Date(Date.now() - 60 * 86400000),
      },
    });

    const atRisk = await getAtRiskDeals(org._id);
    expect(atRisk.find((d) => d.dealName === 'Old won deal')).toBeUndefined();
  });

  it('treats a deal that has never had any activity as at-risk based on its creation date', async () => {
    const { org, owner } = await makeOrgAndOwner();

    const neverContacted = await prisma.deal.create({
      data: {
        organizationId: org._id,
        name: 'Never contacted',
        ownerId: owner._id,
        value: 3000,
        stageKey: 'lead',
        createdById: owner._id,
      },
    });
    // Force createdAt into the past — Prisma's @default(now())/@updatedAt won't let a normal
    // update touch createdAt, so update it directly via a raw query, same idea as the old
    // Mongoose-timestamps workaround this test used before the Postgres migration.
    await prisma.$executeRaw`UPDATE deals SET "createdAt" = ${new Date(Date.now() - 10 * 86400000)} WHERE id = ${neverContacted.id}`;

    const atRisk = await getAtRiskDeals(org._id);
    const item = atRisk.find((d) => d.dealId === neverContacted.id);
    expect(item).toBeDefined();
    expect(item?.reason).toMatch(/never contacted/i);
  });
});

describe('Daily Briefing — Due Follow-ups', () => {
  it('includes overdue and due-today activities but not completed or future ones', async () => {
    const { org, owner } = await makeOrgAndOwner();
    const { getDueFollowUps } = await import('../services/dailyBriefing.service');

    const overdue = await prisma.activity.create({
      data: {
        organizationId: org._id,
        type: 'call',
        subject: 'Overdue call',
        ownerId: owner._id,
        createdById: owner._id,
        isCompleted: false,
        scheduledAt: new Date(Date.now() - 2 * 86400000),
      },
    });

    const dueToday = await prisma.activity.create({
      data: {
        organizationId: org._id,
        type: 'email',
        subject: 'Due today email',
        ownerId: owner._id,
        createdById: owner._id,
        isCompleted: false,
        scheduledAt: new Date(),
      },
    });

    await prisma.activity.create({
      data: {
        organizationId: org._id,
        type: 'call',
        subject: 'Already done',
        ownerId: owner._id,
        createdById: owner._id,
        isCompleted: true,
        scheduledAt: new Date(Date.now() - 3 * 86400000),
      },
    });

    await prisma.activity.create({
      data: {
        organizationId: org._id,
        type: 'meeting',
        subject: 'Future meeting',
        ownerId: owner._id,
        createdById: owner._id,
        isCompleted: false,
        scheduledAt: new Date(Date.now() + 5 * 86400000),
      },
    });

    const dueFollowUps = await getDueFollowUps(org._id);
    const subjects = dueFollowUps.map((f) => f.subject);

    expect(subjects).toContain('Overdue call');
    expect(subjects).toContain('Due today email');
    expect(subjects).not.toContain('Already done');
    expect(subjects).not.toContain('Future meeting');

    const overdueItem = dueFollowUps.find((f) => f.activityId === overdue.id);
    expect(overdueItem?.reason).toMatch(/overdue by 2 days/i);
    const todayItem = dueFollowUps.find((f) => f.activityId === dueToday.id);
    expect(todayItem?.reason).toMatch(/due today/i);
  });
});
