import { InsightType } from '@prisma/client';
import { prisma } from '../config/prisma';
import { proposeApprovalForAtRiskDeal } from '../services/approval.service';

const DAY_MS = 86400000;

interface DetectedInsight {
  deal?: string;
  lead?: string;
  type: InsightType;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  data: Record<string, unknown>;
  dedupeKey: string;
}

/**
 * Rule-based anomaly detection over real CRM records (Section 14 of the PRD).
 * Each rule is a plain, explainable condition — no ML black box. Insights
 * are upserted by dedupeKey so re-running this doesn't create duplicate alerts.
 */
export async function detectAnomalies(orgId: string): Promise<number> {
  const found: DetectedInsight[] = [];

  const stages = await prisma.dealStageConfig.findMany({ where: { organizationId: orgId } });
  const wonLostKeys = new Set(stages.filter((s) => s.isWon || s.isLost).map((s) => s.key));

  const openDeals = await prisma.deal.findMany({
    where: { organizationId: orgId, stageKey: { notIn: Array.from(wonLostKeys) } },
    include: { company: { select: { name: true } }, primaryContact: { select: { id: true, name: true, isDecisionMaker: true } } },
  });

  for (const deal of openDeals) {
    const companyName = deal.company?.name ?? deal.name;
    const daysSinceActivity = deal.lastActivityAt ? Math.floor((Date.now() - deal.lastActivityAt.getTime()) / DAY_MS) : null;

    // Rule: no activity for 7+ days -> at risk, recommend follow-up
    if (daysSinceActivity !== null && daysSinceActivity >= 7) {
      found.push({
        deal: deal.id,
        type: 'no_activity',
        severity: daysSinceActivity >= 21 ? 'critical' : 'warning',
        message: `${companyName}: no activity for ${daysSinceActivity} days. Recommend sending a follow-up today.`,
        data: { daysSinceActivity, dealName: deal.name },
        dedupeKey: `${deal.id}:no_activity`,
      });
    }

    // Rule: proposal viewed 3x -> recommend follow-up call
    const proposalViews = await prisma.conversation.count({
      where: { organizationId: orgId, dealId: deal.id, direction: 'inbound', content: { contains: 'proposal', mode: 'insensitive' } },
    });
    if (proposalViews >= 3) {
      found.push({
        deal: deal.id,
        type: 'proposal_viewed_multiple',
        severity: 'info',
        message: `${companyName}: proposal has been viewed/referenced ${proposalViews} times. Recommend a follow-up call.`,
        data: { proposalViews },
        dedupeKey: `${deal.id}:proposal_viewed_multiple`,
      });
    }

    // Rule: decision maker engaged in the last day -> recommend technical documentation
    if (deal.primaryContact?.isDecisionMaker) {
      const engagedYesterday = await prisma.conversation.count({
        where: {
          organizationId: orgId,
          dealId: deal.id,
          contactId: deal.primaryContact.id,
          direction: 'inbound',
          occurredAt: { gte: new Date(Date.now() - DAY_MS) },
        },
      });
      if (engagedYesterday > 0) {
        found.push({
          deal: deal.id,
          type: 'decision_maker_engaged',
          severity: 'info',
          message: `${companyName}: decision maker engaged in the last day. Recommend sharing technical documentation.`,
          data: { contactId: deal.primaryContact.id },
          dedupeKey: `${deal.id}:decision_maker_engaged`,
        });
      }
    }

    // Rule: stalled in the same stage for 30+ days
    const daysInStage = Math.floor((Date.now() - new Date(deal.updatedAt).getTime()) / DAY_MS);
    if (daysInStage >= 30) {
      found.push({
        deal: deal.id,
        type: 'stage_stalled',
        severity: 'warning',
        message: `${companyName}: has been in "${deal.stageKey}" stage for ${daysInStage}+ days with no stage movement.`,
        data: { daysInStage, stage: deal.stageKey },
        dedupeKey: `${deal.id}:stage_stalled`,
      });
    }

    // Rule: overall health from the scoring engine is at_risk/stalled
    const aiScore = deal.aiScore as { health?: string; probability?: number } | null;
    if (aiScore?.health === 'at_risk' || aiScore?.health === 'stalled') {
      found.push({
        deal: deal.id,
        type: 'deal_at_risk',
        severity: aiScore.health === 'stalled' ? 'critical' : 'warning',
        message: `${companyName}: AI close probability is ${aiScore.probability}% (${aiScore.health}).`,
        data: { probability: aiScore.probability, health: aiScore.health },
        dedupeKey: `${deal.id}:deal_at_risk`,
      });

      // Real approval-flow wiring (Phase 6): propose a concrete next action for this
      // at-risk deal as an actual Approval record — not just an insight — respecting
      // the organization's current autonomy level/permissions.
      await proposeApprovalForAtRiskDeal(orgId, deal.id);
    }
  }

  // Rule: hot leads (score >= 80)
  const hotLeads = await prisma.lead.findMany({ where: { organizationId: orgId, score: { gte: 80 }, status: { notIn: ['converted', 'disqualified'] } } });
  for (const lead of hotLeads) {
    found.push({
      lead: lead.id,
      type: 'hot_lead',
      severity: 'info',
      message: `${lead.name}${lead.companyName ? ` (${lead.companyName})` : ''} is a hot lead with score ${lead.score}.`,
      data: { score: lead.score },
      dedupeKey: `${lead.id}:hot_lead`,
    });
  }

  for (const insight of found) {
    await prisma.aIInsight.upsert({
      where: { organizationId_dedupeKey: { organizationId: orgId, dedupeKey: insight.dedupeKey } },
      create: {
        organizationId: orgId,
        dealId: insight.deal,
        leadId: insight.lead,
        type: insight.type,
        severity: insight.severity,
        message: insight.message,
        data: insight.data as never,
        dedupeKey: insight.dedupeKey,
      },
      update: {
        dealId: insight.deal,
        leadId: insight.lead,
        severity: insight.severity,
        message: insight.message,
        data: insight.data as never,
      },
    });
  }

  // Clean up insights whose condition no longer holds (deal now has recent activity, etc.)
  const activeDedupeKeys = found.map((f) => f.dedupeKey);
  await prisma.aIInsight.deleteMany({ where: { organizationId: orgId, dedupeKey: { notIn: activeDedupeKeys } } });

  return found.length;
}
