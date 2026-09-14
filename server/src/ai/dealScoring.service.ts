import { Prisma, Deal } from '@prisma/client';
import { prisma } from '../config/prisma';

const DAY_MS = 86400000;

export type DealHealth = 'healthy' | 'at_risk' | 'stalled' | 'unknown';

export interface IDealScoreFactor {
  key: string;
  label: string;
  weight: number; // percentage weight in the formula, e.g. 30
  contribution: number; // points contributed to the final score, e.g. 18
  detail: string; // human-readable explanation
}

export interface IDealScore {
  probability: number; // 0-100
  health: DealHealth;
  factors: IDealScoreFactor[];
  explanation: string;
  recommendation: string;
  calculatedAt: Date;
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Deal close-probability scoring, per the PRD formula:
 *   Close Probability = Activity(30%) + Engagement(25%) + DecisionMaker(20%) + Stage(15%) + HistoricalRate(10%)
 *
 * Every sub-score is computed from real Activity/Conversation/Contact/Deal
 * records in Postgres — nothing here is random or hardcoded. If a signal is
 * unavailable (e.g. no closed deals yet for historical rate) it falls back
 * to a clearly-labeled neutral value rather than fabricating one.
 */
export async function scoreDeal(dealId: string, orgId: string): Promise<IDealScore> {
  const deal = await prisma.deal.findFirst({ where: { id: dealId, organizationId: orgId } });
  if (!deal) throw new Error('Deal not found');

  const [activityScore, activityDetail] = await computeActivityScore(deal);
  const [engagementScore, engagementDetail] = await computeEngagementScore(deal);
  const [dmScore, dmDetail] = await computeDecisionMakerScore(deal);
  const [stageScore, stageDetail] = await computeStageScore(deal);
  const [historyScore, historyDetail] = await computeHistoricalRateScore(deal);

  const factors: IDealScoreFactor[] = [
    { key: 'activity', label: 'Activity frequency', weight: 30, contribution: round1(activityScore * 0.3), detail: activityDetail },
    { key: 'engagement', label: 'Engagement', weight: 25, contribution: round1(engagementScore * 0.25), detail: engagementDetail },
    { key: 'decision_maker', label: 'Decision maker involvement', weight: 20, contribution: round1(dmScore * 0.2), detail: dmDetail },
    { key: 'stage', label: 'Deal stage', weight: 15, contribution: round1(stageScore * 0.15), detail: stageDetail },
    { key: 'historical_rate', label: 'Historical conversion rate', weight: 10, contribution: round1(historyScore * 0.1), detail: historyDetail },
  ];

  const probability = clamp(round1(factors.reduce((sum, f) => sum + f.contribution, 0)));

  const daysSinceActivity = deal.lastActivityAt ? Math.floor((Date.now() - deal.lastActivityAt.getTime()) / DAY_MS) : null;
  const health = deriveHealth(probability, daysSinceActivity);

  const explanation = buildExplanation(factors, daysSinceActivity);
  const recommendation = buildRecommendation(health, daysSinceActivity, dmScore);

  return {
    probability,
    health,
    factors,
    explanation,
    recommendation,
    calculatedAt: new Date(),
  };
}

export async function scoreAndSaveDeal(dealId: string, orgId: string): Promise<Deal> {
  const score = await scoreDeal(dealId, orgId);
  const existing = await prisma.deal.findFirst({ where: { id: dealId, organizationId: orgId } });
  if (!existing) throw new Error('Deal not found');
  return prisma.deal.update({ where: { id: dealId }, data: { aiScore: score as unknown as Prisma.InputJsonValue } });
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function deriveHealth(probability: number, daysSinceActivity: number | null): DealHealth {
  if (daysSinceActivity !== null && daysSinceActivity >= 21) return 'stalled';
  if (daysSinceActivity !== null && daysSinceActivity >= 7) return 'at_risk';
  if (probability < 35) return 'at_risk';
  return 'healthy';
}

async function computeActivityScore(deal: Deal): Promise<[number, string]> {
  const since = new Date(Date.now() - 14 * DAY_MS);
  const count = await prisma.activity.count({ where: { organizationId: deal.organizationId, dealId: deal.id, createdAt: { gte: since } } });
  const daysSince = deal.lastActivityAt ? Math.floor((Date.now() - deal.lastActivityAt.getTime()) / DAY_MS) : null;

  let score = clamp(count * 25);
  if (daysSince !== null && daysSince > 7) {
    score = clamp(score - (daysSince - 7) * 5);
  } else if (daysSince === null) {
    score = 0;
  }

  const detail =
    count === 0
      ? `No activity recorded on this deal in the last 14 days${daysSince !== null ? ` (last activity ${daysSince} day(s) ago)` : ''}.`
      : `${count} activit${count === 1 ? 'y' : 'ies'} in the last 14 days${daysSince !== null ? `, most recent ${daysSince} day(s) ago` : ''}.`;

  return [score, detail];
}

async function computeEngagementScore(deal: Deal): Promise<[number, string]> {
  const since = new Date(Date.now() - 30 * DAY_MS);
  const conversations = await prisma.conversation.findMany({ where: { organizationId: deal.organizationId, dealId: deal.id, occurredAt: { gte: since } } });
  const total = conversations.length;
  const inbound = conversations.filter((c) => c.direction === 'inbound').length;
  const proposalViews = conversations.filter((c) => c.direction === 'inbound' && /proposal/i.test(c.content + ' ' + (c.aiSummary ?? ''))).length;

  if (total === 0) {
    return [0, 'No conversation activity (emails, calls, WhatsApp) recorded in the last 30 days.'];
  }

  const inboundRatio = inbound / total;
  const score = clamp(inboundRatio * 60 + Math.min(proposalViews, 3) * (40 / 3));

  const parts = [`${inbound} of ${total} recent interactions were initiated by the customer`];
  if (proposalViews > 0) parts.push(`the proposal was viewed/referenced ${proposalViews} time(s)`);
  return [score, parts.join('; ') + '.'];
}

async function computeDecisionMakerScore(deal: Deal): Promise<[number, string]> {
  if (!deal.primaryContactId) {
    return [20, 'No primary contact linked to this deal, so decision-maker involvement is unknown.'];
  }
  const contact = await prisma.contact.findUnique({ where: { id: deal.primaryContactId } });
  if (!contact) return [20, 'Primary contact record could not be found.'];

  if (!contact.isDecisionMaker) {
    return [30, `${contact.name} is the primary contact but is not flagged as a decision maker.`];
  }

  const since = new Date(Date.now() - 14 * DAY_MS);
  const recentEngagement = await prisma.conversation.count({
    where: { organizationId: deal.organizationId, dealId: deal.id, contactId: contact.id, occurredAt: { gte: since } },
  });

  if (recentEngagement > 0) {
    return [100, `Decision maker ${contact.name} has engaged within the last 14 days.`];
  }
  return [50, `${contact.name} is a known decision maker but has not engaged in the last 14 days.`];
}

async function computeStageScore(deal: Deal): Promise<[number, string]> {
  const stage = await prisma.dealStageConfig.findFirst({ where: { organizationId: deal.organizationId, key: deal.stageKey } });
  if (!stage) return [deal.probability, `Stage "${deal.stageKey}" configured probability used as fallback.`];
  return [stage.probability, `Deal is in the "${stage.label}" stage (configured baseline probability ${stage.probability}%).`];
}

async function computeHistoricalRateScore(deal: Deal): Promise<[number, string]> {
  const orgId = deal.organizationId;
  const [won, lost] = await Promise.all([
    prisma.deal.count({ where: { organizationId: orgId, wonAt: { not: null } } }),
    prisma.deal.count({ where: { organizationId: orgId, lostAt: { not: null } } }),
  ]);
  const closed = won + lost;
  if (closed === 0) {
    return [50, 'No closed deals yet in this organization, so historical conversion rate is not yet available (neutral value used).'];
  }
  const rate = clamp((won / closed) * 100);
  return [rate, `Organization has historically won ${won} of ${closed} closed deals (${rate.toFixed(0)}%).`];
}

function buildExplanation(factors: IDealScoreFactor[], daysSinceActivity: number | null): string {
  const lines = factors.map((f) => `${f.label}: ${f.detail} (contributes ${f.contribution >= 0 ? '+' : ''}${f.contribution}% of ${f.weight}% weight)`);
  if (daysSinceActivity !== null && daysSinceActivity >= 7) {
    lines.unshift(`No activity for ${daysSinceActivity} day(s), which lowers activity and recency signals.`);
  }
  return lines.join(' ');
}

function buildRecommendation(health: DealHealth, daysSinceActivity: number | null, dmScore: number): string {
  if (health === 'stalled') return 'This deal has gone quiet — schedule a re-engagement call and confirm the opportunity is still active.';
  if (health === 'at_risk' && daysSinceActivity !== null && daysSinceActivity >= 7) return 'Send a follow-up today to re-establish momentum.';
  if (dmScore <= 30) return 'Decision-maker engagement is weak — try to get a decision maker into the next conversation.';
  if (health === 'healthy') return 'Momentum looks healthy — keep the cadence and move toward the next stage.';
  return 'Review recent activity and plan the next concrete touchpoint.';
}

export async function rescoreAllOpenDeals(orgId: string): Promise<number> {
  const stages = await prisma.dealStageConfig.findMany({ where: { organizationId: orgId } });
  const wonLostKeys = new Set(stages.filter((s) => s.isWon || s.isLost).map((s) => s.key));
  const deals = await prisma.deal.findMany({ where: { organizationId: orgId, stageKey: { notIn: Array.from(wonLostKeys) } }, select: { id: true } });
  let count = 0;
  for (const d of deals) {
    await scoreAndSaveDeal(d.id, orgId);
    count += 1;
  }
  return count;
}
