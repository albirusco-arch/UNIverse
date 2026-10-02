/**
 * Sample campus for demo mode: Copenhagen Business School, the first launch
 * campus. Students and plans are fictional and labelled as samples in the UI.
 */
import { planStartOptions } from '@/lib/campus';

import type { Author, Buddy, Plan } from '../types';

/** Mirrors the launch_campuses rows of supabase/migrations/20260929000000_campus_launch.sql. */
export const DEMO_LAUNCH_CAMPUSES = ['cbs.dk'];

const CBS = 'cbs.dk';
const CBS_NAME = 'Copenhagen Business School';
const HOUR = 60 * 60 * 1000;

/** The semester under way ("Fall 2026" in October 2026). */
function currentTerm(now: Date): string {
  const month = now.getMonth();
  if (month >= 1 && month <= 6) return `Spring ${now.getFullYear()}`;
  return `Fall ${month === 0 ? now.getFullYear() - 1 : now.getFullYear()}`;
}

type Person = Omit<Buddy, 'wavedByMe' | 'wavedMe' | 'chatId'>;

/** CBS students and incoming students already on campus (students going there next come from demo/buddies). */
export function createDemoCampusPeople(campusId: string, now = new Date()): Person[] {
  if (campusId !== CBS) return [];
  const local = { homeUniversity: CBS_NAME, homeUniversityId: CBS, verified: true };
  const term = currentTerm(now);
  return [
    { ...local, id: 'demo-cbs-freja', displayName: 'Freja H.', field: 'business', level: 'bachelor', destinationId: null, term: null },
    { ...local, id: 'demo-cbs-mads', displayName: 'Mads K.', field: 'business', level: 'master', destinationId: 'unibocconi.it', term: 'Spring 2027' },
    { ...local, id: 'demo-cbs-sofie', displayName: 'Sofie N.', field: 'social_sciences', level: 'bachelor', destinationId: null, term: null },
    { id: 'demo-cbs-lea', displayName: 'Léa M.', homeUniversity: 'HEC Paris', homeUniversityId: 'hec.fr', field: 'business', level: 'master', destinationId: CBS, term, verified: true },
    { id: 'demo-cbs-tom', displayName: 'Tom B.', homeUniversity: 'Technical University of Munich', homeUniversityId: 'tum', field: 'engineering', level: 'bachelor', destinationId: CBS, term, verified: true },
  ];
}

export function demoCampusAuthor(person: Person): Author {
  return {
    id: person.id,
    displayName: person.displayName,
    homeUniversity: person.homeUniversity,
    field: person.field,
    destinationId: person.destinationId,
    verified: person.verified,
  };
}

/** A plan in demo mode keeps its chat even before the demo student joins. */
export type DemoPlan = Plan & { chatId: string | null };

/** The next suggested start at `hour` (as offered when making a plan), or `fallback` hours from now. */
function at(now: Date, hour: number, fallback: number): string {
  const slot = planStartOptions(now).find((date, index) => index > 0 && date.getHours() === hour);
  return (slot ?? new Date(now.getTime() + fallback * HOUR)).toISOString();
}

export function createDemoPlans(now = new Date()): DemoPlan[] {
  const people = createDemoCampusPeople(CBS, now);
  const by = (id: string) => demoCampusAuthor(people.find((p) => p.id === id)!);
  const base = { universityId: CBS, joinedByMe: false, groupId: null, chatId: null, createdAt: now.toISOString() };
  return [
    { ...base, id: 'plan-aperitivo', title: 'Example — Aperitivo for exchange students', place: 'Sample café by Solbjerg Plads', startsAt: at(now, 19, 2), author: by('demo-cbs-lea'), memberCount: 7 },
    { ...base, id: 'plan-run', title: 'Example — Evening run around the lakes', place: 'Sample meeting point: Dronning Louises Bro', startsAt: at(now, 18, 3), author: by('demo-cbs-freja'), memberCount: 3 },
    { ...base, id: 'plan-study', title: 'Example — Study session for the statistics exam', place: 'Sample room at the CBS Library', startsAt: at(now, 12, 19), author: by('demo-cbs-mads'), memberCount: 2 },
  ];
}

export const demoPlanGreeting = 'Example — great, see you there! I will wait by the entrance 👋';
