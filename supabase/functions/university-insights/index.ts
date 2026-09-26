/**
 * POST /functions/v1/university-insights  { universityId }  ->  { status }
 *
 * Returns the cached ESG / teaching insights when they are fresh; otherwise marks
 * them "running", researches them in the background with Claude, stores the
 * verified result and upserts the student clubs it found. The combined UNIVERSE
 * score (with student ratings) is computed by the university_scores view.
 */
import Anthropic from '@anthropic-ai/sdk';

import { AgentError } from '../_shared/agent.ts';
import { adminClient, corsHeaders, getCaller, json } from '../_shared/http.ts';
import { researchInsights } from './insights.ts';

const FRESH_DAYS = Number(Deno.env.get('INSIGHTS_FRESH_DAYS') ?? '90');
const DAILY_LIMIT = Number(Deno.env.get('INSIGHTS_DAILY_LIMIT') ?? '3');
const RUNNING_TIMEOUT_MS = 15 * 60 * 1000;
const MODEL = Deno.env.get('CLAUDE_MODEL') ?? undefined;

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

async function run(universityId: string) {
  const admin = adminClient();
  try {
    const { data: university, error: universityError } = await admin
      .from('universities')
      .select('name, website, country')
      .eq('id', universityId)
      .single();
    if (universityError || !university) throw new Error(`University ${universityId} not found`);
    const { data: score } = await admin
      .from('university_scores')
      .select('rating_count, teaching_avg, professors_avg, environment_avg, sustainability_avg')
      .eq('university_id', universityId)
      .maybeSingle();

    const result = await researchInsights(
      anthropic,
      university,
      {
        count: score?.rating_count ?? 0,
        teaching: score?.teaching_avg ?? null,
        professors: score?.professors_avg ?? null,
        environment: score?.environment_avg ?? null,
        sustainability: score?.sustainability_avg ?? null,
      },
      { model: MODEL },
    );
    const { insights } = result;
    console.log(JSON.stringify({ event: 'insights_done', universityId, model: result.model, usage: result.usage }));

    await admin
      .from('university_insights')
      .update({
        status: 'done',
        summary: insights.summary,
        esg_score: insights.esgScore,
        teaching_score: insights.teachingScore,
        indicators: insights.indicators,
        sources: insights.sources,
        model: result.model,
        error: null,
        checked_at: insights.checkedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('university_id', universityId);

    if (insights.clubs.length) {
      // Clubs found by the agent never overwrite clubs added by students.
      const { data: existing } = await admin.from('clubs').select('name').eq('university_id', universityId);
      const known = new Set((existing ?? []).map((c: { name: string }) => c.name.toLowerCase()));
      const fresh = insights.clubs
        .filter((club) => !known.has(club.name.toLowerCase()))
        .map((club) => ({
          university_id: universityId,
          name: club.name,
          category: club.category,
          description: club.description,
          website: club.website,
          instagram: club.instagram,
          source: 'ai',
          source_url: club.sourceUrl,
          verified: club.verified,
        }));
      if (fresh.length) await admin.from('clubs').insert(fresh);
    }
  } catch (error) {
    console.error(JSON.stringify({ event: 'insights_failed', universityId, error: String(error) }));
    await admin
      .from('university_insights')
      .update({
        status: 'error',
        error: error instanceof AgentError ? error.code : 'internal_error',
        updated_at: new Date().toISOString(),
      })
      .eq('university_id', universityId);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const user = await getCaller(req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  const body = await req.json().catch(() => null);
  const universityId = typeof body?.universityId === 'string' ? body.universityId : '';
  const admin = adminClient();
  const { data: university } = await admin.from('universities').select('id').eq('id', universityId).maybeSingle();
  if (!university) return json({ error: 'unknown_university' }, 400);

  const { data: current } = await admin
    .from('university_insights')
    .select('status, checked_at, updated_at')
    .eq('university_id', universityId)
    .maybeSingle();

  const now = Date.now();
  if (current?.status === 'done' && current.checked_at && now - Date.parse(current.checked_at) < FRESH_DAYS * 86_400_000) {
    return json({ status: 'done' });
  }
  if (current?.status === 'running' && now - Date.parse(current.updated_at) < RUNNING_TIMEOUT_MS) {
    return json({ status: 'running' });
  }

  const since = new Date(now - 86_400_000).toISOString();
  const { count } = await admin
    .from('university_insights')
    .select('university_id', { count: 'exact', head: true })
    .eq('requested_by', user.id)
    .gte('updated_at', since);
  if ((count ?? 0) >= DAILY_LIMIT) return json({ error: 'rate_limited' }, 429);

  const { error } = await admin.from('university_insights').upsert({
    university_id: universityId,
    status: 'running',
    requested_by: user.id,
    updated_at: new Date(now).toISOString(),
  });
  if (error) return json({ error: 'database_error' }, 500);

  EdgeRuntime.waitUntil(run(universityId));
  return json({ status: 'running' }, 202);
});
