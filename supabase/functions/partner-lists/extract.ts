import type Anthropic from '@anthropic-ai/sdk';

import { runAgent, type Effort } from '../_shared/agent.ts';
import { buildUserPrompt, SYSTEM_PROMPT } from './prompt.ts';
import { finalizePartners, MAX_PARTNERS, SubmittedPartnersSchema } from './schema.ts';

export async function extractPartners(
  client: Anthropic,
  home: { name: string; website: string; country: string },
  options: { model?: string; effort?: Effort; now?: Date } = {},
) {
  const now = options.now ?? new Date();
  const result = await runAgent({
    client,
    model: options.model,
    effort: options.effort,
    system: SYSTEM_PROMPT,
    prompt: buildUserPrompt(home, now),
    schema: SubmittedPartnersSchema,
    toolName: 'submit_partners',
    toolDescription: `Submit the partner institutions found on the official lists (at most ${MAX_PARTNERS}). Call exactly once; every partner cites the list it appears on.`,
    webSearchMaxUses: 8,
    webFetchMaxUses: 8,
    // Partner lists are long (often PDFs): read more of each page and allow a long submission.
    webFetchMaxContentTokens: 60000,
    maxTokens: 64000,
  });
  return {
    ...finalizePartners(result.output, result.retrievedUrls, now),
    model: result.model,
    usage: result.usage,
  };
}
