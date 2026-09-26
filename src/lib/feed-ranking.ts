/**
 * "For you" ranking of community posts, personalised on what each student
 * studies, where they are going, and what they search, view and research.
 * Pure module so it can be unit-tested with node --test.
 */
import type { Field, Post, Signal, SignalKind } from '../data/types';

export type RankingContext = {
  field: Field | null;
  homeUniversity: string;
  destinationId: string | null;
  savedUniversityIds: string[];
  signals: Signal[];
  now?: number;
};

export type RankReason =
  | { kind: 'destination' }
  | { kind: 'saved' }
  | { kind: 'interest'; universityId: string }
  | { kind: 'field' }
  | { kind: 'home' }
  | { kind: 'keyword'; keyword: string };

export type RankedPost = { post: Post; score: number; reason: RankReason | null };

const HOUR = 3_600_000;
const SIGNAL_WEIGHT: Record<SignalKind, number> = {
  research: 3,
  save_university: 2.5,
  view_university: 1.5,
  search: 1,
  course: 1,
};
const STOP_WORDS = new Set(['and', 'the', 'for', 'with', 'from', 'into', 'introduction', 'advanced', 'basic', 'course']);

function keywords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
}

/** Interest per university and per keyword, decaying with a two-week half-life. */
function interests(signals: Signal[], now: number) {
  const universities = new Map<string, number>();
  const words = new Map<string, number>();
  for (const signal of signals) {
    const ageDays = Math.max(0, (now - Date.parse(signal.createdAt)) / (24 * HOUR));
    const weight = SIGNAL_WEIGHT[signal.kind] * Math.pow(0.5, ageDays / 14);
    if (signal.kind === 'view_university' || signal.kind === 'save_university' || signal.kind === 'research') {
      universities.set(signal.value, (universities.get(signal.value) ?? 0) + weight);
    }
    if (signal.kind === 'search' || signal.kind === 'course') {
      for (const word of keywords(signal.value)) words.set(word, (words.get(word) ?? 0) + weight);
    }
  }
  return { universities, words };
}

export function rankPosts(posts: Post[], context: RankingContext): RankedPost[] {
  const now = context.now ?? Date.now();
  const { universities, words } = interests(context.signals, now);
  const saved = new Set(context.savedUniversityIds);

  const ranked = posts.map((post) => {
    let relevance = 1;
    let reason: RankReason | null = null;
    let best = 0;
    const consider = (boost: number, why: RankReason) => {
      relevance += boost;
      if (boost > best) {
        best = boost;
        reason = why;
      }
    };

    if (post.universityId) {
      if (post.universityId === context.destinationId) consider(3, { kind: 'destination' });
      else if (saved.has(post.universityId)) consider(2, { kind: 'saved' });
      const interest = universities.get(post.universityId) ?? 0;
      if (interest > 0) consider(Math.min(2.5, interest * 0.6), { kind: 'interest', universityId: post.universityId });
    }
    if (context.field && post.field === context.field) consider(1.5, { kind: 'field' });
    if (context.homeUniversity && post.author.homeUniversity === context.homeUniversity) consider(1, { kind: 'home' });

    let keywordBoost = 0;
    let matched = '';
    for (const word of new Set(keywords(post.body))) {
      const weight = words.get(word);
      if (weight) {
        keywordBoost += Math.min(0.8, weight * 0.4);
        matched ||= word;
      }
    }
    if (keywordBoost > 0) consider(Math.min(2, keywordBoost), { kind: 'keyword', keyword: matched });

    const ageHours = Math.max(0, (now - Date.parse(post.createdAt)) / HOUR);
    const freshness = 1 / Math.pow(1 + ageHours / 24, 0.8);
    const engagement = Math.log1p(post.likeCount + 2 * post.commentCount) * 0.25;
    return { post, score: (relevance + engagement) * freshness, reason };
  });

  return ranked.sort((a, b) => b.score - a.score);
}
