/**
 * Shapes for the opportunities function: the search the student asks for, the
 * results Claude submits, and the server-side checks applied before saving.
 * Keep aligned with OpportunityRequest / OpportunityReport in src/data/types.ts.
 */
import { z } from 'zod';

import { createVerifier, normalizeUrl, SourceIds } from '../_shared/sources.ts';

export const OPPORTUNITY_TYPES = ['internship', 'graduate_job', 'job', 'part_time', 'research', 'master', 'phd'] as const;
export const PLATFORMS = ['linkedin', 'handshake', 'jobteaser', 'company', 'university', 'job_board', 'other'] as const;

const countryCode = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/);

export const RequestSchema = z.object({
  types: z.array(z.enum(OPPORTUNITY_TYPES)).min(1).max(OPPORTUNITY_TYPES.length),
  keywords: z.string().trim().min(2).max(200),
  countries: z.array(countryCode).max(5),
  remote: z.boolean(),
  startDate: z.string().trim().max(60),
  languages: z.string().trim().max(120),
  useCv: z.boolean(),
  notes: z.string().trim().max(500),
});

export type OpportunityRequest = z.infer<typeof RequestSchema>;

export const OpportunitySourceSchema = z.object({
  id: z.number().int(),
  url: z.string(),
  title: z.string(),
  kind: z
    .enum(['employer', 'job_board', 'university', 'government', 'other'])
    .describe(
      'employer: the organisation’s own careers site; job_board: LinkedIn, Handshake, JobTeaser, national job boards; university: programme or lab pages; government: public programmes; other: news, blogs, aggregators of aggregators.',
    ),
});

export const SubmittedResultsSchema = z.object({
  summary: z.string().describe('2–3 sentences: what the market looks like for this student and where to focus.'),
  opportunities: z
    .array(
      z.object({
        title: z.string().describe('Exact title from the posting.'),
        organization: z.string(),
        type: z.enum(OPPORTUNITY_TYPES),
        location: z.string().describe('City and country as posted, or "Remote".'),
        remote: z.boolean(),
        deadline: z.string().describe('Application deadline as posted, or empty if none is stated.'),
        startDate: z.string().describe('Start date as posted, or empty.'),
        url: z.string().describe('The page of this specific posting (not a search page).'),
        platform: z.enum(PLATFORMS),
        fit: z.number().int().min(0).max(100).describe('How well the student matches, 0–100.'),
        reasons: z.array(z.string()).max(4).describe('Why it fits this student.'),
        requirements: z.array(z.string()).max(6).describe('Key requirements from the posting.'),
        gaps: z.array(z.string()).max(4).describe('Requirements the student may not meet yet.'),
        sourceIds: SourceIds,
      }),
    )
    .max(15),
  organizations: z
    .array(
      z.object({
        name: z.string(),
        why: z.string().describe('Why this employer or university is worth targeting for this student.'),
        careersUrl: z.string().describe('Official careers, early-careers or admissions page, or empty.'),
        sourceIds: SourceIds,
      }),
    )
    .max(8)
    .describe('Employers, labs or universities to follow and network with, beyond the open postings.'),
  tips: z.array(z.string()).max(6).describe('Practical advice: timing, what to prepare, who to contact.'),
  sources: z.array(OpportunitySourceSchema).max(40),
});

export type SubmittedResults = z.infer<typeof SubmittedResultsSchema>;

/** Platform from the posting's host, which beats whatever the model wrote. */
export function platformFor(url: string, submitted: (typeof PLATFORMS)[number]): (typeof PLATFORMS)[number] {
  const host = normalizeUrl(url)?.split('/')[0] ?? '';
  const on = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  if (on('linkedin.com')) return 'linkedin';
  if (on('joinhandshake.com')) return 'handshake';
  if (on('jobteaser.com')) return 'jobteaser';
  return submitted === 'linkedin' || submitted === 'handshake' || submitted === 'jobteaser' ? 'other' : submitted;
}

/**
 * Keeps only postings with a usable link, marks each as verified when its own
 * page (or a cited, non-"other" source) was actually opened during the search,
 * and sorts verified, better-fitting postings first.
 */
export function finalizeResults(results: SubmittedResults, retrievedUrls: Set<string>, now: Date) {
  const { sources, verify } = createVerifier(results.sources, retrievedUrls);
  const opportunities = results.opportunities
    .filter((o) => normalizeUrl(o.url) !== null)
    .map((o) => {
      const cited = verify(o);
      const pageOpened = retrievedUrls.has(normalizeUrl(o.url) ?? '');
      return { ...cited, platform: platformFor(o.url, o.platform), verified: cited.verified || pageOpened };
    })
    .sort((a, b) => Number(b.verified) - Number(a.verified) || b.fit - a.fit);
  const organizations = results.organizations.map((org) => ({
    ...verify(org),
    careersUrl: normalizeUrl(org.careersUrl) ? org.careersUrl : '',
  }));
  return { summary: results.summary, opportunities, organizations, tips: results.tips, sources, checkedAt: now.toISOString() };
}

export type FinalResults = ReturnType<typeof finalizeResults>;
