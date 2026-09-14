import { prisma } from '../config/prisma';
import { detectAnomalies } from '../ai/anomalyDetection.service';
import { makeOrgAndOwner } from './helpers/prismaFixtures';

describe('Anomaly detection — deduplication', () => {
  it('does not create a second insight for a deal that already has an open one for the same trigger', async () => {
    const { org, owner } = await makeOrgAndOwner({ orgName: 'Anomaly Test Co', ownerEmail: `owner-${Date.now()}-${Math.random().toString(36).slice(2)}@anomalytest.example.com` });

    const deal = await prisma.deal.create({
      data: {
        organizationId: org._id,
        name: 'Stale deal for anomaly test',
        ownerId: owner._id,
        value: 5000,
        stageKey: 'qualified',
        createdById: owner._id,
        lastActivityAt: new Date(Date.now() - 9 * 86400000), // 9 days ago -> triggers "no_activity"
      },
    });

    const firstRunCount = await detectAnomalies(org._id);
    expect(firstRunCount).toBeGreaterThan(0);

    const insightsAfterFirstRun = await prisma.aIInsight.findMany({ where: { organizationId: org._id, dealId: deal.id, type: 'no_activity' } });
    expect(insightsAfterFirstRun.length).toBe(1);
    const firstInsightId = insightsAfterFirstRun[0].id;

    // Run again with the same underlying condition still true.
    await detectAnomalies(org._id);

    const insightsAfterSecondRun = await prisma.aIInsight.findMany({ where: { organizationId: org._id, dealId: deal.id, type: 'no_activity' } });
    expect(insightsAfterSecondRun.length).toBe(1); // still exactly one, not two
    expect(insightsAfterSecondRun[0].id).toBe(firstInsightId); // same row, updated in place

    // Run a third time for good measure.
    await detectAnomalies(org._id);
    const insightsAfterThirdRun = await prisma.aIInsight.findMany({ where: { organizationId: org._id, dealId: deal.id, type: 'no_activity' } });
    expect(insightsAfterThirdRun.length).toBe(1);
  });

  it('removes the insight once the underlying condition is resolved (activity logged)', async () => {
    const { org, owner } = await makeOrgAndOwner({ orgName: 'Anomaly Resolve Co', ownerEmail: `owner-${Date.now()}-${Math.random().toString(36).slice(2)}@anomalyresolve.example.com` });

    const deal = await prisma.deal.create({
      data: {
        organizationId: org._id,
        name: 'Deal that gets fixed',
        ownerId: owner._id,
        value: 5000,
        stageKey: 'qualified',
        createdById: owner._id,
        lastActivityAt: new Date(Date.now() - 10 * 86400000),
      },
    });

    await detectAnomalies(org._id);
    expect((await prisma.aIInsight.findMany({ where: { organizationId: org._id, dealId: deal.id, type: 'no_activity' } })).length).toBe(1);

    // Simulate the deal getting fresh activity.
    await prisma.deal.update({ where: { id: deal.id }, data: { lastActivityAt: new Date() } });

    await detectAnomalies(org._id);
    expect((await prisma.aIInsight.findMany({ where: { organizationId: org._id, dealId: deal.id, type: 'no_activity' } })).length).toBe(0);
  });
});
