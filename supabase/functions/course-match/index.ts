/**
 * POST /functions/v1/course-match  { request: CourseMatchRequest }  ->  202 { id }
 *
 * Creates a course_matches row and researches it in the background with Claude;
 * the app polls the row until its status is "done" or "error".
 */
import Anthropic from '@anthropic-ai/sdk';

import { adminClient, corsHeaders, getCaller, json } from '../_shared/http.ts';
import { researchCourseMatch, ResearchError } from './research.ts';
import { RequestSchema, type CourseMatchRequest } from './schema.ts';

const DAILY_LIMIT = Number(Deno.env.get('COURSE_MATCH_DAILY_LIMIT') ?? '5');
const CACHE_DAYS = 14;
const MODEL = Deno.env.get('CLAUDE_MODEL') ?? undefined;

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

/** Stable hash of the request so identical research can be reused. */
async function requestHash(request: CourseMatchRequest): Promise<string> {
  const canonical = JSON.stringify({
    home: request.homeUniversity.toLowerCase(),
    program: request.program.toLowerCase(),
    level: request.level,
    destination: request.destinationId,
    term: request.term.toLowerCase(),
    courses: request.courses.map((c) => [c.name.toLowerCase(), c.ects]),
    notes: request.notes.toLowerCase(),
    locale: request.locale,
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function runResearch(id: string, request: CourseMatchRequest, website: string | null) {
  const admin = adminClient();
  try {
    const result = await researchCourseMatch(anthropic, request, { model: MODEL, destinationWebsite: website });
    console.log(JSON.stringify({ event: 'course_match_done', id, model: result.model, usage: result.usage }));
    await admin
      .from('course_matches')
      .update({ status: 'done', report: result.report, model: result.model, completed_at: new Date().toISOString() })
      .eq('id', id);
  } catch (error) {
    console.error(JSON.stringify({ event: 'course_match_failed', id, error: String(error) }));
    const message = error instanceof ResearchError ? error.code : 'internal_error';
    await admin
      .from('course_matches')
      .update({ status: 'error', error: message, completed_at: new Date().toISOString() })
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
  const { data: university } = await admin
    .from('universities')
    .select('id, name, website')
    .eq('id', request.destinationId)
    .maybeSingle();
  if (!university) return json({ error: 'unknown_destination' }, 400);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('course_matches')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('cached_from', null)
    .gte('created_at', since);
  if ((count ?? 0) >= DAILY_LIMIT) return json({ error: 'rate_limited' }, 429);

  const hash = await requestHash(request);
  const fresh = new Date(Date.now() - CACHE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: cached } = await admin
    .from('course_matches')
    .select('id, report, model')
    .eq('request_hash', hash)
    .eq('status', 'done')
    .gte('completed_at', fresh)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached) {
    const { data, error } = await admin
      .from('course_matches')
      .insert({
        user_id: user.id,
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
    .from('course_matches')
    .insert({ user_id: user.id, request, request_hash: hash, status: 'running' })
    .select('id')
    .single();
  if (error) return json({ error: 'database_error' }, 500);

  // Keep researching after the response is sent (bounded by the function's wall-clock limit).
  EdgeRuntime.waitUntil(runResearch(row.id, request, university.website));
  return json({ id: row.id }, 202);
});
