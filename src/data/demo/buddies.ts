/**
 * Sample travel buddies for demo mode: fictional students going to the demo
 * student's destination, most of them in the same semester.
 */
import { parseTerm } from '@/lib/buddies';

import type { Buddy, Field, Level, Profile } from '../types';

type Sample = {
  id: string;
  displayName: string;
  homeUniversity: string;
  homeUniversityId: string;
  field: Field;
  level: Level;
  sameTerm: boolean;
  /** Studies the same field as the demo student, so the "Same field" filter has a match. */
  sameField?: boolean;
};

const samples: Sample[] = [
  { id: 'demo-buddy-marta', displayName: 'Marta G.', homeUniversity: 'Complutense University of Madrid', homeUniversityId: 'ucm', field: 'business', level: 'bachelor', sameTerm: true },
  { id: 'demo-buddy-jonas', displayName: 'Jonas V.', homeUniversity: 'University of Amsterdam', homeUniversityId: 'uva', field: 'computer_science', level: 'master', sameTerm: true },
  { id: 'demo-buddy-ana', displayName: 'Ana S.', homeUniversity: 'University of Lisbon', homeUniversityId: 'ulisboa', field: 'life_sciences', level: 'bachelor', sameTerm: true, sameField: true },
  { id: 'demo-buddy-matteo', displayName: 'Matteo B.', homeUniversity: 'Politecnico di Milano', homeUniversityId: 'polimi', field: 'engineering', level: 'master', sameTerm: true },
  { id: 'demo-buddy-chloe', displayName: 'Chloé L.', homeUniversity: 'Sciences Po', homeUniversityId: 'sciences-po.fr', field: 'social_sciences', level: 'bachelor', sameTerm: false },
  { id: 'demo-buddy-felix', displayName: 'Felix W.', homeUniversity: 'University of Vienna', homeUniversityId: 'univie', field: 'law', level: 'bachelor', sameTerm: false },
];

/** Sample students who already waved at the demo student (travel buddies and CBS students, see demo/campus). */
export const DEMO_INCOMING_WAVES = ['demo-buddy-marta', 'demo-buddy-matteo', 'demo-cbs-mads'];
/** Sample students who wave back a moment after the demo student waves. */
export const DEMO_WAVES_BACK = new Set(['demo-buddy-jonas', 'demo-buddy-ana', 'demo-cbs-freja', 'demo-cbs-lea']);

/** The semester after `term` ("Spring 2027" → "Fall 2027"). */
function nextTerm(term: string | null): string | null {
  const parsed = parseTerm(term);
  if (!parsed) return null;
  return parsed.season === 'spring' ? `Fall ${parsed.year}` : `Spring ${parsed.year + 1}`;
}

/** Wave state is added by the data layer. */
export function createDemoBuddies(viewer: Profile): Omit<Buddy, 'wavedByMe' | 'wavedMe' | 'chatId'>[] {
  if (!viewer.destinationId) return [];
  const otherTerm = nextTerm(viewer.term);
  return samples
    .filter((s) => s.homeUniversityId !== viewer.destinationId)
    .map(({ sameTerm, sameField, ...sample }) => ({
      ...sample,
      field: sameField && viewer.field && viewer.field !== 'other' ? viewer.field : sample.field,
      destinationId: viewer.destinationId,
      term: sameTerm ? viewer.term : otherTerm,
      verified: true,
    }));
}

export function demoGreeting(destination: string): string {
  return `Hi! 👋 Are you also going to ${destination}? We could look for housing together.`;
}
