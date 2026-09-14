import { AIChatMessage, AIChatResult, AIProvider, AIToolCall, AIToolDefinition } from '../types';
import { generateEmailTemplate } from '../contentTemplates';

interface DraftableDeal {
  id: string;
  name: string;
  company?: string;
  contact?: string;
  value: number;
  currency?: string;
}

/**
 * Deterministic, rule-based provider used when no external LLM key is
 * configured (AI_PROVIDER=local, the default). It never fabricates CRM
 * facts: chat() maps the user's message to a real tool call via keyword
 * matching rather than free-form generation, and complete() is only used
 * as a plain-text fallback — actual content generation goes through the
 * templates in contentTemplates.ts, which fill real field values.
 */
export class LocalAIProvider implements AIProvider {
  readonly name = 'local';

  async chat(messages: AIChatMessage[], tools: AIToolDefinition[] = []): Promise<AIChatResult> {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const text = (lastUser?.content || '').toLowerCase();
    const isDraftRequest = /draft|write me|prepare|compose/.test(text) && /follow.?up|email/.test(text);

    // Second round: a tool call already ran for this turn.
    const priorToolMsg = [...messages].reverse().find((m) => m.role === 'tool');
    if (priorToolMsg) {
      if (isDraftRequest && priorToolMsg.name === 'getDeals') {
        return this.composeDraftFromToolResult(priorToolMsg.content, text);
      }
      // Any other tool round: the local provider has no further reasoning to do —
      // stop rather than re-issuing the same tool call forever.
      return { content: '', toolCalls: [], stopReason: 'end_turn' };
    }

    const toolNames = new Set(tools.map((t) => t.name));
    const toolCalls: AIToolCall[] = [];

    const pick = (name: string, args: Record<string, unknown> = {}) => {
      if (toolNames.has(name)) toolCalls.push({ id: `local_${name}_${Date.now()}`, name, arguments: args });
    };

    if (isDraftRequest) {
      // Extract the target deal/company name from phrasing like "draft a follow-up for Acme Corp".
      const match = text.match(/for\s+(.+?)(?:[.?!]|$)/i);
      const search = match?.[1]?.trim();
      pick('getDeals', search ? { search, limit: 5 } : { limit: 5 });
    } else if (/at.?risk|losing momentum|going cold|stalled/.test(text)) {
      pick('getAtRiskDeals', { limit: 10 });
    } else if (/hottest|hot leads?|hot deals?|prioriti/.test(text)) {
      pick('getLeads', { minScore: 70, limit: 10 });
    } else if (/pipeline|stage/.test(text)) {
      pick('getPipeline');
    } else if (/task|to.?do|follow.?up/.test(text) && /show|list|what|my/.test(text)) {
      pick('getTasks', { dueSoonDays: 3, limit: 10 });
    } else if (/above \$?(\d+)|over \$?(\d+)|greater than \$?(\d+)/.test(text)) {
      const match = text.match(/(\d[\d,]*)/);
      const minValue = match ? parseInt(match[1].replace(/,/g, ''), 10) : undefined;
      pick('getDeals', { minValue, limit: 15 });
    } else if (/deals?|opportunit/.test(text)) {
      pick('getDeals', { limit: 15 });
    } else if (/lead/.test(text)) {
      pick('getLeads', { limit: 15 });
    } else if (/contact/.test(text)) {
      pick('getContacts', { limit: 15 });
    } else if (/activit/.test(text)) {
      pick('getActivities', { sinceDays: 7, limit: 15 });
    }

    if (toolCalls.length > 0) {
      return { content: '', toolCalls, stopReason: 'tool_use' };
    }

    return {
      content:
        "I can help with your pipeline, deals, leads, tasks, and activities using your real CRM data. Try asking things like \"show my hottest leads\", \"which deals are at risk\", or \"show my pipeline\".",
      toolCalls: [],
      stopReason: 'end_turn',
    };
  }

  /** Builds an email draft strictly from the getDeals tool result — never invents a deal that wasn't returned. */
  private composeDraftFromToolResult(toolResultJson: string, originalText: string): AIChatResult {
    let deals: DraftableDeal[] = [];
    try {
      deals = JSON.parse(toolResultJson) as DraftableDeal[];
    } catch {
      deals = [];
    }

    if (deals.length === 0) {
      return {
        content:
          "I couldn't find a deal matching that name in your CRM, so I'm not able to draft a follow-up — nothing was fabricated. Check the exact deal name under Deals and try again.",
        toolCalls: [],
        stopReason: 'end_turn',
      };
    }

    const deal = deals[0];
    const { subject, body } = generateEmailTemplate({
      dealName: deal.name,
      companyName: deal.company,
      contactName: deal.contact,
      dealValue: deal.value,
      currency: deal.currency,
      purpose: 'follow-up',
      reason: /at.?risk|cold|quiet|stalled/.test(originalText) ? 'the deal has gone quiet and needs a follow-up' : undefined,
    });

    const content = `Here's a draft follow-up for ${deal.name}${deal.company ? ` (${deal.company})` : ''}:\n\nSubject: ${subject}\n\n${body}`;
    return { content, toolCalls: [], stopReason: 'end_turn' };
  }

  async complete(_systemPrompt: string, userPrompt: string): Promise<string> {
    return userPrompt;
  }
}
