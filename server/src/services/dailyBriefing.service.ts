import { prisma } from '../config/prisma';

const DAY_MS = 86400000;

/** Business-rule constants (documented, not fabricated data). */
export const HOT_LEAD_SCORE_THRESHOLD = 70;
export const AT_RISK_NO_ACTIVITY_DAYS = 7;

export interface HotLeadItem {
  leadId: string;
  name: string;
  companyName?: string;
  score: number;
  priority: 'medium' | 'high' | 'urgent';
  reason: string;
}

export interface DueFollowUpItem {
  activityId: string;
  subject: string;
  type: string;
  dealId?: string;
  scheduledAt: Date;
  priority: 'medium' | 'high' | 'urgent';
  reason: string;
}

export interface AtRiskDealItem {
  dealId: string;
  dealName: string;
  customer?: string;
  value: number;
  lastActivityAt: Date | null;
  daysSinceActivity: number;
  priority: 'medium' | 'high' | 'urgent';
  reason: string;
}

export interface PipelineStageHealth {
  stageKey: string;
  label: string;
  count: number;
  value: number;
}

export interface PipelineHealth {
  byStage: PipelineStageHealth[];
  totalOpenValue: number;
  openDealCount: number;
}

/** Hot Leads: leads with score >= threshold, sorted desc. Empty array if none — never fabricated. */
export async function getHotLeads(orgId: string, limit = 10): Promise<HotLeadItem[]> {
  const leads = await prisma.lead.findMany({
    where: { organizationId: orgId, score: { gte: HOT_LEAD_SCORE_THRESHOLD }, status: { notIn: ['converted', 'disqualified'] } },
    orderBy: { score: 'desc' },
    take: limit,
  });

  return leads.map((l) => ({
    leadId: l.id,
    name: l.name,
    companyName: l.companyName ?? undefined,
    score: l.score,
    priority: l.score >= 90 ? 'urgent' : l.score >= 80 ? 'high' : 'medium',
    reason: `Lead score is ${l.score}, at or above the hot-lead threshold of ${HOT_LEAD_SCORE_THRESHOLD}.`,
  }));
}

/** Due Follow-ups: activities with scheduledAt today-or-overdue, not completed. Real timestamps, no filler. */
export async function getDueFollowUps(orgId: string, limit = 10): Promise<DueFollowUpItem[]> {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const activities = await prisma.activity.findMany({
    where: { organizationId: orgId, isCompleted: false, scheduledAt: { not: null, lte: endOfToday } },
    orderBy: { scheduledAt: 'asc' },
    take: limit,
  });

  const now = Date.now();
  return activities.map((a) => {
    const scheduledAt = a.scheduledAt as Date;
    const daysOverdue = Math.floor((now - scheduledAt.getTime()) / DAY_MS);
    const isOverdue = daysOverdue > 0;
    return {
      activityId: a.id,
      subject: a.subject,
      type: a.type,
      dealId: a.dealId ?? undefined,
      scheduledAt,
      priority: isOverdue ? (daysOverdue >= 3 ? 'urgent' : 'high') : 'medium',
      reason: isOverdue ? `Overdue by ${daysOverdue} day${daysOverdue === 1 ? '' : 's'}.` : 'Due today.',
    } as DueFollowUpItem;
  });
}

/** At-Risk Deals: open deals with no Activity in the last N days (or never contacted). */
export async function getAtRiskDeals(orgId: string, limit = 20): Promise<AtRiskDealItem[]> {
  const stages = await prisma.dealStageConfig.findMany({ where: { organizationId: orgId } });
  const wonLostKeys = new Set(stages.filter((s) => s.isWon || s.isLost).map((s) => s.key));

  const openDeals = await prisma.deal.findMany({
    where: { organizationId: orgId, stageKey: { notIn: Array.from(wonLostKeys) } },
    include: { company: { select: { name: true } }, primaryContact: { select: { name: true } } },
  });

  const now = Date.now();
  const atRisk: AtRiskDealItem[] = [];

  for (const deal of openDeals) {
    const referenceDate = deal.lastActivityAt ?? deal.createdAt;
    const daysSinceActivity = Math.floor((now - new Date(referenceDate).getTime()) / DAY_MS);

    if (daysSinceActivity >= AT_RISK_NO_ACTIVITY_DAYS) {
      const customer = deal.company?.name ?? deal.primaryContact?.name;
      atRisk.push({
        dealId: deal.id,
        dealName: deal.name,
        customer,
        value: deal.value,
        lastActivityAt: deal.lastActivityAt ?? null,
        daysSinceActivity,
        priority: daysSinceActivity >= 21 ? 'urgent' : daysSinceActivity >= 14 ? 'high' : 'medium',
        reason: deal.lastActivityAt
          ? `No activity for ${daysSinceActivity} days.`
          : `Never contacted — created ${daysSinceActivity} days ago with no logged activity.`,
      });
    }
  }

  return atRisk.sort((a, b) => b.daysSinceActivity - a.daysSinceActivity).slice(0, limit);
}

/** Pipeline Health: open deal count/value grouped by the organization's actual configured stages. */
export async function getPipelineHealth(orgId: string): Promise<PipelineHealth> {
  const stages = await prisma.dealStageConfig.findMany({ where: { organizationId: orgId }, orderBy: { order: 'asc' } });
  const wonLostKeys = new Set(stages.filter((s) => s.isWon || s.isLost).map((s) => s.key));

  const deals = await prisma.deal.findMany({ where: { organizationId: orgId } });

  const byStage: PipelineStageHealth[] = stages.map((stage) => {
    const stageDeals = deals.filter((d) => d.stageKey === stage.key);
    return {
      stageKey: stage.key,
      label: stage.label,
      count: stageDeals.length,
      value: stageDeals.reduce((sum, d) => sum + d.value, 0),
    };
  });

  const openDeals = deals.filter((d) => !wonLostKeys.has(d.stageKey));

  return {
    byStage,
    totalOpenValue: openDeals.reduce((sum, d) => sum + d.value, 0),
    openDealCount: openDeals.length,
  };
}

export interface DailyBriefingResult {
  greetingName: string;
  generatedAt: Date;
  hotLeads: HotLeadItem[];
  dueFollowUps: DueFollowUpItem[];
  atRiskDeals: AtRiskDealItem[];
  pipelineHealth: PipelineHealth;
}

/** Assembles the full daily briefing from the sections above — every section independently computed from real data. */
export async function generateDailyBriefing(orgId: string, userId: string): Promise<DailyBriefingResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  const [hotLeads, dueFollowUps, atRiskDeals, pipelineHealth] = await Promise.all([
    getHotLeads(orgId),
    getDueFollowUps(orgId),
    getAtRiskDeals(orgId),
    getPipelineHealth(orgId),
  ]);

  return {
    greetingName: user?.name?.split(' ')[0] ?? 'there',
    generatedAt: new Date(),
    hotLeads,
    dueFollowUps,
    atRiskDeals,
    pipelineHealth,
  };
}
