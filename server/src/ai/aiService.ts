import { env } from '../config/env';
import { AIProvider, AIChatMessage } from './types';
import { LocalAIProvider } from './providers/localProvider';
import { AnthropicAIProvider } from './providers/anthropicProvider';
import { AI_TOOL_DEFINITIONS, executeAITool } from './tools';
import { scoreDeal, scoreAndSaveDeal } from './dealScoring.service';
import { detectAnomalies } from './anomalyDetection.service';
import { recommendNextActionForDeal } from './nextBestAction.service';
import {
  generateEmailTemplate,
  generateWhatsAppTemplate,
  generateCallScriptTemplate,
  generateProposalSection,
  ContentContext,
} from './contentTemplates';
import { generateDailyBriefing as computeDailyBriefing } from '../services/dailyBriefing.service';
import { logger } from '../utils/logger';
import { prisma } from '../config/prisma';

function getProvider(): AIProvider {
  if (env.aiProvider === 'anthropic' && env.aiApiKey) {
    return new AnthropicAIProvider();
  }
  return new LocalAIProvider();
}

export interface ChatTurnResult {
  message: string;
  suggestedActions: { label: string; type: string; payload?: Record<string, unknown> }[];
  toolResults: { name: string; result: unknown }[];
}

/**
 * Central AI Service. This is the ONLY place the app talks to an LLM
 * provider — every route/controller calls through here, never a provider
 * directly. Methods either compute deterministically from the database
 * (scoreDeal, detectAnomalies, forecastPipeline) or delegate generation to
 * the configured provider while always grounding it in real CRM data.
 */
export class AIService {
  private provider = getProvider();

  async chat(orgId: string, userId: string, message: string, history: AIChatMessage[] = []): Promise<ChatTurnResult> {
    const messages: AIChatMessage[] = [
      {
        role: 'system',
        content:
          'You are the AI Sales Agent embedded in a CRM. Answer only using data returned by tool calls — never invent deal names, values, contacts, or scores. If information is unavailable, say so plainly. Be concise and action-oriented.',
      },
      ...history,
      { role: 'user', content: message },
    ];

    const toolResults: { name: string; result: unknown }[] = [];
    let turns = 0;
    let final = await this.provider.chat(messages, AI_TOOL_DEFINITIONS);

    while (final.stopReason === 'tool_use' && final.toolCalls.length > 0 && turns < 4) {
      turns += 1;
      // One assistant turn can request several tool calls at once — push a single
      // assistant message for the turn, then one tool-result message per call, each
      // carrying its own toolCallId/toolInput so a provider (e.g. Anthropic) can
      // replay a correctly-correlated tool_use/tool_result pair per call.
      messages.push({ role: 'assistant', content: final.content ?? '' });
      for (const call of final.toolCalls) {
        const result = await executeAITool(call.name, orgId, userId, call.arguments);
        toolResults.push({ name: call.name, result });
        messages.push({ role: 'tool', name: call.name, toolCallId: call.id, toolInput: call.arguments, content: JSON.stringify(result) });
      }
      final = await this.provider.chat(messages, AI_TOOL_DEFINITIONS);
    }

    const message2 = final.content || this.composeLocalSummary(toolResults);
    const suggestedActions = this.suggestActionsFromResults(toolResults);

    return { message: message2, suggestedActions, toolResults };
  }

  /** Builds a readable summary from tool results when the provider itself returns no prose (local provider). */
  private composeLocalSummary(toolResults: { name: string; result: unknown }[]): string {
    if (toolResults.length === 0) {
      return "I couldn't find a matching CRM query for that yet. Try asking about deals, leads, pipeline, tasks, or at-risk deals.";
    }
    const parts: string[] = [];
    for (const { name, result } of toolResults) {
      if (Array.isArray(result)) {
        if (result.length === 0) {
          parts.push(`No results found for ${name}.`);
        } else {
          parts.push(`Found ${result.length} result(s) from ${name}.`);
        }
      }
    }
    return parts.join(' ') || 'Here is what I found in your CRM data.';
  }

  private suggestActionsFromResults(toolResults: { name: string; result: unknown }[]) {
    const actions: { label: string; type: string; payload?: Record<string, unknown> }[] = [];
    for (const { name } of toolResults) {
      if (name === 'getAtRiskDeals') actions.push({ label: 'Open Pipeline', type: 'navigate', payload: { path: '/pipeline' } });
      if (name === 'getLeads') actions.push({ label: 'Open Leads', type: 'navigate', payload: { path: '/leads' } });
      if (name === 'getPipeline') actions.push({ label: 'Open Pipeline', type: 'navigate', payload: { path: '/pipeline' } });
      if (name === 'getTasks') actions.push({ label: 'Open Tasks', type: 'navigate', payload: { path: '/tasks' } });
    }
    return actions;
  }

  async scoreDeal(dealId: string, orgId: string) {
    return scoreDeal(dealId, orgId);
  }

  async analyzeDeal(dealId: string, orgId: string) {
    const deal = await scoreAndSaveDeal(dealId, orgId);
    return {
      dealId,
      score: deal.aiScore,
    };
  }

  async detectAnomalies(orgId: string) {
    const count = await detectAnomalies(orgId);
    return { insightsGenerated: count };
  }

  async recommendNextAction(dealId: string, orgId: string, targetUserId: string) {
    return recommendNextActionForDeal(dealId, orgId, targetUserId);
  }

  /**
   * Calls the configured provider's complete() with a prompt that grounds it strictly in the
   * given facts, and parses the requested JSON shape from the response. Falls back to the
   * deterministic template (fallbackFn) if the provider isn't Anthropic, the call fails, or the
   * response isn't valid JSON — so content generation never throws and never silently returns
   * something ungrounded in real data.
   */
  private async generateViaProviderOrFallback<T>(ctx: ContentContext, instructions: string, fallbackFn: () => T): Promise<T> {
    if (this.provider.name !== 'anthropic') return fallbackFn();

    const facts = Object.fromEntries(Object.entries(ctx).filter(([, v]) => v !== undefined && v !== ''));
    const system = `You are an AI sales assistant. Use ONLY the facts provided in the user message — never invent a name, number, or detail that isn't given. If a fact is missing, write around it generically rather than making one up. ${instructions} Respond with ONLY valid JSON, no markdown fences, no commentary.`;
    const userPrompt = `Known facts (JSON): ${JSON.stringify(facts)}`;

    try {
      const raw = await this.provider.complete(system, userPrompt);
      const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      return JSON.parse(cleaned) as T;
    } catch (err) {
      logger.warn('Anthropic content generation failed or returned unparsable output — falling back to the deterministic template.', {
        error: (err as Error).message,
      });
      return fallbackFn();
    }
  }

  async generateEmail(ctx: ContentContext) {
    return this.generateViaProviderOrFallback(ctx, 'Draft a personalized follow-up email. Respond as {"subject": string, "body": string}.', () =>
      generateEmailTemplate(ctx)
    );
  }

  async generateWhatsApp(ctx: ContentContext) {
    return this.generateViaProviderOrFallback(ctx, 'Draft a short, conversational WhatsApp message. Respond as {"body": string}.', () =>
      generateWhatsAppTemplate(ctx)
    );
  }

  async generateCallScript(ctx: ContentContext) {
    return this.generateViaProviderOrFallback(
      ctx,
      'Draft a sales call script. Respond as {"opening": string, "context": string, "discoveryQuestions": string[], "objectionHandling": [{"objection": string, "response": string}], "closing": string}.',
      () => generateCallScriptTemplate(ctx)
    );
  }

  async generateProposalSectionContent(ctx: ContentContext) {
    return this.generateViaProviderOrFallback(
      ctx,
      `Draft the "${ctx.section || 'executive_summary'}" section of a sales proposal. Respond as {"title": string, "content": string}.`,
      () => generateProposalSection(ctx)
    );
  }

  async summarizeConversation(dealId: string, orgId: string) {
    const conversations = await prisma.conversation.findMany({ where: { organizationId: orgId, dealId }, orderBy: { occurredAt: 'desc' }, take: 20 });
    if (conversations.length === 0) {
      return { summary: 'No conversations recorded yet for this deal.' };
    }
    const byChannel: Record<string, number> = {};
    for (const c of conversations) byChannel[c.channel] = (byChannel[c.channel] || 0) + 1;
    const channelSummary = Object.entries(byChannel).map(([ch, n]) => `${n} ${ch}`).join(', ');
    const latest = conversations[0];
    const summary = `${conversations.length} interaction(s) recorded (${channelSummary}). Most recent: ${latest.direction} ${latest.channel} on ${latest.occurredAt.toDateString()}.`;
    return { summary };
  }

  /** Forecast = Deal Value × Close Probability, grouped by rep/stage/month as requested. */
  async forecastPipeline(orgId: string, groupBy: 'rep' | 'stage' | 'month' = 'stage') {
    const stages = await prisma.dealStageConfig.findMany({ where: { organizationId: orgId } });
    const wonKey = new Set(stages.filter((s) => s.isWon || s.isLost).map((s) => s.key));
    const deals = await prisma.deal.findMany({
      where: { organizationId: orgId, stageKey: { notIn: Array.from(wonKey) } },
      include: { owner: { select: { id: true, name: true } } },
    });

    const dealProbability = (d: (typeof deals)[number]) => (d.aiScore as { probability?: number } | null)?.probability ?? d.probability;

    const pipelineValue = deals.reduce((sum, d) => sum + d.value, 0);
    const weightedPipeline = deals.reduce((sum, d) => sum + d.value * (dealProbability(d) / 100), 0);
    const bestCase = deals.reduce((sum, d) => sum + d.value * ((dealProbability(d) + 20) / 100 > 1 ? 1 : (dealProbability(d) + 20) / 100), 0);
    const commit = deals.filter((d) => dealProbability(d) >= 70).reduce((sum, d) => sum + d.value, 0);

    const groups = new Map<string, { label: string; value: number; weighted: number; count: number }>();
    for (const d of deals) {
      let key: string;
      let label: string;
      if (groupBy === 'rep') {
        key = d.ownerId ?? 'unassigned';
        label = d.owner?.name ?? 'Unassigned';
      } else if (groupBy === 'month') {
        const date = d.expectedCloseDate ? new Date(d.expectedCloseDate) : null;
        key = date ? `${date.getFullYear()}-${date.getMonth() + 1}` : 'unscheduled';
        label = date ? date.toLocaleString('en-US', { month: 'long', year: 'numeric' }) : 'Unscheduled';
      } else {
        key = d.stageKey;
        label = stages.find((s) => s.key === d.stageKey)?.label ?? d.stageKey;
      }
      const g = groups.get(key) ?? { label, value: 0, weighted: 0, count: 0 };
      g.value += d.value;
      g.weighted += d.value * (dealProbability(d) / 100);
      g.count += 1;
      groups.set(key, g);
    }

    return {
      methodology: 'Expected Revenue = Deal Value × Close Probability. Best Case adds a +20 point optimism margin. Commit includes only deals with probability >= 70%.',
      pipelineValue,
      weightedPipeline: Math.round(weightedPipeline),
      expectedRevenue: Math.round(weightedPipeline),
      bestCase: Math.round(bestCase),
      commit: Math.round(commit),
      dealCount: deals.length,
      groupBy,
      groups: Array.from(groups.values()).map((g) => ({ ...g, weighted: Math.round(g.weighted) })),
    };
  }

  /** Delegates to dailyBriefing.service.ts — see that file for the section-by-section logic (hot leads, due follow-ups, at-risk deals, pipeline health), each independently unit-tested. */
  async generateDailyBriefing(orgId: string, userId: string) {
    return computeDailyBriefing(orgId, userId);
  }
}

export const aiService = new AIService();
