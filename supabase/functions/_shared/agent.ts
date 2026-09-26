/**
 * Generic research agent: Claude with server-side web search and web fetch,
 * finishing with a call to a "submit" tool whose input is validated against a
 * zod schema. Runtime-agnostic (Deno in production, Node in tests): the
 * Anthropic client is passed in.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

import { normalizeUrl } from './sources.ts';

type BetaMessage = Anthropic.Beta.Messages.BetaMessage;
type BetaCreateParams = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
type BetaMessageParam = Anthropic.Beta.Messages.BetaMessageParam;
type BetaContentBlock = Anthropic.Beta.Messages.BetaContentBlock;
type BetaToolUseBlock = Anthropic.Beta.Messages.BetaToolUseBlock;
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export const DEFAULT_MODEL = 'claude-opus-5';
/** Model turns, counting pause_turn continuations and schema retries. */
const MAX_TURNS = 8;
/** Above this output limit requests are streamed, so long submissions do not hit HTTP timeouts. */
const NON_STREAMING_MAX_TOKENS = 16000;

export type AgentErrorCode = 'refusal' | 'max_tokens' | 'no_report';

export class AgentError extends Error {
  code: AgentErrorCode;

  constructor(code: AgentErrorCode, message: string) {
    super(message);
    this.name = 'AgentError';
    this.code = code;
  }
}

export type AgentUsage = { inputTokens: number; outputTokens: number; cacheReadTokens: number; webSearches: number };

export type AgentOptions<S extends z.ZodType> = {
  client: Anthropic;
  system: string;
  prompt: string;
  schema: S;
  toolName: string;
  toolDescription: string;
  model?: string;
  effort?: Effort;
  webSearchMaxUses?: number;
  webFetchMaxUses?: number;
  /** Tokens of each fetched page the model reads (long PDF lists need more). */
  webFetchMaxContentTokens?: number;
  /** Output limit per turn (default 16k). Larger limits stream the request. */
  maxTokens?: number;
};

export type AgentResult<T> = {
  output: T;
  retrievedUrls: Set<string>;
  model: string;
  usage: AgentUsage;
};

/** URLs the search and fetch tools actually returned in this response. */
export function collectRetrievedUrls(content: BetaContentBlock[], into: Set<string>) {
  for (const block of content) {
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const result of block.content) {
        const url = normalizeUrl(result.url);
        if (url) into.add(url);
      }
    } else if (block.type === 'web_fetch_tool_result' && block.content.type === 'web_fetch_result') {
      const url = normalizeUrl(block.content.url);
      if (url) into.add(url);
    }
  }
}

/** JSON Schema for a tool definition, generated from the zod schema. */
export function toolInputSchema(schema: z.ZodType): { type: 'object'; [key: string]: unknown } {
  const { $schema: _ignored, ...json } = z.toJSONSchema(schema) as Record<string, unknown>;
  return { ...json, type: 'object' };
}

function findSubmission(message: BetaMessage, toolName: string): BetaToolUseBlock | undefined {
  return message.content.find(
    (block): block is BetaToolUseBlock => block.type === 'tool_use' && block.name === toolName,
  );
}

export async function runAgent<S extends z.ZodType>(options: AgentOptions<S>): Promise<AgentResult<z.infer<S>>> {
  const { client, schema, toolName } = options;
  const model = options.model ?? DEFAULT_MODEL;
  const retrievedUrls = new Set<string>();
  const usage: AgentUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, webSearches: 0 };
  const inputSchema = toolInputSchema(schema);
  const messages: BetaMessageParam[] = [{ role: 'user', content: options.prompt }];

  const maxTokens = options.maxTokens ?? NON_STREAMING_MAX_TOKENS;
  const streamed = maxTokens > NON_STREAMING_MAX_TOKENS;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const params: BetaCreateParams = {
      model,
      max_tokens: maxTokens,
      // On a safety decline, let the API re-run the request on the recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: options.effort ?? 'high' },
      cache_control: { type: 'ephemeral' },
      system: options.system,
      tools: [
        { type: 'web_search_20260209', name: 'web_search', max_uses: options.webSearchMaxUses ?? 10 },
        {
          type: 'web_fetch_20260209',
          name: 'web_fetch',
          max_uses: options.webFetchMaxUses ?? 8,
          max_content_tokens: options.webFetchMaxContentTokens ?? 20000,
        },
        {
          name: toolName,
          description: options.toolDescription,
          input_schema: inputSchema,
          // Streamed submissions arrive incrementally; the schema check below catches truncated input.
          ...(streamed ? { eager_input_streaming: true } : {}),
        },
      ],
      tool_choice: { type: 'auto' },
      messages,
    };
    const response = streamed
      ? await client.beta.messages.stream(params).finalMessage()
      : await client.beta.messages.create(params);

    usage.inputTokens += response.usage.input_tokens;
    usage.outputTokens += response.usage.output_tokens;
    usage.cacheReadTokens += response.usage.cache_read_input_tokens ?? 0;
    usage.webSearches += response.usage.server_tool_use?.web_search_requests ?? 0;
    collectRetrievedUrls(response.content, retrievedUrls);

    if (response.stop_reason === 'refusal') {
      throw new AgentError('refusal', 'The request was declined.');
    }
    if (response.stop_reason === 'max_tokens') {
      throw new AgentError('max_tokens', 'The response hit the token limit.');
    }

    messages.push({ role: 'assistant', content: response.content });

    const submission = findSubmission(response, toolName);
    if (submission) {
      const parsed = schema.safeParse(submission.input);
      if (parsed.success) {
        return { output: parsed.data, retrievedUrls, model: response.model, usage };
      }
      // Ask for a corrected submission instead of failing the whole research.
      const issues = parsed.error.issues
        .slice(0, 8)
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ');
      messages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: submission.id,
            is_error: true,
            content: `The submission does not match the schema (${issues}). Call ${toolName} again with a corrected version.`,
          },
        ],
      });
      continue;
    }

    if (response.stop_reason === 'pause_turn') {
      // Long server-tool turn: resend as-is and the API resumes where it stopped.
      continue;
    }

    messages.push({
      role: 'user',
      content: `Now call ${toolName} with your findings. Only include items supported by pages you found in this session.`,
    });
  }

  throw new AgentError('no_report', `No valid submission after ${MAX_TURNS} turns.`);
}
