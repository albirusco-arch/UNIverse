/**
 * Source bookkeeping shared by every research agent: the source schema Claude
 * fills in, URL normalisation, and the server-side check that marks an item as
 * verified only when it cites an official page actually retrieved in the session.
 */
import { z } from 'zod';

export const SOURCE_KINDS = [
  'official_destination',
  'official_home',
  'official_program',
  'official_government',
  'other',
] as const;

export const SourceSchema = z.object({
  id: z.number().int(),
  url: z.string(),
  title: z.string(),
  kind: z
    .enum(SOURCE_KINDS)
    .describe(
      'official_destination/official_home: university websites; official_program: Erasmus+, scholarship programmes, rankings bodies; official_government: ministries, embassies, immigration authorities; other: everything else (news, forums, blogs).',
    ),
  academicYear: z.string().describe('Academic year or date the page refers to, or empty if not stated.'),
});

export const SourceIds = z
  .array(z.number().int())
  .describe('Ids of the entries in `sources` that support this item. Empty only if nothing supports it.');

export type SubmittedSource = z.infer<typeof SourceSchema>;
export type VerifiedSource = SubmittedSource & { retrieved: boolean };

/** Canonical form used to compare cited URLs with the URLs actually retrieved. */
export function normalizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const path = url.pathname.replace(/\/+$/, '');
    return `${host}${path}${url.search}`;
  } catch {
    return null;
  }
}

/** Marks each cited source as retrieved (or not) and returns a verifier for items. */
export function createVerifier(sources: SubmittedSource[], retrievedUrls: Set<string>) {
  const verifiedSources: VerifiedSource[] = sources.map((source) => {
    const normalized = normalizeUrl(source.url);
    return { ...source, retrieved: normalized !== null && retrievedUrls.has(normalized) };
  });
  const byId = new Map(verifiedSources.map((source) => [source.id, source]));

  /** Drops unknown source ids; verified = cites at least one retrieved official source. */
  function verify<T extends { sourceIds: number[] }>(item: T): T & { verified: boolean } {
    const sourceIds = item.sourceIds.filter((id) => byId.has(id));
    const verified = sourceIds.some((id) => {
      const source = byId.get(id);
      return source !== undefined && source.retrieved && source.kind !== 'other';
    });
    return { ...item, sourceIds, verified };
  }

  /** First retrieved source cited by an item (any kind), for linking. */
  function firstRetrievedUrl(item: { sourceIds: number[] }): string | null {
    for (const id of item.sourceIds) {
      const source = byId.get(id);
      if (source?.retrieved) return source.url;
    }
    return null;
  }

  return { sources: verifiedSources, verify, firstRetrievedUrl };
}
