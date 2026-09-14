import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AIToolDefinition } from './types';

/**
 * Real data-access functions the AI assistant is allowed to call. Every
 * function is scoped to an organization id — the AI can never read across
 * tenants, and every fact it reports traces back to one of these queries.
 */

export async function getDeals(orgId: string, args: { stage?: string; minValue?: number; search?: string; limit?: number } = {}) {
  const where: Prisma.DealWhereInput = { organizationId: orgId };
  if (args.stage) where.stageKey = args.stage;
  if (args.minValue) where.value = { gte: args.minValue };
  if (args.search) where.name = { contains: args.search, mode: 'insensitive' };
  const deals = await prisma.deal.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: Math.min(args.limit ?? 25, 100),
    include: { company: { select: { name: true } }, primaryContact: { select: { name: true } }, owner: { select: { name: true } } },
  });
  return deals.map((d) => {
    const aiScore = d.aiScore as { probability?: number; health?: string } | null;
    return {
      id: d.id,
      name: d.name,
      company: d.company?.name,
      contact: d.primaryContact?.name,
      owner: d.owner.name,
      value: d.value,
      currency: d.currency,
      stage: d.stageKey,
      probability: aiScore?.probability ?? d.probability,
      health: aiScore?.health ?? 'unknown',
      lastActivityAt: d.lastActivityAt,
      expectedCloseDate: d.expectedCloseDate,
    };
  });
}

export async function getAtRiskDeals(orgId: string, args: { limit?: number } = {}) {
  const deals = await prisma.deal.findMany({
    where: { organizationId: orgId },
    include: { company: { select: { name: true } } },
  });
  return deals
    .map((d) => {
      const aiScore = d.aiScore as { probability?: number; health?: string; explanation?: string; recommendation?: string } | null;
      return {
        id: d.id,
        name: d.name,
        company: d.company?.name,
        value: d.value,
        health: aiScore?.health,
        probability: aiScore?.probability,
        reason: aiScore?.explanation,
        recommendation: aiScore?.recommendation,
        lastActivityAt: d.lastActivityAt,
      };
    })
    .filter((d) => d.health === 'at_risk' || d.health === 'stalled')
    .sort((a, b) => (a.probability ?? 0) - (b.probability ?? 0))
    .slice(0, Math.min(args.limit ?? 20, 100));
}

export async function getLeads(orgId: string, args: { status?: string; minScore?: number; limit?: number } = {}) {
  const where: Prisma.LeadWhereInput = { organizationId: orgId };
  if (args.status) where.status = args.status as never;
  if (args.minScore) where.score = { gte: args.minScore };
  const leads = await prisma.lead.findMany({ where, orderBy: { score: 'desc' }, take: Math.min(args.limit ?? 25, 100) });
  return leads.map((l) => ({
    id: l.id,
    name: l.name,
    companyName: l.companyName,
    status: l.status,
    score: l.score,
    lastActivityAt: l.lastActivityAt,
  }));
}

export async function getContacts(orgId: string, args: { search?: string; limit?: number } = {}) {
  const where: Prisma.ContactWhereInput = { organizationId: orgId };
  if (args.search) where.OR = [{ name: { contains: args.search, mode: 'insensitive' } }, { email: { contains: args.search, mode: 'insensitive' } }];
  const contacts = await prisma.contact.findMany({ where, take: Math.min(args.limit ?? 25, 100), include: { company: { select: { name: true } } } });
  return contacts.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    company: c.company?.name,
    isDecisionMaker: c.isDecisionMaker,
  }));
}

export async function getActivities(orgId: string, args: { dealId?: string; sinceDays?: number; limit?: number } = {}) {
  const where: Prisma.ActivityWhereInput = { organizationId: orgId };
  if (args.dealId) where.dealId = args.dealId;
  if (args.sinceDays) where.createdAt = { gte: new Date(Date.now() - args.sinceDays * 86400000) };
  const activities = await prisma.activity.findMany({ where, orderBy: { createdAt: 'desc' }, take: Math.min(args.limit ?? 25, 100) });
  return activities.map((a) => ({
    id: a.id,
    type: a.type,
    subject: a.subject,
    deal: a.dealId,
    createdAt: a.createdAt,
    isCompleted: a.isCompleted,
  }));
}

export async function getPipeline(orgId: string) {
  const stages = await prisma.dealStageConfig.findMany({ where: { organizationId: orgId }, orderBy: { order: 'asc' } });
  const results = await Promise.all(
    stages.map(async (stage) => {
      const deals = await prisma.deal.findMany({ where: { organizationId: orgId, stageKey: stage.key }, select: { value: true } });
      const totalValue = deals.reduce((sum, d) => sum + d.value, 0);
      return { stage: stage.label, key: stage.key, count: deals.length, totalValue };
    })
  );
  return results;
}

export async function getTasks(orgId: string, args: { userId?: string; status?: string; dueSoonDays?: number; limit?: number } = {}) {
  const where: Prisma.TaskWhereInput = { organizationId: orgId };
  if (args.userId) where.assignedToId = args.userId;
  if (args.status) where.status = args.status as never;
  if (args.dueSoonDays) where.dueDate = { lte: new Date(Date.now() + args.dueSoonDays * 86400000) };
  const tasks = await prisma.task.findMany({ where, orderBy: { dueDate: 'asc' }, take: Math.min(args.limit ?? 25, 100) });
  return tasks.map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate, priority: t.priority, status: t.status }));
}

export async function createTask(
  orgId: string,
  userId: string,
  args: { title: string; dealId?: string; dueDate?: string; priority?: string }
) {
  const task = await prisma.task.create({
    data: {
      organizationId: orgId,
      title: args.title,
      dealId: args.dealId,
      dueDate: args.dueDate ? new Date(args.dueDate) : undefined,
      priority: (args.priority as never) ?? 'medium',
      assignedToId: userId,
      createdById: userId,
      createdByAI: true,
    },
  });
  return { id: task.id, title: task.title };
}

export async function updateDeal(
  orgId: string,
  args: { dealId: string; stageKey?: string; value?: number; expectedCloseDate?: string }
) {
  const existing = await prisma.deal.findFirst({ where: { id: args.dealId, organizationId: orgId } });
  if (!existing) return { error: 'Deal not found' };
  const data: Prisma.DealUncheckedUpdateInput = {};
  if (args.stageKey) data.stageKey = args.stageKey;
  if (args.value !== undefined) data.value = args.value;
  if (args.expectedCloseDate) data.expectedCloseDate = new Date(args.expectedCloseDate);
  const deal = await prisma.deal.update({ where: { id: args.dealId }, data });
  return { id: deal.id, stage: deal.stageKey, value: deal.value };
}

export async function getUsersLookup(orgId: string) {
  const users = await prisma.user.findMany({ where: { organizationId: orgId }, select: { id: true, name: true, role: true } });
  return users.map((u) => ({ id: u.id, name: u.name, role: u.role }));
}

/** JSON-schema tool definitions handed to the LLM provider for real function calling. */
export const AI_TOOL_DEFINITIONS: AIToolDefinition[] = [
  {
    name: 'getDeals',
    description: 'List deals in the pipeline, optionally filtered by stage or minimum value.',
    parameters: {
      type: 'object',
      properties: {
        stage: { type: 'string', description: 'Stage key to filter by' },
        minValue: { type: 'number' },
        search: { type: 'string', description: 'Case-insensitive substring match on the deal name' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'getAtRiskDeals',
    description: 'List deals whose AI health is at_risk or stalled, ordered by lowest probability first.',
    parameters: { type: 'object', properties: { limit: { type: 'number' } } },
  },
  {
    name: 'getLeads',
    description: 'List leads, optionally filtered by status or minimum score.',
    parameters: {
      type: 'object',
      properties: { status: { type: 'string' }, minScore: { type: 'number' }, limit: { type: 'number' } },
    },
  },
  {
    name: 'getContacts',
    description: 'Search contacts by name/email.',
    parameters: { type: 'object', properties: { search: { type: 'string' }, limit: { type: 'number' } } },
  },
  {
    name: 'getActivities',
    description: 'List recent activities, optionally for a specific deal or within the last N days.',
    parameters: {
      type: 'object',
      properties: { dealId: { type: 'string' }, sinceDays: { type: 'number' }, limit: { type: 'number' } },
    },
  },
  {
    name: 'getPipeline',
    description: 'Get pipeline totals (deal count and value) grouped by stage.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'getTasks',
    description: 'List tasks, optionally filtered by assigned user, status, or due within N days.',
    parameters: {
      type: 'object',
      properties: { userId: { type: 'string' }, status: { type: 'string' }, dueSoonDays: { type: 'number' }, limit: { type: 'number' } },
    },
  },
  {
    name: 'createTask',
    description: 'Create a follow-up task in the CRM.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        dealId: { type: 'string' },
        dueDate: { type: 'string' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
      },
      required: ['title'],
    },
  },
  {
    name: 'updateDeal',
    description: 'Update a deal (stage, value, or expected close date).',
    parameters: {
      type: 'object',
      properties: {
        dealId: { type: 'string' },
        stageKey: { type: 'string' },
        value: { type: 'number' },
        expectedCloseDate: { type: 'string' },
      },
      required: ['dealId'],
    },
  },
];

export async function executeAITool(name: string, orgId: string, userId: string, args: Record<string, unknown>) {
  switch (name) {
    case 'getDeals':
      return getDeals(orgId, args as never);
    case 'getAtRiskDeals':
      return getAtRiskDeals(orgId, args as never);
    case 'getLeads':
      return getLeads(orgId, args as never);
    case 'getContacts':
      return getContacts(orgId, args as never);
    case 'getActivities':
      return getActivities(orgId, args as never);
    case 'getPipeline':
      return getPipeline(orgId);
    case 'getTasks':
      return getTasks(orgId, args as never);
    case 'createTask':
      return createTask(orgId, userId, args as never);
    case 'updateDeal':
      return updateDeal(orgId, args as never);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
