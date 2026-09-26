import type Anthropic from '@anthropic-ai/sdk';

import { runAgent, type Effort } from '../_shared/agent.ts';
import { buildUserPrompt, SYSTEM_PROMPT } from './prompt.ts';
import { finalizeReport, SubmittedReportSchema, type ResearchRequest } from './schema.ts';

export type ResearchOptions = {
  model?: string;
  effort?: Effort;
  destinationWebsite?: string | null;
  destinationCountryName?: string;
  citizenshipName?: string;
  now?: Date;
};

/** Runs one research request end to end and returns the verified report. */
export async function research(client: Anthropic, request: ResearchRequest, options: ResearchOptions = {}) {
  const now = options.now ?? new Date();
  const result = await runAgent({
    client,
    model: options.model,
    effort: options.effort,
    system: SYSTEM_PROMPT,
    prompt: buildUserPrompt(request, {
      destinationWebsite: options.destinationWebsite ?? null,
      destinationCountryName: options.destinationCountryName ?? request.destinationCountry,
      citizenshipName: options.citizenshipName ?? request.citizenship,
      now,
    }),
    schema: SubmittedReportSchema,
    toolName: 'submit_report',
    toolDescription:
      'Submit the final research report. Call exactly once, after researching, with every item citing the ids of the sources that support it.',
  });
  return {
    report: finalizeReport(result.output, result.retrievedUrls, now),
    model: result.model,
    usage: result.usage,
  };
}
