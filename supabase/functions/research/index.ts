/**
 * POST /functions/v1/research  { request: ResearchRequest }  ->  202 { id }
 *
 * Creates a research_requests row and researches it in the background with
 * Claude; the app polls the row until its status is "done" or "error".
 * Kinds: exchange course matching, entry requirements, scholarships, visas.
 */
import Anthropic from '@anthropic-ai/sdk';

import { AgentError } from '../_shared/agent.ts';
import { adminClient, corsHeaders, getCaller, json } from '../_shared/http.ts';
import { research } from './research.ts';
import { RequestSchema, type ResearchRequest } from './schema.ts';

const DAILY_LIMIT = Number(Deno.env.get('RESEARCH_DAILY_LIMIT') ?? '5');
const CACHE_DAYS = 14;
const MODEL = Deno.env.get('CLAUDE_MODEL') ?? undefined;

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

/** Stable hash of the request so identical research can be reused. */
async function requestHash(request: ResearchRequest): Promise<string> {
  const lower = (value: string) => value.toLowerCase();
  const canonical = JSON.stringify({
    kind: request.kind,
    home: lower(request.homeUniversity),
    program: lower(request.program),
    level: request.level,
    field: request.field,
    destination: request.destinationId,
    country: request.destinationCountry,
    citizenship: request.citizenship,
    qualification: lower(request.qualification),
    studyType: request.studyType,
    term: lower(request.term),
    duration: request.durationMonths,
    courses: request.courses.map((c) => [lower(c.name), c.ects]),
    notes: lower(request.notes),
    language: request.language,
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function runResearch(
  id: string,
  request: ResearchRequest,
  context: { website: string | null; destinationCountryName: string; citizenshipName: string },
) {
  const admin = adminClient();
  try {
    const result = await research(anthropic, request, {
      model: MODEL,
      destinationWebsite: context.website,
      destinationCountryName: context.destinationCountryName,
      citizenshipName: context.citizenshipName,
    });
    console.log(JSON.stringify({ event: 'research_done', id, kind: request.kind, model: result.model, usage: result.usage }));
    await admin
      .from('research_requests')
      .update({ status: 'done', report: result.report, model: result.model, completed_at: new Date().toISOString() })
      .eq('id', id);
  } catch (error) {
    console.error(JSON.stringify({ event: 'research_failed', id, error: String(error) }));
    await admin
      .from('research_requests')
      .update({
        status: 'error',
        error: error instanceof AgentError ? error.code : 'internal_error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id);
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
  let website: string | null = null;
  let destinationCountry = request.destinationCountry;
  if (request.destinationId) {
    const { data: university } = await admin
      .from('universities')
      .select('id, name, website, country_code')
      .eq('id', request.destinationId)
      .maybeSingle();
    if (!university) return json({ error: 'unknown_destination' }, 400);
    website = university.website;
    destinationCountry ||= university.country_code;
  }
  const codes = [destinationCountry, request.citizenship].filter(Boolean);
  const { data: countries } = codes.length
    ? await admin.from('countries').select('code, name').in('code', codes)
    : { data: [] as { code: string; name: string }[] };
  const countryName = (code: string) => countries?.find((c) => c.code === code)?.name ?? code;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('research_requests')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('cached_from', null)
    .gte('created_at', since);
  if ((count ?? 0) >= DAILY_LIMIT) return json({ error: 'rate_limited' }, 429);

  const hash = await requestHash(request);
  const fresh = new Date(Date.now() - CACHE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: cached } = await admin
    .from('research_requests')
    .select('id, report, model')
    .eq('request_hash', hash)
    .eq('status', 'done')
    .gte('completed_at', fresh)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached) {
    const { data, error } = await admin
      .from('research_requests')
      .insert({
        user_id: user.id,
        kind: request.kind,
        request,
        request_hash: hash,
        status: 'done',
        report: cached.report,
        model: cached.model,
        cached_from: cached.id,
        completed_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error) return json({ error: 'database_error' }, 500);
    return json({ id: data.id, cached: true }, 200);
  }

  const { data: row, error } = await admin
    .from('research_requests')
    .insert({ user_id: user.id, kind: request.kind, request, request_hash: hash, status: 'running' })
    .select('id')
    .single();
  if (error) return json({ error: 'database_error' }, 500);

  // Keep researching after the response is sent (bounded by the function's wall-clock limit).
  EdgeRuntime.waitUntil(
    runResearch(row.id, request, {
      website,
      destinationCountryName: countryName(destinationCountry),
      citizenshipName: countryName(request.citizenship),
    }),
  );
  return json({ id: row.id }, 202);
});
