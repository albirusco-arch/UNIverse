/**
 * POST /functions/v1/opportunities  { request: OpportunityRequest }  ->  202 { id, balance }
 *
 * Charges the opportunity_match price in tokens, then searches the web with
 * Claude in the background for open postings and programmes that fit the
 * student (profile, filters and, if they choose, their CV). The app polls the
 * opportunity_searches row; tokens are refunded if the search fails.
 */
import Anthropic from '@anthropic-ai/sdk';

import { AgentError } from '../_shared/agent.ts';
import { loadCv } from '../_shared/cv.ts';
import { adminClient, corsHeaders, getCaller, json } from '../_shared/http.ts';
import { chargeTokens, refundJob } from '../_shared/tokens.ts';
import type { StudentContext } from './prompt.ts';
import { RequestSchema, type OpportunityRequest } from './schema.ts';
import { findOpportunities } from './search.ts';

const MODEL = Deno.env.get('CLAUDE_MODEL') ?? undefined;
const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

async function runSearch(id: string, request: OpportunityRequest, student: StudentContext, cv: string | null) {
  const admin = adminClient();
  try {
    const result = await findOpportunities(anthropic, request, student, cv, { model: MODEL });
    console.log(JSON.stringify({ event: 'opportunities_done', id, model: result.model, usage: result.usage }));
    await admin
      .from('opportunity_searches')
      .update({ status: 'done', report: result.report, model: result.model, completed_at: new Date().toISOString() })
      .eq('id', id);
  } catch (error) {
    console.error(JSON.stringify({ event: 'opportunities_failed', id, error: String(error) }));
    await admin
      .from('opportunity_searches')
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
  const cv = request.useCv ? await loadCv(admin, user.id) : null;
  if (request.useCv && !cv) return json({ error: 'no_cv' }, 400);

  const { data: profile } = await admin
    .from('profiles')
    .select('field, level, home_university, destination_id')
    .eq('id', user.id)
    .maybeSingle();
  const { data: destination } = profile?.destination_id
    ? await admin.from('universities').select('name').eq('id', profile.destination_id).maybeSingle()
    : { data: null };
  const { data: countries } = request.countries.length
    ? await admin.from('countries').select('code, name').in('code', request.countries)
    : { data: [] as { code: string; name: string }[] };

  const id = crypto.randomUUID();
  const charge = await chargeTokens(admin, user.id, 'opportunity_match', id);
  if (!charge.ok) return json({ error: charge.error }, charge.error === 'insufficient_tokens' ? 402 : 500);

  const { error } = await admin.from('opportunity_searches').insert({ id, user_id: user.id, request, status: 'running' });
  if (error) {
    await refundJob(admin, id);
    return json({ error: 'database_error' }, 500);
  }

  EdgeRuntime.waitUntil(
    runSearch(
      id,
      request,
      {
        field: profile?.field ?? null,
        level: profile?.level ?? null,
        homeUniversity: profile?.home_university ?? '',
        destination: destination?.name ?? '',
        countryNames: request.countries.map((code) => countries?.find((c) => c.code === code)?.name ?? code),
        hasCv: cv !== null,
        now: new Date(),
      },
      cv?.base64 ?? null,
    ),
  );
  return json({ id, balance: charge.balance }, 202);
});
