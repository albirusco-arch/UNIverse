/**
 * The research agent: Claude with server-side web search and web fetch, which
 * ends by calling `submit_report`. Runtime-agnostic (Deno in production, Node in
 * tests): the Anthropic client is passed in.
 */
import type Anthropic from '@anthropic-ai/sdk';

import { buildUserPrompt, SYSTEM_PROMPT } from './prompt.ts';
import {
  finalizeReport,
  normalizeUrl,
  submitReportInputSchema,
  SubmittedReportSchema,
  type CourseMatchRequest,
  type FinalReport,
} from './schema.ts';

type BetaMessage = Anthropic.Beta.Messages.BetaMessage;
type BetaMessageParam = Anthropic.Beta.Messages.BetaMessageParam;
type BetaContentBlock = Anthropic.Beta.Messages.BetaContentBlock;
type BetaToolUseBlock = Anthropic.Beta.Messages.BetaToolUseBlock;
type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export const DEFAULT_MODEL = 'claude-opus-5';
const SUBMIT_TOOL = 'submit_report';
/** Model turns, counting pause_turn continuations and schema retries. */
const MAX_TURNS = 8;

export type ResearchErrorCode = 'refusal' | 'max_tokens' | 'no_report';

export class ResearchError extends Error {
  code: ResearchErrorCode;

  constructor(code: ResearchErrorCode, message: string) {
    super(message);
    this.name = 'ResearchError';
    this.code = code;
  }
}

export type ResearchOptions = {
  model?: string;
  effort?: Effort;
  destinationWebsite?: string | null;
  now?: Date;
};

export type ResearchResult = {
  report: FinalReport;
  model: string;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; webSearches: number };
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

function findSubmission(message: BetaMessage): BetaToolUseBlock | undefined {
  return message.content.find(
    (block): block is BetaToolUseBlock => block.type === 'tool_use' && block.name === SUBMIT_TOOL,
  );
}

export async function researchCourseMatch(
  client: Anthropic,
  request: CourseMatchRequest,
  options: ResearchOptions = {},
): Promise<ResearchResult> {
  const model = options.model ?? DEFAULT_MODEL;
  const now = options.now ?? new Date();
  const retrieved = new Set<string>();
  const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, webSearches: 0 };

  const messages: BetaMessageParam[] = [
    { role: 'user', content: buildUserPrompt(request, options.destinationWebsite ?? null, now) },
  ];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      // On a safety decline, let the API re-run the request on the recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: options.effort ?? 'high' },
      cache_control: { type: 'ephemeral' },
      system: SYSTEM_PROMPT,
      tools: [
        { type: 'web_search_20260209', name: 'web_search', max_uses: 10 },
        { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 8, max_content_tokens: 20000 },
        {
          name: SUBMIT_TOOL,
          description:
            'Submit the final research report. Call exactly once, after researching, with every item citing the ids of the sources that support it.',
          input_schema: submitReportInputSchema(),
        },
      ],
      tool_choice: { type: 'auto' },
      messages,
    });

    usage.inputTokens += response.usage.input_tokens;
    usage.outputTokens += response.usage.output_tokens;
    usage.cacheReadTokens += response.usage.cache_read_input_tokens ?? 0;
    usage.webSearches += response.usage.server_tool_use?.web_search_requests ?? 0;
    collectRetrievedUrls(response.content, retrieved);

    if (response.stop_reason === 'refusal') {
      throw new ResearchError('refusal', 'The request was declined.');
    }
    if (response.stop_reason === 'max_tokens') {
      throw new ResearchError('max_tokens', 'The response hit the token limit.');
    }

    messages.push({ role: 'assistant', content: response.content });

    const submission = findSubmission(response);
    if (submission) {
      const parsed = SubmittedReportSchema.safeParse(submission.input);
      if (parsed.success) {
        return {
          report: finalizeReport(parsed.data, retrieved, now),
          model: response.model,
          usage,
        };
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
            content: `The report does not match the schema (${issues}). Call ${SUBMIT_TOOL} again with a corrected report.`,
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
      content: `Now call ${SUBMIT_TOOL} with your findings. Only include items supported by pages you found in this session.`,
    });
  }

  throw new ResearchError('no_report', `No valid report after ${MAX_TURNS} turns.`);
}
