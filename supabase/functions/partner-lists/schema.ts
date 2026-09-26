/**
 * Reading a home university's official exchange partner list: the partners
 * Claude submits, the server-side source check, and the match against the
 * university catalogue. Aligned with `Partnership` in src/data/types.ts.
 */
import { z } from 'zod';

import { createVerifier, SourceIds, SourceSchema } from '../_shared/sources.ts';

export const AGREEMENT_TYPES = ['erasmus', 'bilateral', 'other'] as const;
export const MAX_PARTNERS = 150;

export const SubmittedPartnersSchema = z.object({
  partners: z
    .array(
      z.object({
        name: z.string().min(2).max(200).describe('Partner institution name exactly as the list writes it.'),
        englishName: z.string().max(200).describe('English name if the list also gives one, otherwise empty.'),
        countryCode: z
          .string()
          .regex(/^[A-Z]{2}$/)
          .describe('ISO 3166-1 alpha-2 code of the partner’s country, e.g. "DE".'),
        city: z.string().max(100).describe('City as the list states it, or empty.'),
        erasmusCode: z.string().max(20).describe('Erasmus institutional code as written, e.g. "D  HEIDELB01", or empty.'),
        website: z.string().max(200).describe('The partner’s official website as linked on the list, or empty.'),
        agreementType: z
          .enum(AGREEMENT_TYPES)
          .describe('erasmus: Erasmus+ agreement; bilateral: bilateral or overseas exchange agreement; other: anything else.'),
        department: z
          .string()
          .max(200)
          .describe('Home department, faculty or school that owns the agreement as written; empty if university-wide or not stated.'),
        iscedCodes: z
          .array(z.string().regex(/^[0-9]{2}([0-9]{1,2})?$/))
          .max(10)
          .describe('ISCED-F 2013 subject codes exactly as the list gives them; empty if not stated.'),
        levels: z.array(z.enum(['bachelor', 'master', 'phd'])).max(3).describe('Degree levels the agreement is open to, if stated.'),
        languages: z
          .array(z.string().regex(/^[a-z]{2}$/))
          .max(5)
          .describe('ISO 639-1 codes of the languages of instruction the list states, or empty.'),
        languageLevel: z.string().max(20).describe('Required language level as stated, e.g. "B2", or empty.'),
        places: z.number().int().min(1).max(500).nullable().describe('Number of places if stated.'),
        academicYear: z.string().max(20).describe('Academic year the list refers to, e.g. "2026/27", or empty.'),
        sourceIds: SourceIds,
      }),
    )
    .max(MAX_PARTNERS),
  listComplete: z.boolean().describe('False if the official list has more partners than you included.'),
  sources: z.array(SourceSchema).max(20),
});

export type SubmittedPartners = z.infer<typeof SubmittedPartnersSchema>;
export type SubmittedPartner = SubmittedPartners['partners'][number];
export type ListedPartner = SubmittedPartner & { sourceUrl: string };

/**
 * Keeps only partners that cite an official page actually retrieved in this
 * session (never a partner from memory), each with the URL of that page.
 */
export function finalizePartners(submitted: SubmittedPartners, retrievedUrls: Set<string>, now: Date) {
  const { sources, verify } = createVerifier(submitted.sources, retrievedUrls);
  const byId = new Map(sources.map((source) => [source.id, source]));
  const partners: ListedPartner[] = [];
  for (const partner of submitted.partners) {
    const checked = verify(partner);
    if (!checked.verified) continue;
    const source = checked.sourceIds.map((id) => byId.get(id)).find((s) => s?.retrieved && s.kind !== 'other');
    if (!source) continue;
    partners.push({ ...checked, sourceUrl: source.url });
  }
  return { partners, sources, listComplete: submitted.listComplete, checkedAt: now.toISOString() };
}

// ---------------------------------------------------------------------------
// Matching listed partners to the catalogue: exact identifiers only, never a guess.

export type CatalogueRow = {
  id: string;
  name: string;
  country_code: string;
  website: string;
  email_domains: string[];
  erasmus_code: string | null;
};

export function normalizeErasmusCode(code: string | null | undefined): string {
  return (code ?? '').toUpperCase().replace(/\s+/g, ' ').trim();
}

export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^the /, '')
    .trim();
}

export function hostOf(url: string): string | null {
  const value = url.trim();
  if (!value) return null;
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** One catalogue row, or null when there is none or more than one candidate. */
function single(rows: CatalogueRow[]): CatalogueRow | null {
  const unique = [...new Map(rows.map((row) => [row.id, row])).values()];
  return unique.length === 1 ? unique[0] : null;
}

export function matchPartner(partner: SubmittedPartner, catalogue: CatalogueRow[]): CatalogueRow | null {
  const sameCountry = catalogue.filter((row) => row.country_code === partner.countryCode);

  const code = normalizeErasmusCode(partner.erasmusCode);
  if (code) {
    const byCode = single(catalogue.filter((row) => normalizeErasmusCode(row.erasmus_code) === code));
    if (byCode) return byCode;
  }

  const host = hostOf(partner.website);
  if (host) {
    const byDomain = single(
      sameCountry.filter((row) => {
        const domains = [hostOf(row.website), ...row.email_domains].filter((d): d is string => Boolean(d));
        return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
      }),
    );
    if (byDomain) return byDomain;
  }

  const names = [partner.name, partner.englishName].map(normalizeName).filter(Boolean);
  return single(sameCountry.filter((row) => names.includes(normalizeName(row.name))));
}

export function matchPartners(partners: ListedPartner[], catalogue: CatalogueRow[], homeId: string) {
  const matched: { partner: ListedPartner; universityId: string }[] = [];
  const unmatched: string[] = [];
  for (const partner of partners) {
    const row = matchPartner(partner, catalogue);
    if (!row) unmatched.push(`${partner.name} (${partner.countryCode})`);
    else if (row.id !== homeId) matched.push({ partner, universityId: row.id });
  }
  return { matched, unmatched };
}

/** Faculty / school / department from the name the list uses. */
export function departmentKind(name: string): 'faculty' | 'school' | 'department' | 'institute' {
  const lower = name.toLowerCase();
  if (/facult|fakult|facolt|faculté/.test(lower)) return 'faculty';
  if (/school|scuola|école|escuela|schule/.test(lower)) return 'school';
  if (/institut/.test(lower)) return 'institute';
  return 'department';
}
