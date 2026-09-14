import { RecommendationAction } from '@prisma/client';
import { getAutonomySettings } from '../services/autonomySettings.service';
import { scoreDeal, IDealScore } from './dealScoring.service';
import { prisma } from '../config/prisma';

const DAY_MS = 86400000;

interface NextAction {
  action: RecommendationAction;
  channel: 'email' | 'whatsapp' | 'call' | 'meeting' | 'proposal' | 'task' | 'crm';
  title: string;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  confidence: number;
}

/** Decides the single best next action for a deal from its real, current signals. */
export function decideNextAction(daysSinceActivity: number | null, probability: number, dmScore: number, health: string): NextAction {
  if (daysSinceActivity !== null && daysSinceActivity >= 21) {
    return {
      action: 'make_call',
      channel: 'call',
      title: 'Re-engagement call',
      reason: `No activity for ${daysSinceActivity} days — the deal may have gone cold.`,
      priority: 'urgent',
      confidence: 70,
    };
  }
  if (daysSinceActivity !== null && daysSinceActivity >= 7) {
    return {
      action: 'send_email',
      channel: 'email',
      title: 'Send a follow-up email',
      reason: `No activity for ${daysSinceActivity} days. A follow-up will re-establish momentum.`,
      priority: daysSinceActivity >= 14 ? 'high' : 'medium',
      confidence: 65,
    };
  }
  if (dmScore <= 30) {
    return {
      action: 'schedule_meeting',
      channel: 'meeting',
      title: 'Get a decision maker into the conversation',
      reason: 'Decision-maker engagement is weak, which historically lowers close rates.',
      priority: 'high',
      confidence: 60,
    };
  }
  if (health === 'healthy' && probability >= 60) {
    return {
      action: 'send_proposal',
      channel: 'proposal',
      title: 'Advance toward proposal / next stage',
      reason: 'Momentum and engagement are strong — this is a good time to move the deal forward.',
      priority: 'medium',
      confidence: 55,
    };
  }
  return {
    action: 'create_task',
    channel: 'task',
    title: 'Review deal and plan next touchpoint',
    reason: 'No urgent signal detected, but a scheduled check-in keeps the deal moving.',
    priority: 'low',
    confidence: 40,
  };
}

/** Generates (or refreshes) an AIRecommendation for a deal based on its live score, respecting autonomy permission gates. */
export async function recommendNextActionForDeal(dealId: string, orgId: string, targetUserId: string) {
  const deal = await prisma.deal.findFirst({ where: { id: dealId, organizationId: orgId } });
  if (!deal) throw new Error('Deal not found');

  const score = (deal.aiScore as IDealScore | null) ?? (await scoreDeal(dealId, orgId));
  const daysSinceActivity = deal.lastActivityAt ? Math.floor((Date.now() - deal.lastActivityAt.getTime()) / DAY_MS) : null;
  const dmFactor = score.factors.find((f) => f.key === 'decision_maker');
  const dmScore = dmFactor ? (dmFactor.contribution / dmFactor.weight) * 100 : 50;

  const next = decideNextAction(daysSinceActivity, score.probability, dmScore, score.health);

  const settings = await getAutonomySettings(orgId);
  const permissionMap: Record<string, string> = {
    email: settings?.permissions.emailSending ?? 'approval_required',
    whatsapp: settings?.permissions.whatsappSending ?? 'approval_required',
    meeting: settings?.permissions.meetingScheduling ?? 'approval_required',
    proposal: settings?.permissions.proposalCreation ?? 'approval_required',
    crm: settings?.permissions.crmUpdates ?? 'approval_required',
    task: settings?.permissions.taskCreation ?? 'approval_required',
    call: 'approval_required',
  };
  const permission = permissionMap[next.channel] ?? 'approval_required';

  const existing = await prisma.aIRecommendation.findFirst({
    where: { organizationId: orgId, dealId, action: next.action, status: 'pending' },
  });

  const data = {
    organizationId: orgId,
    dealId,
    targetUserId,
    action: next.action,
    channel: next.channel,
    title: next.title,
    reason: next.reason,
    priority: next.priority,
    confidence: next.confidence,
    permissionRequirement: (permission === 'allowed' ? 'allowed' : 'approval_required') as never,
    status: 'pending' as const,
    expiresAt: new Date(Date.now() + 7 * DAY_MS),
  };

  const rec = existing
    ? await prisma.aIRecommendation.update({ where: { id: existing.id }, data })
    : await prisma.aIRecommendation.create({ data });
  return rec;
}
