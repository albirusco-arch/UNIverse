import type { Buddy, Profile } from '../data/types';

/**
 * Travel buddies are visible students going to the same destination. These
 * helpers say what a student has in common with the viewer and order the list:
 * students waiting for a wave back first, then the same semester, field and level.
 */

export type MatchReason = 'term' | 'field' | 'level';
/** none → waved (I waved) / incoming (they waved) → connected (both: the chat opens). */
export type Connection = 'none' | 'waved' | 'incoming' | 'connected';
export type BuddyFilter = 'all' | 'waves' | MatchReason;

type Viewer = Pick<Profile, 'term' | 'field' | 'level'>;

const WEIGHTS: Record<MatchReason, number> = { term: 4, field: 2, level: 1 };

export type Term = { season: 'spring' | 'fall'; year: number };

/** Semesters are saved in the language of the app: "Spring 2027" and "Primavera 2027" are the same. */
export function parseTerm(term: string | null | undefined): Term | null {
  const text = term?.trim().toLowerCase() ?? '';
  const year = text.match(/\b(\d{4})\b/)?.[1];
  if (!year) return null;
  if (/^(spring|primavera)\b/.test(text)) return { season: 'spring', year: Number(year) };
  if (/^(fall|autumn|autunno)\b/.test(text)) return { season: 'fall', year: Number(year) };
  return null;
}

/** Compares semesters across languages (public.term_key in the database follows the same rule). */
export function termKey(term: string | null | undefined): string | null {
  const parsed = parseTerm(term);
  if (parsed) return `${parsed.year}-${parsed.season}`;
  return term?.trim().toLowerCase() || null;
}

export function connection(buddy: Pick<Buddy, 'wavedByMe' | 'wavedMe'>): Connection {
  if (buddy.wavedByMe && buddy.wavedMe) return 'connected';
  if (buddy.wavedMe) return 'incoming';
  return buddy.wavedByMe ? 'waved' : 'none';
}

export function matchReasons(buddy: Pick<Buddy, 'term' | 'field' | 'level'>, viewer: Viewer): MatchReason[] {
  const reasons: MatchReason[] = [];
  if (viewer.term && termKey(buddy.term) === termKey(viewer.term)) reasons.push('term');
  if (viewer.field && viewer.field !== 'other' && buddy.field === viewer.field) reasons.push('field');
  if (viewer.level && buddy.level === viewer.level) reasons.push('level');
  return reasons;
}

function matchScore(buddy: Buddy, viewer: Viewer): number {
  return matchReasons(buddy, viewer).reduce((sum, reason) => sum + WEIGHTS[reason], 0);
}

export function rankBuddies<T extends Buddy>(buddies: T[], viewer: Viewer): T[] {
  const waiting = (buddy: Buddy) => Number(connection(buddy) === 'incoming');
  return [...buddies].sort(
    (a, b) =>
      waiting(b) - waiting(a) ||
      matchScore(b, viewer) - matchScore(a, viewer) ||
      a.displayName.localeCompare(b.displayName),
  );
}

export function filterBuddies<T extends Buddy>(buddies: T[], viewer: Viewer, filter: BuddyFilter): T[] {
  if (filter === 'all') return buddies;
  if (filter === 'waves') return buddies.filter((buddy) => connection(buddy) === 'incoming');
  return buddies.filter((buddy) => matchReasons(buddy, viewer).includes(filter));
}
