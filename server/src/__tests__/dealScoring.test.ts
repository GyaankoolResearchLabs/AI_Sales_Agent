import { prisma } from '../config/prisma';
import { scoreDeal } from '../ai/dealScoring.service';
import { makeOrgAndOwner as makeOrgAndOwnerFixture } from './helpers/prismaFixtures';

async function makeOrgAndOwner() {
  return makeOrgAndOwnerFixture({ orgName: 'Score Test Co', ownerEmail: `owner-${Date.now()}-${Math.random().toString(36).slice(2)}@scoretest.example.com` });
}

describe('Deal scoring formula', () => {
  it('weights every factor to sum to 100%', async () => {
    const { org, owner } = await makeOrgAndOwner();
    const deal = await prisma.deal.create({
      data: {
        organizationId: org._id,
        name: 'Weight check',
        ownerId: owner._id,
        value: 10000,
        stageKey: 'lead',
        createdById: owner._id,
      },
    });

    const score = await scoreDeal(deal.id, org._id);
    const totalWeight = score.factors.reduce((sum, f) => sum + f.weight, 0);
    expect(totalWeight).toBe(100);

    const summedContribution = Math.round(score.factors.reduce((sum, f) => sum + f.contribution, 0) * 10) / 10;
    expect(Math.abs(summedContribution - score.probability)).toBeLessThan(0.2);
  });

  it('scores a deal with no activity and no decision maker lower than an actively engaged one', async () => {
    const { org, owner } = await makeOrgAndOwner();

    const coldDeal = await prisma.deal.create({
      data: {
        organizationId: org._id,
        name: 'Cold deal',
        ownerId: owner._id,
        value: 5000,
        stageKey: 'lead',
        createdById: owner._id,
        lastActivityAt: new Date(Date.now() - 30 * 86400000),
      },
    });

    const contact = await prisma.contact.create({
      data: {
        organizationId: org._id,
        name: 'Engaged DM',
        isDecisionMaker: true,
        createdById: owner._id,
      },
    });

    const hotDeal = await prisma.deal.create({
      data: {
        organizationId: org._id,
        name: 'Hot deal',
        ownerId: owner._id,
        primaryContactId: contact.id,
        value: 5000,
        stageKey: 'negotiation',
        createdById: owner._id,
        lastActivityAt: new Date(),
      },
    });

    // Give the hot deal several recent activities so the activity factor is strong.
    for (let i = 0; i < 4; i++) {
      await prisma.activity.create({
        data: {
          organizationId: org._id,
          type: 'call',
          subject: `Touchpoint ${i}`,
          dealId: hotDeal.id,
          ownerId: owner._id,
          isCompleted: true,
          createdById: owner._id,
        },
      });
    }

    const coldScore = await scoreDeal(coldDeal.id, org._id);
    const hotScore = await scoreDeal(hotDeal.id, org._id);

    expect(hotScore.probability).toBeGreaterThan(coldScore.probability);
    expect(coldScore.health).not.toBe('healthy');
  });

  it('never fabricates a historical rate when there are no closed deals — uses a documented neutral value', async () => {
    const { org, owner } = await makeOrgAndOwner();
    const deal = await prisma.deal.create({
      data: {
        organizationId: org._id,
        name: 'No history yet',
        ownerId: owner._id,
        value: 1000,
        stageKey: 'lead',
        createdById: owner._id,
      },
    });
    const score = await scoreDeal(deal.id, org._id);
    const historyFactor = score.factors.find((f) => f.key === 'historical_rate');
    expect(historyFactor?.detail).toMatch(/no closed deals/i);
  });
});
