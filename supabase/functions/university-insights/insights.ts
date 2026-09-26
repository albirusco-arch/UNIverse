import type Anthropic from '@anthropic-ai/sdk';

import { runAgent, type Effort } from '../_shared/agent.ts';
import { buildUserPrompt, SYSTEM_PROMPT, type RatingContext } from './prompt.ts';
import { finalizeInsights, SubmittedInsightsSchema } from './schema.ts';

export async function researchInsights(
  client: Anthropic,
  university: { name: string; website: string; country: string },
  ratings: RatingContext,
  options: { model?: string; effort?: Effort; now?: Date } = {},
) {
  const now = options.now ?? new Date();
  const result = await runAgent({
    client,
    model: options.model,
    effort: options.effort,
    system: SYSTEM_PROMPT,
    prompt: buildUserPrompt(university, ratings, now),
    schema: SubmittedInsightsSchema,
    toolName: 'submit_insights',
    toolDescription:
      'Submit the ESG and teaching assessment and the student organisations. Call exactly once, with every indicator and club citing its sources.',
    webSearchMaxUses: 12,
    webFetchMaxUses: 10,
  });
  return {
    insights: finalizeInsights(result.output, result.retrievedUrls, now),
    model: result.model,
    usage: result.usage,
  };
}
