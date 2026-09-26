/**
 * University quality insights: ESG and teaching indicators plus student clubs,
 * researched by Claude from public sources and verified server-side.
 */
import { z } from 'zod';

import { createVerifier, SourceIds, SourceSchema } from '../_shared/sources.ts';

export const CLUB_CATEGORIES = [
  'international',
  'academic',
  'culture',
  'sports',
  'tech',
  'volunteering',
  'arts',
  'other',
] as const;

export const SubmittedInsightsSchema = z.object({
  summary: z
    .string()
    .describe('3–5 sentences on sustainability, social responsibility and teaching quality, including where student ratings agree or disagree with official data.'),
  esgScore: z.number().int().min(0).max(100).nullable().describe('ESG score from the rubric, or null if evidence is insufficient.'),
  teachingScore: z.number().int().min(0).max(100).nullable().describe('Teaching score from the rubric, or null if evidence is insufficient.'),
  indicators: z
    .array(
      z.object({
        pillar: z.enum(['environmental', 'social', 'governance', 'teaching']),
        label: z.string().describe('e.g. "THE Impact Rankings 2025", "Net-zero target", "NSS 2025 overall satisfaction".'),
        value: z.string().describe('The value exactly as the source states it, e.g. "Rank 101–200", "2030", "84%".'),
        sourceIds: SourceIds,
      }),
    )
    .max(30),
  clubs: z
    .array(
      z.object({
        name: z.string(),
        category: z.enum(CLUB_CATEGORIES),
        description: z.string().describe('One sentence.'),
        website: z.string().describe('Official page of the club, or empty.'),
        instagram: z.string().describe('Instagram URL or handle, or empty.'),
        sourceIds: SourceIds,
      }),
    )
    .max(25)
    .describe('Student organisations, including the local Erasmus Student Network (ESN) section if there is one.'),
  sources: z.array(SourceSchema).max(40),
});

export type SubmittedInsights = z.infer<typeof SubmittedInsightsSchema>;

/** Minimum verified indicators before a score is shown. */
const MIN_ESG_EVIDENCE = 2;
const MIN_TEACHING_EVIDENCE = 1;

export function finalizeInsights(submitted: SubmittedInsights, retrievedUrls: Set<string>, now: Date) {
  const { sources, verify, firstRetrievedUrl } = createVerifier(submitted.sources, retrievedUrls);
  const indicators = submitted.indicators.map(verify);
  const verifiedEsg = indicators.filter((i) => i.verified && i.pillar !== 'teaching').length;
  const verifiedTeaching = indicators.filter((i) => i.verified && i.pillar === 'teaching').length;

  // Clubs are kept only when a page found in this session mentions them.
  const clubs = submitted.clubs.flatMap((club) => {
    const sourceUrl = firstRetrievedUrl(club);
    if (!sourceUrl) return [];
    const { verified } = verify(club);
    return [{ ...club, sourceUrl, verified }];
  });

  return {
    summary: submitted.summary,
    // Scores without enough verified evidence are withheld rather than shown.
    esgScore: verifiedEsg >= MIN_ESG_EVIDENCE ? submitted.esgScore : null,
    teachingScore: verifiedTeaching >= MIN_TEACHING_EVIDENCE ? submitted.teachingScore : null,
    indicators,
    clubs,
    sources,
    checkedAt: now.toISOString(),
  };
}

export type FinalInsights = ReturnType<typeof finalizeInsights>;
