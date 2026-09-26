/**
 * Shapes for the cv-review function: the request from the app and the review
 * Claude submits. Keep aligned with CvReviewRequest / CvReport in src/data/types.ts.
 */
import { z } from 'zod';

export const CAREER_TARGETS = ['internship', 'graduate_job', 'job', 'part_time', 'research', 'master', 'phd'] as const;

export const RequestSchema = z.object({
  targetRole: z.string().trim().min(2).max(120),
  targetType: z.enum(CAREER_TARGETS),
  industry: z.string().trim().max(120),
  /** ISO 3166-1 alpha-2 of the country the student applies in, or ''. */
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([A-Z]{2})?$/),
  jobDescription: z.string().trim().max(4000),
  notes: z.string().trim().max(500),
});

export type CvReviewRequest = z.infer<typeof RequestSchema>;

const Priority = z.enum(['high', 'medium', 'low']);

export const CvReportSchema = z.object({
  overallScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe('How ready this CV is for the target, 0–100. 80+ only if a recruiter would shortlist it as is.'),
  summary: z.string().describe('3–4 sentences: how the CV reads for this target and the biggest wins.'),
  headline: z.string().describe('A one-line profile headline for the top of the CV, true to its content.'),
  strengths: z.array(z.string()).max(8),
  improvements: z
    .array(
      z.object({
        priority: Priority,
        section: z.string().describe('CV section, e.g. "Experience", "Education", "Skills", "Layout".'),
        issue: z.string(),
        suggestion: z.string(),
        example: z
          .string()
          .describe('A rewritten line using only facts already in the CV, or empty. Never invent results or numbers.'),
      }),
    )
    .max(15),
  atsChecks: z
    .array(
      z.object({
        check: z.string().describe('e.g. "Standard section headings", "Readable text (not an image)", "Contact details".'),
        status: z.enum(['pass', 'warning', 'fail']),
        detail: z.string(),
      }),
    )
    .max(12),
  keywords: z.object({
    present: z.array(z.string()).max(20).describe('Target keywords the CV already shows.'),
    missing: z
      .array(z.string())
      .max(20)
      .describe('Relevant keywords the CV lacks. Only suggest adding them where the student really has the skill.'),
  }),
  sectionScores: z
    .array(z.object({ section: z.string(), score: z.number().int().min(0).max(100), comment: z.string() }))
    .max(10),
  nextSteps: z.array(z.string()).max(6).describe('Concrete actions, most important first.'),
});

export type CvReport = z.infer<typeof CvReportSchema>;
