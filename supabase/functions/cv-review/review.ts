import type Anthropic from '@anthropic-ai/sdk';

import { runAgent, type Effort } from '../_shared/agent.ts';
import { buildInstructions, SYSTEM_PROMPT, type StudentContext } from './prompt.ts';
import { CvReportSchema, type CvReviewRequest } from './schema.ts';

export type ReviewOptions = { model?: string; effort?: Effort; now?: Date };

/** Reviews one CV (a PDF, base64-encoded) against the student's target. */
export async function reviewCv(
  client: Anthropic,
  pdfBase64: string,
  request: CvReviewRequest,
  student: StudentContext,
  options: ReviewOptions = {},
) {
  const now = options.now ?? new Date();
  const result = await runAgent({
    client,
    model: options.model,
    effort: options.effort ?? 'high',
    web: false,
    system: SYSTEM_PROMPT,
    prompt: [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
      { type: 'text', text: buildInstructions(request, student) },
    ],
    schema: CvReportSchema,
    toolName: 'submit_review',
    toolDescription: 'Submit the CV review. Call exactly once, after reading the whole CV.',
  });
  return { report: { ...result.output, checkedAt: now.toISOString() }, model: result.model, usage: result.usage };
}
