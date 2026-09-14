import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env';
import { AIChatMessage, AIChatResult, AIProvider, AIToolCall, AIToolDefinition } from '../types';
import { logger } from '../../utils/logger';

type ContentBlockParam = Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam;
type AnthropicMessage = { role: 'user' | 'assistant'; content: string | ContentBlockParam[] };

/**
 * Converts our provider-agnostic AIChatMessage[] into Anthropic's required
 * message shape. This matters specifically for tool use: Anthropic's API
 * requires an assistant turn that calls a tool to contain a `tool_use`
 * content block, immediately followed by a `user` turn containing a matching
 * `tool_result` block (referencing the same tool_use_id) — a plain text
 * message in place of either is rejected by the API. aiService.chat() logs
 * our generic messages as one 'assistant' message per turn followed by one
 * 'tool' message per call in that turn; we regroup them here.
 */
function toAnthropicMessages(messages: AIChatMessage[]): AnthropicMessage[] {
  const result: AnthropicMessage[] = [];
  let i = 0;
  const conversation = messages.filter((m) => m.role !== 'system');

  while (i < conversation.length) {
    const msg = conversation[i];

    if (msg.role === 'tool') {
      // Should have been consumed as part of the preceding assistant turn below;
      // if we land here directly (e.g. malformed history), treat it as a user turn.
      result.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: msg.toolCallId ?? `unknown_${i}`, content: msg.content }],
      });
      i += 1;
      continue;
    }

    if (msg.role === 'assistant') {
      // Gather every 'tool' message immediately following this assistant turn — those
      // represent the tool_use calls this assistant turn made.
      const toolMsgs: AIChatMessage[] = [];
      let j = i + 1;
      while (j < conversation.length && conversation[j].role === 'tool') {
        toolMsgs.push(conversation[j]);
        j += 1;
      }

      if (toolMsgs.length > 0) {
        const assistantBlocks: ContentBlockParam[] = [];
        if (msg.content) assistantBlocks.push({ type: 'text', text: msg.content });
        for (const t of toolMsgs) {
          assistantBlocks.push({ type: 'tool_use', id: t.toolCallId ?? `tool_${j}`, name: t.name ?? 'unknown_tool', input: t.toolInput ?? {} });
        }
        result.push({ role: 'assistant', content: assistantBlocks });

        const toolResultBlocks: ContentBlockParam[] = toolMsgs.map((t) => ({
          type: 'tool_result',
          tool_use_id: t.toolCallId ?? 'unknown',
          content: t.content,
        }));
        result.push({ role: 'user', content: toolResultBlocks });

        i = j;
        continue;
      }

      result.push({ role: 'assistant', content: msg.content });
      i += 1;
      continue;
    }

    // 'user'
    result.push({ role: 'user', content: msg.content });
    i += 1;
  }

  return result;
}

/**
 * Production AI provider backed by the Claude API. Only instantiated when
 * AI_PROVIDER=anthropic and AI_API_KEY is set. Uses native tool-use so the
 * model can only act through the real CRM tool functions — it cannot
 * fabricate database facts, it can only request a tool call and receive
 * real results back.
 */
export class AnthropicAIProvider implements AIProvider {
  readonly name = 'anthropic';
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: env.aiApiKey });
  }

  async chat(messages: AIChatMessage[], tools: AIToolDefinition[] = []): Promise<AIChatResult> {
    const system = messages.find((m) => m.role === 'system')?.content;
    const anthropicMessages = toAnthropicMessages(messages);

    try {
      const response = await this.client.messages.create({
        model: env.aiModel,
        max_tokens: 1024,
        system,
        messages: anthropicMessages as never,
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.parameters as never,
        })),
      });

      const toolCalls: AIToolCall[] = [];
      let content = '';
      for (const block of response.content) {
        if (block.type === 'text') content += block.text;
        if (block.type === 'tool_use') {
          toolCalls.push({ id: block.id, name: block.name, arguments: block.input as Record<string, unknown> });
        }
      }

      return {
        content,
        toolCalls,
        stopReason: response.stop_reason === 'tool_use' ? 'tool_use' : 'end_turn',
      };
    } catch (err) {
      logger.error('Anthropic chat() failed', { error: (err as Error).message });
      throw err;
    }
  }

  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: env.aiModel,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      return response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    } catch (err) {
      logger.error('Anthropic complete() failed', { error: (err as Error).message });
      throw err;
    }
  }
}
