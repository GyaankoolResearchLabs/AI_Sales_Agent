export interface AIToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON schema
}

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  name?: string;
  /** Original arguments used for the tool call this message reports the result of — needed to replay a
   *  correctly-formed tool_use block back to providers (like Anthropic) whose API requires it. */
  toolInput?: Record<string, unknown>;
}

export interface AIToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AIChatResult {
  content: string;
  toolCalls: AIToolCall[];
  stopReason: 'tool_use' | 'end_turn';
}

/**
 * Abstraction over any LLM backend. Concrete providers (Anthropic, local
 * rule-based) implement this so the rest of the app never depends on a
 * specific vendor's SDK or API shape.
 */
export interface AIProvider {
  readonly name: string;

  /** One assistant turn, optionally able to request tool calls. */
  chat(messages: AIChatMessage[], tools?: AIToolDefinition[]): Promise<AIChatResult>;

  /** Plain text completion for content generation (email/whatsapp/script drafting, summarization). */
  complete(systemPrompt: string, userPrompt: string): Promise<string>;
}
