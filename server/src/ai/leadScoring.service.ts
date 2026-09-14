import { Prisma, Lead } from '@prisma/client';
import { prisma } from '../config/prisma';

const DAY_MS = 86400000;

const STATUS_WEIGHT: Record<string, number> = {
  new: 15,
  contacted: 35,
  qualifying: 55,
  qualified: 85,
  converted: 100,
  disqualified: 0,
};

/**
 * Deterministic lead scoring from real fields: pipeline status, recent
 * activity, and profile completeness. No random numbers — a re-run on the
 * same data always returns the same score.
 */
export async function scoreLead(leadId: string, orgId: string): Promise<{ score: number; breakdown: Record<string, number> }> {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId: orgId } });
  if (!lead) throw new Error('Lead not found');

  const statusScore = STATUS_WEIGHT[lead.status] ?? 15;

  const since = new Date(Date.now() - 14 * DAY_MS);
  const recentActivityCount = await prisma.activity.count({ where: { organizationId: orgId, leadId: lead.id, createdAt: { gte: since } } });
  const recencyScore = Math.min(recentActivityCount * 30, 100);

  const fields = [lead.email, lead.phone, lead.companyName, lead.jobTitle];
  const completenessScore = (fields.filter(Boolean).length / fields.length) * 100;

  const score = Math.round(statusScore * 0.5 + recencyScore * 0.3 + completenessScore * 0.2);

  return {
    score: Math.max(0, Math.min(100, score)),
    breakdown: { statusScore, recencyScore, completenessScore },
  };
}

export async function scoreAndSaveLead(leadId: string, orgId: string): Promise<Lead> {
  const { score, breakdown } = await scoreLead(leadId, orgId);
  const existing = await prisma.lead.findFirst({ where: { id: leadId, organizationId: orgId } });
  if (!existing) throw new Error('Lead not found');
  return prisma.lead.update({ where: { id: leadId }, data: { score, scoreBreakdown: breakdown as Prisma.InputJsonValue } });
}
