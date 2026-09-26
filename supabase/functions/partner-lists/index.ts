/**
 * POST /functions/v1/partner-lists  { universityId }  ->  { status }
 *
 * Reads the official exchange partner list of the caller's home university
 * with Claude, in the background. Partners are stored only when they appear on
 * an official page retrieved in the session and match a catalogue university
 * exactly (Erasmus code, official domain or exact name in the same country);
 * the rest are recorded as unmatched for review. Stored rows are marked
 * source "ai" and stay unverified until an admin confirms them.
 */
import Anthropic from '@anthropic-ai/sdk';

import { AgentError } from '../_shared/agent.ts';
import { adminClient, corsHeaders, getCaller, json } from '../_shared/http.ts';
import { extractPartners } from './extract.ts';
import { departmentKind, matchPartners, type CatalogueRow } from './schema.ts';

const FRESH_DAYS = Number(Deno.env.get('PARTNERS_FRESH_DAYS') ?? '30');
const RETRY_AFTER_ERROR_MS = 6 * 60 * 60 * 1000;
const RUNNING_TIMEOUT_MS = 15 * 60 * 1000;
const MODEL = Deno.env.get('CLAUDE_MODEL') ?? undefined;

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

type Admin = ReturnType<typeof adminClient>;

/** Catalogue rows of the given countries (paged: the API returns at most 1000 rows per request). */
async function catalogueFor(admin: Admin, countries: string[]): Promise<CatalogueRow[]> {
  const rows: CatalogueRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from('universities')
      .select('id, name, country_code, website, email_domains, erasmus_code')
      .in('country_code', countries)
      .order('id')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data as CatalogueRow[]));
    if (!data || data.length < 1000) return rows;
  }
}

async function run(universityId: string) {
  const admin = adminClient();
  try {
    const { data: home, error: homeError } = await admin
      .from('universities')
      .select('name, website, country')
      .eq('id', universityId)
      .single();
    if (homeError || !home) throw new Error(`University ${universityId} not found`);

    const result = await extractPartners(anthropic, home, { model: MODEL });
    console.log(JSON.stringify({ event: 'partners_read', universityId, found: result.partners.length, model: result.model, usage: result.usage }));

    const countries = [...new Set(result.partners.map((p) => p.countryCode))];
    const catalogue = countries.length ? await catalogueFor(admin, countries) : [];
    const { matched, unmatched } = matchPartners(result.partners, catalogue, universityId);
    const today = result.checkedAt.slice(0, 10);

    // Departments named on the list (new ones only; existing rows are kept as they are).
    const departmentNames = [...new Set(matched.map((m) => m.partner.department.trim()).filter((name) => name.length >= 2))];
    if (departmentNames.length) {
      const { error } = await admin.from('departments').upsert(
        departmentNames.map((name) => ({
          university_id: universityId,
          name,
          kind: departmentKind(name),
          source: 'ai',
          source_url: matched.find((m) => m.partner.department.trim() === name)!.partner.sourceUrl,
          last_verified: today,
        })),
        { onConflict: 'university_id,name_key', ignoreDuplicates: true },
      );
      if (error) throw error;
    }
    const { data: departments } = await admin.from('departments').select('id, name').eq('university_id', universityId);
    const departmentId = (name: string) =>
      (departments ?? []).find((d: { id: string; name: string }) => d.name.toLowerCase() === name.trim().toLowerCase())?.id ?? null;

    // Replace the previous AI reading; admin imports and student suggestions stay untouched.
    await admin.from('partnerships').delete().eq('home_university_id', universityId).eq('source', 'ai').eq('verified', false);
    const { data: kept } = await admin
      .from('partnerships')
      .select('partner_university_id, agreement_type, home_department_id')
      .eq('home_university_id', universityId);
    const key = (partner: string, type: string, department: string | null) => `${partner}|${type}|${department ?? ''}`;
    const taken = new Set(
      (kept ?? []).map((row: { partner_university_id: string; agreement_type: string; home_department_id: string | null }) =>
        key(row.partner_university_id, row.agreement_type, row.home_department_id),
      ),
    );
    const rows = [];
    for (const { partner, universityId: partnerId } of matched) {
      const department = partner.department ? departmentId(partner.department) : null;
      const rowKey = key(partnerId, partner.agreementType, department);
      if (taken.has(rowKey)) continue;
      taken.add(rowKey);
      rows.push({
        home_university_id: universityId,
        partner_university_id: partnerId,
        agreement_type: partner.agreementType,
        home_department_id: department,
        isced_codes: partner.iscedCodes,
        levels: partner.levels,
        languages: partner.languages,
        language_level: partner.languageLevel,
        places: partner.places,
        academic_year: partner.academicYear,
        source: 'ai',
        source_url: partner.sourceUrl,
        verified: false,
        last_verified: today,
      });
    }
    if (rows.length) {
      const { error } = await admin.from('partnerships').insert(rows);
      if (error) throw error;
    }

    await admin
      .from('partner_extractions')
      .update({
        status: 'done',
        found: result.partners.length,
        matched: matched.length,
        unmatched: unmatched.slice(0, 300),
        sources: result.sources,
        model: result.model,
        error: null,
        checked_at: result.checkedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('university_id', universityId);
  } catch (error) {
    console.error(JSON.stringify({ event: 'partners_failed', universityId, error: String(error) }));
    await admin
      .from('partner_extractions')
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

  // A reading costs an AI run: students can only have their own university's list read.
  const { data: profile } = await admin.from('profiles').select('home_university_id').eq('id', user.id).maybeSingle();
  if (!universityId || profile?.home_university_id !== universityId) return json({ error: 'not_your_university' }, 403);

  const { data: current } = await admin
    .from('partner_extractions')
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
  if (current?.status === 'error' && now - Date.parse(current.updated_at) < RETRY_AFTER_ERROR_MS) {
    return json({ error: 'rate_limited' }, 429);
  }

  const { error } = await admin.from('partner_extractions').upsert({
    university_id: universityId,
    status: 'running',
    requested_by: user.id,
    error: null,
    updated_at: new Date(now).toISOString(),
  });
  if (error) return json({ error: 'internal_error' }, 500);

  EdgeRuntime.waitUntil(run(universityId));
  return json({ status: 'running' }, 202);
});
