/**
 * Universities: saved list, community stats, ESG / teaching insights, student
 * ratings, the combined UNIverse score, and student clubs.
 */
import { combineScore } from '@/lib/scores';

import type {
  Club,
  JobStatus,
  RatingSummary,
  UniversityInsights,
  UniversityRating,
  UniversityScore,
  UniversityStats,
} from '../types';

import {
  currentUserId,
  functionErrorStatus,
  isDemoMode,
  notifyChange,
  RateLimitError,
  requireClient,
  requireUserId,
  STALE_JOB_MS,
} from './core';
import { demo } from './demo-store';

// ---------------------------------------------------------------------------
// Saved universities and stats

export async function getUniversityStats(): Promise<Record<string, UniversityStats>> {
  if (isDemoMode) {
    const stats: Record<string, UniversityStats> = {};
    const bump = (id: string | null, key: keyof UniversityStats) => {
      if (!id) return;
      stats[id] ??= { members: 0, equivalences: 0 };
      stats[id][key] += 1;
    };
    demo.posts.forEach((post) => bump(post.author.destinationId, 'members'));
    demo.equivalences.forEach((e) => bump(e.destinationId, 'equivalences'));
    return stats;
  }
  const { data, error } = await requireClient().from('university_stats').select('*');
  if (error) throw error;
  const stats: Record<string, UniversityStats> = {};
  for (const row of data as { university_id: string; members: number; equivalences: number }[]) {
    stats[row.university_id] = { members: row.members, equivalences: row.equivalences };
  }
  return stats;
}

export async function listSavedUniversityIds(): Promise<string[]> {
  if (isDemoMode) return [...demo.savedUniversities];
  if (!(await currentUserId())) return [];
  const { data, error } = await requireClient().from('saved_universities').select('university_id');
  if (error) throw error;
  return (data as { university_id: string }[]).map((row) => row.university_id);
}

export async function setUniversitySaved(universityId: string, saved: boolean) {
  if (isDemoMode) {
    if (saved) demo.savedUniversities.add(universityId);
    else demo.savedUniversities.delete(universityId);
  } else {
    const userId = await requireUserId();
    const table = requireClient().from('saved_universities');
    const { error } = saved
      ? await table.upsert({ user_id: userId, university_id: universityId }, { ignoreDuplicates: true })
      : await table.delete().eq('user_id', userId).eq('university_id', universityId);
    if (error) throw error;
  }
  notifyChange();
}

// ---------------------------------------------------------------------------
// Scores (ESG + teaching insights + student ratings)

type ScoreRow = {
  university_id: string;
  score: number | null;
  esg_score: number | null;
  teaching_score: number | null;
  student_score: number | null;
  rating_count: number;
  provisional: boolean;
  teaching_avg: number | null;
  professors_avg: number | null;
  environment_avg: number | null;
  sustainability_avg: number | null;
};

function mapScore(row: ScoreRow): UniversityScore {
  return {
    universityId: row.university_id,
    score: row.score,
    esgScore: row.esg_score,
    teachingScore: row.teaching_score,
    studentScore: row.student_score,
    ratingCount: row.rating_count,
    provisional: row.provisional,
  };
}

const emptySummary: RatingSummary = { count: 0, teaching: null, professors: null, environment: null, sustainability: null };

function demoScore(universityId: string): UniversityScore | null {
  const insights = demo.insights[universityId];
  const ratings = demo.ratingSummaries[universityId];
  if (!insights && !ratings) return null;
  return combineScore(universityId, insights?.esgScore ?? null, insights?.teachingScore ?? null, ratings ?? emptySummary);
}

/** Scores for every university that has insights or ratings. */
export async function listScores(): Promise<Record<string, UniversityScore>> {
  const scores: Record<string, UniversityScore> = {};
  if (isDemoMode) {
    for (const id of new Set([...Object.keys(demo.insights), ...Object.keys(demo.ratingSummaries)])) {
      const score = demoScore(id);
      if (score) scores[id] = score;
    }
    return scores;
  }
  const { data, error } = await requireClient().from('university_scores').select('*');
  if (error) throw error;
  for (const row of data as ScoreRow[]) scores[row.university_id] = mapScore(row);
  return scores;
}

export async function getRatingSummary(universityId: string): Promise<RatingSummary> {
  if (isDemoMode) return demo.ratingSummaries[universityId] ?? emptySummary;
  const { data, error } = await requireClient()
    .from('university_scores')
    .select('*')
    .eq('university_id', universityId)
    .maybeSingle();
  if (error) throw error;
  const row = data as ScoreRow | null;
  if (!row) return emptySummary;
  return {
    count: row.rating_count,
    teaching: row.teaching_avg,
    professors: row.professors_avg,
    environment: row.environment_avg,
    sustainability: row.sustainability_avg,
  };
}

// ---------------------------------------------------------------------------
// Insights

type InsightsRow = {
  university_id: string;
  status: JobStatus;
  summary: string;
  esg_score: number | null;
  teaching_score: number | null;
  indicators: UniversityInsights['indicators'];
  sources: UniversityInsights['sources'];
  checked_at: string | null;
  updated_at: string;
};

export async function getInsights(universityId: string): Promise<UniversityInsights | null> {
  if (isDemoMode) return demo.insights[universityId] ?? null;
  const { data, error } = await requireClient()
    .from('university_insights')
    .select('*')
    .eq('university_id', universityId)
    .maybeSingle();
  if (error) throw error;
  const row = data as InsightsRow | null;
  if (!row) return null;
  const stale = row.status === 'running' && Date.now() - Date.parse(row.updated_at) > STALE_JOB_MS;
  return {
    universityId: row.university_id,
    status: stale ? 'error' : row.status,
    summary: row.summary,
    esgScore: row.esg_score,
    teachingScore: row.teaching_score,
    indicators: row.indicators ?? [],
    sources: row.sources ?? [],
    checkedAt: row.checked_at,
  };
}

/** Asks the backend to research (or refresh) the ESG and teaching insights. */
export async function requestInsights(universityId: string): Promise<void> {
  if (isDemoMode) {
    if (!demo.insights[universityId]) {
      demo.insights[universityId] = {
        universityId,
        status: 'running',
        summary: '',
        esgScore: null,
        teachingScore: null,
        indicators: [],
        sources: [],
        checkedAt: null,
        isDemo: true,
      };
      notifyChange();
      setTimeout(() => {
        demo.insights[universityId] = {
          ...demo.insights.heidelberg,
          universityId,
          summary: 'Sample assessment generated in demo mode. Connect the backend to research real sources.',
          checkedAt: new Date().toISOString(),
        };
        notifyChange();
      }, 5000);
    }
    return;
  }
  await requireUserId();
  const { error } = await requireClient().functions.invoke('university-insights', { body: { universityId } });
  if (error) {
    if (functionErrorStatus(error) === 429) throw new RateLimitError('rate limited');
    throw error;
  }
  notifyChange();
}

// ---------------------------------------------------------------------------
// Ratings

export async function getMyRating(universityId: string): Promise<UniversityRating | null> {
  if (isDemoMode) return demo.myRatings.get(universityId) ?? null;
  const userId = await currentUserId();
  if (!userId) return null;
  const { data, error } = await requireClient()
    .from('university_ratings')
    .select('teaching, professors, environment, sustainability, relation, academic_year')
    .eq('university_id', universityId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as Omit<UniversityRating, 'academicYear'> & { academic_year: string };
  return {
    teaching: row.teaching,
    professors: row.professors,
    environment: row.environment,
    sustainability: row.sustainability,
    relation: row.relation,
    academicYear: row.academic_year,
  };
}

export async function rateUniversity(universityId: string, rating: UniversityRating) {
  if (isDemoMode) {
    const previous = demo.myRatings.get(universityId);
    demo.myRatings.set(universityId, rating);
    const summary = demo.ratingSummaries[universityId] ?? emptySummary;
    const count = summary.count + (previous ? 0 : 1);
    const blend = (key: keyof UniversityRating & keyof RatingSummary) => {
      const total = (summary[key] ?? 0) * summary.count - ((previous?.[key] as number | undefined) ?? 0);
      return (total + (rating[key] as number)) / count;
    };
    demo.ratingSummaries[universityId] = {
      count,
      teaching: blend('teaching'),
      professors: blend('professors'),
      environment: blend('environment'),
      sustainability: blend('sustainability'),
    };
  } else {
    const userId = await requireUserId();
    const { error } = await requireClient()
      .from('university_ratings')
      .upsert(
        {
          university_id: universityId,
          user_id: userId,
          teaching: rating.teaching,
          professors: rating.professors,
          environment: rating.environment,
          sustainability: rating.sustainability,
          relation: rating.relation,
          academic_year: rating.academicYear,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'university_id,user_id' },
      );
    if (error) throw error;
  }
  notifyChange();
}

// ---------------------------------------------------------------------------
// Clubs

type ClubRow = {
  id: string;
  university_id: string;
  name: string;
  category: Club['category'];
  description: string;
  website: string;
  instagram: string;
  source: Club['source'];
  source_url: string;
  verified: boolean;
  group_id: string | null;
};

function mapClub(row: ClubRow): Club {
  return {
    id: row.id,
    universityId: row.university_id,
    name: row.name,
    category: row.category,
    description: row.description,
    website: row.website,
    instagram: row.instagram,
    source: row.source,
    sourceUrl: row.source_url,
    verified: row.verified,
    groupId: row.group_id,
  };
}

export async function listClubs(universityId: string): Promise<Club[]> {
  if (isDemoMode) {
    return demo.clubs
      .filter((c) => c.universityId === universityId)
      .map((c) => ({ ...c, groupId: demo.groups.find((g) => g.clubId === c.id)?.id ?? null }))
      .sort((a, b) => Number(b.verified) - Number(a.verified) || a.name.localeCompare(b.name));
  }
  const { data, error } = await requireClient()
    .from('club_list')
    .select('*')
    .eq('university_id', universityId)
    .order('verified', { ascending: false })
    .order('name');
  if (error) throw error;
  return (data as ClubRow[]).map(mapClub);
}

export async function getClub(id: string): Promise<Club | null> {
  if (isDemoMode) {
    const club = demo.clubs.find((c) => c.id === id);
    return club ? { ...club, groupId: demo.groups.find((g) => g.clubId === id)?.id ?? null } : null;
  }
  const { data, error } = await requireClient().from('club_list').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapClub(data as ClubRow) : null;
}

export async function suggestClub(input: Pick<Club, 'universityId' | 'name' | 'category' | 'description' | 'website' | 'instagram'>) {
  if (isDemoMode) {
    demo.clubs.push({ ...input, id: `local-club-${Date.now()}`, source: 'community', sourceUrl: '', verified: false, groupId: null });
  } else {
    const userId = await requireUserId();
    const { error } = await requireClient().from('clubs').insert({
      university_id: input.universityId,
      name: input.name,
      category: input.category,
      description: input.description,
      website: input.website,
      instagram: input.instagram,
      created_by: userId,
    });
    if (error) throw error;
  }
  notifyChange();
}
