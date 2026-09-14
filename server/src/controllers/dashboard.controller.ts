import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { aiService } from '../ai/aiService';
import { prisma } from '../config/prisma';

export const dailyBriefing = catchAsync(async (req: Request, res: Response) => {
  const briefing = await aiService.generateDailyBriefing(req.user!.organizationId, req.user!.id);
  res.json({ success: true, data: briefing });
});

function resolveDateRange(range: string | undefined): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  switch (range) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case '90d':
      start.setDate(start.getDate() - 90);
      break;
    case '30d':
    default:
      start.setDate(start.getDate() - 30);
      break;
  }
  return { start, end };
}

/** Manager dashboard: team pipeline, by-rep breakdown, win rate, velocity, at-risk & stalled deals — all computed live. */
export const managerDashboard = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const { start, end } = resolveDateRange(req.query.range as string | undefined);

  const stages = await prisma.dealStageConfig.findMany({ where: { organizationId: orgId } });
  const wonKeys = new Set(stages.filter((s) => s.isWon).map((s) => s.key));
  const lostKeys = new Set(stages.filter((s) => s.isLost).map((s) => s.key));

  const [allDeals, users] = await Promise.all([
    prisma.deal.findMany({ where: { organizationId: orgId } }),
    prisma.user.findMany({ where: { organizationId: orgId, isActive: true }, select: { id: true, name: true, role: true } }),
  ]);
  const userNameById = new Map(users.map((u) => [u.id, u.name]));

  const closedInRange = allDeals.filter(
    (d) => (d.wonAt && d.wonAt >= start && d.wonAt <= end) || (d.lostAt && d.lostAt >= start && d.lostAt <= end)
  );
  const wonInRange = closedInRange.filter((d) => wonKeys.has(d.stageKey));
  const winRate = closedInRange.length > 0 ? Math.round((wonInRange.length / closedInRange.length) * 100) : 0;

  const openDeals = allDeals.filter((d) => !wonKeys.has(d.stageKey) && !lostKeys.has(d.stageKey));
  const pipelineByStage = new Map<string, { value: number; count: number }>();
  for (const d of openDeals) {
    const g = pipelineByStage.get(d.stageKey) ?? { value: 0, count: 0 };
    g.value += d.value;
    g.count += 1;
    pipelineByStage.set(d.stageKey, g);
  }

  const byRep = new Map<string, { name: string; pipelineValue: number; dealCount: number; won: number; lost: number }>();
  for (const d of allDeals) {
    const ownerId = d.ownerId ?? 'unassigned';
    const name = userNameById.get(d.ownerId) ?? 'Unassigned';
    const g = byRep.get(ownerId) ?? { name, pipelineValue: 0, dealCount: 0, won: 0, lost: 0 };
    if (!wonKeys.has(d.stageKey) && !lostKeys.has(d.stageKey)) {
      g.pipelineValue += d.value;
      g.dealCount += 1;
    }
    if (wonKeys.has(d.stageKey)) g.won += 1;
    if (lostKeys.has(d.stageKey)) g.lost += 1;
    byRep.set(ownerId, g);
  }

  const dealHealth = (d: (typeof allDeals)[number]) => (d.aiScore as { health?: string } | null)?.health;
  const dealProbability = (d: (typeof allDeals)[number]) => (d.aiScore as { probability?: number } | null)?.probability ?? d.probability;

  const atRiskDeals = openDeals.filter((d) => dealHealth(d) === 'at_risk');
  const stalledDeals = openDeals.filter((d) => dealHealth(d) === 'stalled');

  // Deal velocity: average days from creation to won, for deals won in range.
  const velocities = wonInRange
    .filter((d) => d.wonAt)
    .map((d) => (d.wonAt!.getTime() - new Date(d.createdAt).getTime()) / 86400000);
  const avgVelocityDays = velocities.length ? Math.round(velocities.reduce((a, b) => a + b, 0) / velocities.length) : null;

  const revenueForecast = openDeals.reduce((sum, d) => sum + d.value * (dealProbability(d) / 100), 0);

  res.json({
    success: true,
    data: {
      range: { start, end },
      teamSize: users.length,
      pipeline: {
        totalValue: openDeals.reduce((s, d) => s + d.value, 0),
        totalCount: openDeals.length,
        byStage: Array.from(pipelineByStage.entries()).map(([key, v]) => ({
          key,
          label: stages.find((s) => s.key === key)?.label ?? key,
          ...v,
        })),
      },
      byRep: Array.from(byRep.values()),
      winRate,
      revenueForecast: Math.round(revenueForecast),
      avgVelocityDays,
      atRiskDeals: atRiskDeals.length,
      stalledDeals: stalledDeals.length,
    },
  });
});

export const followUpPerformance = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [openTasks, overdueTasks, completedTasks] = await Promise.all([
    prisma.task.count({ where: { organizationId: orgId, status: { in: ['open', 'in_progress'] } } }),
    prisma.task.count({ where: { organizationId: orgId, status: { in: ['open', 'in_progress'] }, dueDate: { lt: new Date() } } }),
    prisma.task.count({ where: { organizationId: orgId, status: 'completed' } }),
  ]);
  res.json({ success: true, data: { openTasks, overdueTasks, completedTasks } });
});
