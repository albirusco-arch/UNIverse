/**
 * The UNIverse score, mirrored by the university_scores view in
 * supabase/migrations/20260926000300_quality_and_clubs.sql (keep them in sync).
 * Pure module so it can be unit-tested with node --test.
 */
import type { RatingSummary, UniversityScore } from '../data/types';

/** Student ratings count towards the score from this many ratings. */
export const MIN_RATINGS = 3;
const WEIGHTS = { esg: 0.35, teaching: 0.25, students: 0.4 };

/** Average of the four 1–5 dimensions, scaled to 0–100. */
export function studentScore(summary: RatingSummary): number | null {
  if (summary.count < MIN_RATINGS) return null;
  const values = [summary.teaching, summary.professors, summary.environment, summary.sustainability];
  if (values.some((v) => v === null)) return null;
  const average = (values as number[]).reduce((sum, v) => sum + v, 0) / values.length;
  return Math.round(((average - 1) / 4) * 100);
}

export function combineScore(
  universityId: string,
  esgScore: number | null,
  teachingScore: number | null,
  ratings: RatingSummary,
): UniversityScore {
  const students = studentScore(ratings);
  const parts: [number | null, number][] = [
    [esgScore, WEIGHTS.esg],
    [teachingScore, WEIGHTS.teaching],
    [students, WEIGHTS.students],
  ];
  const available = parts.filter((p): p is [number, number] => p[0] !== null);
  const weight = available.reduce((sum, [, w]) => sum + w, 0);
  const score = weight > 0 ? Math.round(available.reduce((sum, [v, w]) => sum + v * w, 0) / weight) : null;
  return {
    universityId,
    score,
    esgScore,
    teachingScore,
    studentScore: students,
    ratingCount: ratings.count,
    provisional: ratings.count < MIN_RATINGS,
  };
}

export type ScoreTier = 'excellent' | 'good' | 'fair' | 'low';

export function scoreTier(score: number): ScoreTier {
  if (score >= 80) return 'excellent';
  if (score >= 65) return 'good';
  if (score >= 50) return 'fair';
  return 'low';
}

/** Promoted in Explore and Home: strong score backed by enough student ratings. */
export function isTopRated(score: UniversityScore | undefined): boolean {
  return !!score && score.score !== null && score.score >= 75 && !score.provisional;
}
