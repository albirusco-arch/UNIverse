import type { Buddy, Plan, Profile } from '../data/types';
import { parseTerm } from './buddies.ts';

/**
 * Launch campuses (CBS first): the students of a university and those going
 * there. These helpers pick the student's campus, tell locals from incoming
 * students and who is on campus this semester, and keep plans in their window.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** Plans stay visible this long after they start (policy on public.plans). */
export const PLAN_HOURS_AFTER_START = 3;
/** Plans start within this many hours (check on public.plans). */
export const PLAN_HOURS_AHEAD = 24;

/** The launch campus of a student: their home university first, then their destination. */
export function campusFor(profile: Pick<Profile, 'homeUniversityId' | 'destinationId'>, launched: readonly string[]): string | null {
  for (const id of [profile.homeUniversityId, profile.destinationId]) {
    if (id && launched.includes(id)) return id;
  }
  return null;
}

export type CampusRole = 'local' | 'incoming';

export function campusRole(person: Pick<Buddy, 'homeUniversityId'>, campusId: string): CampusRole {
  return person.homeUniversityId === campusId ? 'local' : 'incoming';
}

/** Spring semesters run February–July, fall semesters August–January. */
export function isTermCurrent(term: string | null | undefined, now = new Date()): boolean {
  const parsed = parseTerm(term);
  if (!parsed) return false;
  const start = parsed.season === 'spring' ? new Date(parsed.year, 1, 1) : new Date(parsed.year, 7, 1);
  const end = parsed.season === 'spring' ? new Date(parsed.year, 7, 1) : new Date(parsed.year + 1, 1, 1);
  return now >= start && now < end;
}

/** On campus this semester: incoming students during their exchange, locals unless they are abroad. */
export function onCampusNow(
  person: Pick<Buddy, 'homeUniversityId' | 'destinationId' | 'term'>,
  campusId: string,
  now = new Date(),
): boolean {
  const exchangeNow = isTermCurrent(person.term, now);
  if (person.homeUniversityId === campusId) {
    return !(person.destinationId && person.destinationId !== campusId && exchangeNow);
  }
  return person.destinationId === campusId && exchangeNow;
}

export type CampusFilter = 'all' | 'here' | CampusRole;

export function filterCampusPeople<T extends Buddy>(people: T[], campusId: string, filter: CampusFilter, now = new Date()): T[] {
  if (filter === 'all') return people;
  if (filter === 'here') return people.filter((person) => onCampusNow(person, campusId, now));
  return people.filter((person) => campusRole(person, campusId) === filter);
}

export function isPlanLive(plan: Pick<Plan, 'startsAt'>, now = new Date()): boolean {
  return new Date(plan.startsAt).getTime() > now.getTime() - PLAN_HOURS_AFTER_START * HOUR;
}

/** Live plans in start order (those already under way first). */
export function upcomingPlans<T extends Pick<Plan, 'startsAt'>>(plans: T[], now = new Date()): T[] {
  return plans
    .filter((plan) => isPlanLive(plan, now))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

export type PlanDay = 'now' | 'today' | 'tomorrow' | 'later';

export function planDay(startsAt: string, now = new Date()): PlanDay {
  const start = new Date(startsAt);
  if (start <= now) return 'now';
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (start.toDateString() === now.toDateString()) return 'today';
  if (start.toDateString() === tomorrow.toDateString()) return 'tomorrow';
  return 'later';
}

const SUGGESTED_HOURS = [12, 13, 18, 19, 20, 21, 22];

/** Start times offered for a new plan: the next quarter hour, then lunch and evening slots within the window. */
export function planStartOptions(now = new Date()): Date[] {
  const soon = new Date(now);
  soon.setSeconds(0, 0);
  soon.setMinutes(Math.ceil((now.getMinutes() + 1) / 15) * 15);
  const options = [soon];
  // An hour of margin under the 24-hour limit, for clocks that disagree with the server.
  const latest = now.getTime() + (PLAN_HOURS_AHEAD - 1) * HOUR;
  for (let day = 0; day < 2; day++) {
    for (const hour of SUGGESTED_HOURS) {
      const slot = new Date(now);
      slot.setDate(now.getDate() + day);
      slot.setHours(hour, 0, 0, 0);
      if (slot.getTime() >= soon.getTime() + 30 * MINUTE && slot.getTime() <= latest) options.push(slot);
    }
  }
  return options;
}
