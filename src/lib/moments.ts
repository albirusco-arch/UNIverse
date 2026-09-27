import type { Moment, MomentReaction } from '../data/types';

/**
 * Moments are club photos that stay up for 24 hours, like BeReal and
 * Instagram stories. These helpers pick the live ones and rank clubs by what
 * their members posted and how others reacted: the word of mouth of the day.
 */

export const MOMENT_TTL_HOURS = 24;
const TTL_MS = MOMENT_TTL_HOURS * 60 * 60 * 1000;

export function isLive(moment: Pick<Moment, 'createdAt'>, now = new Date()): boolean {
  return now.getTime() - new Date(moment.createdAt).getTime() < TTL_MS;
}

export function reactionTotal(moment: Pick<Moment, 'reactions'>): number {
  return Object.values(moment.reactions).reduce((sum, n) => sum + (n ?? 0), 0);
}

/** Reaction counts after the viewer picks `next` (or clears their reaction with null). */
export function applyReaction(
  moment: Pick<Moment, 'reactions' | 'myReaction'>,
  next: MomentReaction | null,
): Pick<Moment, 'reactions' | 'myReaction'> {
  const reactions = { ...moment.reactions };
  if (moment.myReaction) reactions[moment.myReaction] = Math.max((reactions[moment.myReaction] ?? 1) - 1, 0);
  if (next) reactions[next] = (reactions[next] ?? 0) + 1;
  return { reactions, myReaction: next };
}

export type ClubBuzz = {
  clubId: string;
  clubName: string;
  universityId: string | null;
  moments: number;
  reactions: number;
  latest: string;
};

/** Clubs with live moments, the most active first (each moment counts as 3 reactions). */
export function trendingClubs(moments: Moment[], now = new Date()): ClubBuzz[] {
  const byClub = new Map<string, ClubBuzz>();
  for (const moment of moments) {
    if (!moment.clubId || !isLive(moment, now)) continue;
    const entry = byClub.get(moment.clubId) ?? {
      clubId: moment.clubId,
      clubName: moment.clubName ?? '',
      universityId: moment.universityId,
      moments: 0,
      reactions: 0,
      latest: moment.createdAt,
    };
    entry.moments += 1;
    entry.reactions += reactionTotal(moment);
    if (moment.createdAt > entry.latest) entry.latest = moment.createdAt;
    byClub.set(moment.clubId, entry);
  }
  const buzz = (c: ClubBuzz) => c.moments * 3 + c.reactions;
  return [...byClub.values()].sort((a, b) => buzz(b) - buzz(a) || b.latest.localeCompare(a.latest));
}
