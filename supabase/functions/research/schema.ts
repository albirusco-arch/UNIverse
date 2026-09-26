/**
 * Shapes for the research function: the request coming from the app, the report
 * Claude submits, and the verified report stored for the app
 * (src/data/types.ts `ResearchReport`).
 */
import { z } from 'zod';

import { createVerifier, SourceIds, SourceSchema } from '../_shared/sources.ts';

// ---------------------------------------------------------------------------
// Request from the app

export const RESEARCH_KINDS = ['exchange', 'admission', 'scholarships', 'visa'] as const;
export type ResearchKind = (typeof RESEARCH_KINDS)[number];

const countryCode = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/);

export const RequestSchema = z
  .object({
    kind: z.enum(RESEARCH_KINDS),
    homeUniversity: z.string().trim().max(200),
    program: z.string().trim().max(200),
    level: z.enum(['bachelor', 'master', 'phd', 'researcher']),
    field: z.string().trim().max(40).nullable(),
    destinationId: z.string().trim().min(1).max(120).nullable(),
    destinationName: z.string().trim().max(200),
    destinationCountry: countryCode.or(z.literal('')),
    citizenship: countryCode.or(z.literal('')),
    qualification: z.string().trim().max(300),
    studyType: z.enum(['exchange', 'degree']),
    term: z.string().trim().max(100),
    durationMonths: z.number().int().min(1).max(72).nullable(),
    courses: z
      .array(z.object({ name: z.string().trim().min(1).max(200), ects: z.number().min(0).max(60).nullable() }))
      .max(12),
    notes: z.string().trim().max(500),
    language: z.enum(['en', 'it']).default('en'),
  })
  .superRefine((request, ctx) => {
    const require = (condition: boolean, path: string, message: string) => {
      if (!condition) ctx.addIssue({ code: 'custom', path: [path], message });
    };
    switch (request.kind) {
      case 'exchange':
        require(request.homeUniversity.length >= 2, 'homeUniversity', 'required');
        require(request.destinationId !== null, 'destinationId', 'required');
        require(request.courses.length > 0, 'courses', 'at least one course');
        break;
      case 'admission':
        require(request.destinationId !== null, 'destinationId', 'required');
        require(request.program.length >= 2, 'program', 'required');
        break;
      case 'scholarships':
        require(request.destinationId !== null || request.destinationCountry !== '', 'destinationCountry', 'destination required');
        break;
      case 'visa':
        require(request.citizenship !== '', 'citizenship', 'required');
        require(request.destinationCountry !== '', 'destinationCountry', 'required');
        break;
    }
  });

export type ResearchRequest = z.infer<typeof RequestSchema>;

// ---------------------------------------------------------------------------
// Report submitted by Claude through the `submit_report` tool

export const SubmittedReportSchema = z.object({
  summary: z.string().describe('2–4 sentences: overall picture and the most important next steps.'),
  academicYear: z.string().describe('Academic year or period the information refers to, e.g. "2026/27". Empty if unknown.'),
  officialPageUrl: z.string().describe('The single most useful official page for this topic, or empty.'),
  requirements: z
    .array(
      z.object({
        category: z.enum([
          'language',
          'academic',
          'credits',
          'application',
          'deadline',
          'documents',
          'financial',
          'visa',
          'health',
          'other',
        ]),
        title: z.string(),
        detail: z.string().describe('The requirement exactly as the source states it, with numbers, scores and levels.'),
        sourceIds: SourceIds,
      }),
    )
    .max(40),
  deadlines: z
    .array(z.object({ title: z.string(), date: z.string().describe('As written in the source.'), sourceIds: SourceIds }))
    .max(20),
  steps: z
    .array(z.object({ title: z.string(), detail: z.string(), sourceIds: SourceIds }))
    .max(15)
    .describe('Ordered procedure (for visas and applications). Empty when not relevant.'),
  courseMatches: z
    .array(
      z.object({
        homeCourse: z.string().describe('The student course being matched, as given in the request.'),
        homeEcts: z.number().nullable(),
        destinationCourse: z.string().describe('Exact course title from the destination catalogue; empty if fit is "none".'),
        destinationCode: z.string().describe('Course code from the catalogue, or empty.'),
        destinationEcts: z.number().nullable(),
        semester: z.string().describe('When the course is offered, or empty.'),
        language: z.string().describe('Language of instruction, or empty if not stated.'),
        url: z.string().describe('Catalogue page for this course, or empty.'),
        fit: z.enum(['strong', 'partial', 'weak', 'none']),
        rationale: z.string().describe('Why it fits or not: overlapping topics, level, credit difference.'),
        sourceIds: SourceIds,
      }),
    )
    .max(24)
    .describe('Only for exchange course matching; empty otherwise.'),
  scholarships: z
    .array(
      z.object({
        name: z.string(),
        provider: z.string(),
        amount: z.string().describe('As stated by the source, with currency and period.'),
        eligibility: z.string(),
        deadline: z.string().describe('Next deadline as stated, or "rolling"/"not stated".'),
        url: z.string(),
        sourceIds: SourceIds,
      }),
    )
    .max(20)
    .describe('Scholarships and grants the student may be eligible for; empty when not relevant.'),
  warnings: z.array(z.string()).max(12).describe('What the student must double-check, and with whom.'),
  sources: z.array(SourceSchema).max(40),
});

export type SubmittedReport = z.infer<typeof SubmittedReportSchema>;

// ---------------------------------------------------------------------------
// Server-side verification

export function finalizeReport(report: SubmittedReport, retrievedUrls: Set<string>, now: Date) {
  const { sources, verify } = createVerifier(report.sources, retrievedUrls);
  return {
    ...report,
    requirements: report.requirements.map(verify),
    deadlines: report.deadlines.map(verify),
    steps: report.steps.map(verify),
    courseMatches: report.courseMatches.map(verify),
    scholarships: report.scholarships.map(verify),
    sources,
    checkedAt: now.toISOString(),
  };
}

export type FinalReport = ReturnType<typeof finalizeReport>;
