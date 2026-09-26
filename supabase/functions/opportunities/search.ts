import type Anthropic from '@anthropic-ai/sdk';

import { runAgent, type Effort } from '../_shared/agent.ts';
import { buildInstructions, SYSTEM_PROMPT, type StudentContext } from './prompt.ts';
import { finalizeResults, SubmittedResultsSchema, type OpportunityRequest } from './schema.ts';

export type SearchOptions = { model?: string; effort?: Effort };

/** Finds and verifies opportunities for one student; the CV (base64 PDF) is optional. */
export async function findOpportunities(
  client: Anthropic,
  request: OpportunityRequest,
  student: StudentContext,
  cvBase64: string | null,
  options: SearchOptions = {},
) {
  const instructions = buildInstructions(request, { ...student, hasCv: cvBase64 !== null });
  const result = await runAgent({
    client,
    model: options.model,
    effort: options.effort ?? 'high',
    system: SYSTEM_PROMPT,
    prompt: cvBase64
      ? [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: cvBase64 } },
          { type: 'text', text: instructions },
        ]
      : instructions,
    schema: SubmittedResultsSchema,
    toolName: 'submit_results',
    toolDescription:
      'Submit the opportunities found. Call exactly once, after searching, with every item citing the ids of the sources that support it.',
    webSearchMaxUses: 12,
    webFetchMaxUses: 10,
  });
  return {
    report: finalizeResults(result.output, result.retrievedUrls, student.now),
    model: result.model,
    usage: result.usage,
  };
}
