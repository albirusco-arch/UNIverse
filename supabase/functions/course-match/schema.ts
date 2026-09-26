/**
 * Shapes shared by the course-match function: the request coming from the app,
 * the report Claude submits, and the server-side verification that turns the
 * submitted report into what the app displays (src/data/types.ts `MatchReport`).
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Request from the app

export const RequestSchema = z.object({
  homeUniversity: z.string().trim().min(2).max(200),
  program: z.string().trim().max(200),
  level: z.enum(['bachelor', 'master', 'phd', 'researcher']),
  destinationId: z.string().trim().min(1).max(64),
  destinationName: z.string().trim().min(1).max(200),
  term: z.string().trim().max(100),
  courses: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        ects: z.number().min(0).max(60).nullable(),
      }),
    )
    .min(1)
    .max(12),
  notes: z.string().trim().max(500),
  locale: z.string().trim().max(10),
});

export type CourseMatchRequest = z.infer<typeof RequestSchema>;

// ---------------------------------------------------------------------------
// Report submitted by Claude through the `submit_report` tool

const SourceIds = z
  .array(z.number().int())
  .describe('Ids of the entries in `sources` that support this item. Empty only if nothing supports it.');

export const SubmittedReportSchema = z.object({
  summary: z.string().describe('2–4 sentences: overall feasibility and the most important things to do next.'),
  academicYear: z.string().describe('Academic year the information refers to, e.g. "2026/27". Empty if unknown.'),
  exchangePageUrl: z.string().describe('Official page for incoming exchange students at the destination, or empty.'),
  requirements: z
    .array(
      z.object({
        category: z.enum(['language', 'academic', 'credits', 'application', 'deadline', 'documents', 'financial', 'other']),
        title: z.string(),
        detail: z.string().describe('The requirement exactly as the source states it, with numbers and levels.'),
        sourceIds: SourceIds,
      }),
    )
    .max(40),
  deadlines: z
    .array(
      z.object({
        title: z.string(),
        date: z.string().describe('Date as written in the source, e.g. "15 May 2027".'),
        sourceIds: SourceIds,
      }),
    )
    .max(20),
  courseMatches: z
    .array(
      z.object({
        homeCourse: z.string().describe('The student course being matched, as given in the request.'),
        homeEcts: z.number().nullable(),
        destinationCourse: z.string().describe('Exact course title from the destination catalogue; empty if fit is "none".'),
        destinationCode: z.string().describe('Course code from the catalogue, or empty.'),
        destinationEcts: z.number().nullable(),
        semester: z.string().describe('When the course is offered (e.g. "Winter semester"), or empty.'),
        language: z.string().describe('Language of instruction, or empty if not stated.'),
        url: z.string().describe('Catalogue page for this course, or empty.'),
        fit: z.enum(['strong', 'partial', 'weak', 'none']),
        rationale: z.string().describe('Why it fits or not: overlapping topics, level, credit difference.'),
        sourceIds: SourceIds,
      }),
    )
    .max(24),
  warnings: z.array(z.string()).max(12).describe('Things the student must confirm with the exchange coordinator.'),
  sources: z
    .array(
      z.object({
        id: z.number().int(),
        url: z.string(),
        title: z.string(),
        kind: z.enum(['official_destination', 'official_home', 'official_program', 'other']),
        academicYear: z.string().describe('Academic year the page refers to, or empty if not stated.'),
      }),
    )
    .max(40),
});

export type SubmittedReport = z.infer<typeof SubmittedReportSchema>;

/** JSON Schema for the tool definition, generated from the same zod schema. */
export function submitReportInputSchema(): { type: 'object'; [key: string]: unknown } {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(SubmittedReportSchema) as Record<string, unknown>;
  return { ...schema, type: 'object' };
}

// ---------------------------------------------------------------------------
// Server-side verification

export type FinalReport = Omit<SubmittedReport, 'requirements' | 'deadlines' | 'courseMatches' | 'sources'> & {
  requirements: (SubmittedReport['requirements'][number] & { verified: boolean })[];
  deadlines: (SubmittedReport['deadlines'][number] & { verified: boolean })[];
  courseMatches: (SubmittedReport['courseMatches'][number] & { verified: boolean })[];
  sources: (SubmittedReport['sources'][number] & { retrieved: boolean })[];
  checkedAt: string;
};

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

/**
 * Marks which sources were really opened or returned by search during this
 * research session, and which items are backed by at least one such official
 * source. Items that cite nothing verifiable are shown as "to verify" in the app.
 */
export function finalizeReport(report: SubmittedReport, retrievedUrls: Set<string>, now: Date): FinalReport {
  const sources = report.sources.map((source) => {
    const normalized = normalizeUrl(source.url);
    return { ...source, retrieved: normalized !== null && retrievedUrls.has(normalized) };
  });
  const byId = new Map(sources.map((source) => [source.id, source]));

  const verify = <T extends { sourceIds: number[] }>(item: T): T & { verified: boolean } => {
    const sourceIds = item.sourceIds.filter((id) => byId.has(id));
    const verified = sourceIds.some((id) => {
      const source = byId.get(id);
      return source !== undefined && source.retrieved && source.kind !== 'other';
    });
    return { ...item, sourceIds, verified };
  };

  return {
    ...report,
    requirements: report.requirements.map(verify),
    deadlines: report.deadlines.map(verify),
    courseMatches: report.courseMatches.map(verify),
    sources,
    checkedAt: now.toISOString(),
  };
}
