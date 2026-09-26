/**
 * POST /functions/v1/cv-review  { request: CvReviewRequest }  ->  202 { id, balance }
 *
 * Charges the cv_review price in tokens, then reviews the student's uploaded CV
 * with Claude in the background; the app polls the cv_reviews row. The tokens
 * are refunded if the review fails.
 */
import Anthropic from '@anthropic-ai/sdk';

import { AgentError } from '../_shared/agent.ts';
import { loadCv } from '../_shared/cv.ts';
import { adminClient, corsHeaders, getCaller, json } from '../_shared/http.ts';
import { chargeTokens, refundJob } from '../_shared/tokens.ts';
import type { StudentContext } from './prompt.ts';
import { reviewCv } from './review.ts';
import { RequestSchema, type CvReviewRequest } from './schema.ts';

const MODEL = Deno.env.get('CLAUDE_MODEL') ?? undefined;
const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

async function runReview(id: string, pdf: string, request: CvReviewRequest, student: StudentContext) {
  const admin = adminClient();
  try {
    const result = await reviewCv(anthropic, pdf, request, student, { model: MODEL });
    console.log(JSON.stringify({ event: 'cv_review_done', id, model: result.model, usage: result.usage }));
    await admin
      .from('cv_reviews')
      .update({ status: 'done', report: result.report, model: result.model, completed_at: new Date().toISOString() })
      .eq('id', id);
  } catch (error) {
    console.error(JSON.stringify({ event: 'cv_review_failed', id, error: String(error) }));
    await admin
      .from('cv_reviews')
      .update({
        status: 'error',
        error: error instanceof AgentError ? error.code : 'internal_error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id);
    await refundJob(admin, id);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const user = await getCaller(req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body?.request);
  if (!parsed.success) return json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
  const request = parsed.data;

  const admin = adminClient();
  const cv = await loadCv(admin, user.id);
  if (!cv) return json({ error: 'no_cv' }, 400);

  const { data: profile } = await admin
    .from('profiles')
    .select('field, level, home_university')
    .eq('id', user.id)
    .maybeSingle();
  const { data: country } = request.country
    ? await admin.from('countries').select('name').eq('code', request.country).maybeSingle()
    : { data: null };

  const id = crypto.randomUUID();
  const charge = await chargeTokens(admin, user.id, 'cv_review', id);
  if (!charge.ok) return json({ error: charge.error }, charge.error === 'insufficient_tokens' ? 402 : 500);

  const { error } = await admin.from('cv_reviews').insert({ id, user_id: user.id, request, status: 'running' });
  if (error) {
    await refundJob(admin, id);
    return json({ error: 'database_error' }, 500);
  }

  EdgeRuntime.waitUntil(
    runReview(id, cv.base64, request, {
      field: profile?.field ?? null,
      level: profile?.level ?? null,
      homeUniversity: profile?.home_university ?? '',
      countryName: country?.name ?? '',
    }),
  );
  return json({ id, balance: charge.balance }, 202);
});
