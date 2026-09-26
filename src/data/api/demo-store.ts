/** In-memory state for demo mode (no backend configured). */
import { createDemoComments, createDemoEquivalences, createDemoPosts } from '../demo/community';
import {
  createDemoClubs,
  createDemoGroups,
  createDemoInsights,
  createDemoMessages,
  createDemoRatings,
} from '../demo/social';
import { createDemoDepartments, createDemoPartnerships } from '../demo/partners';
import type { Department, PartnerExtraction, Partnership, Post, Research, Signal, UniversityRating } from '../types';

export const demo = {
  posts: createDemoPosts(),
  comments: createDemoComments(),
  equivalences: createDemoEquivalences(),
  research: [] as Research[],
  savedUniversities: new Set<string>(['heidelberg']),
  blocked: new Set<string>(),
  signals: [] as Signal[],
  groups: createDemoGroups(),
  messages: createDemoMessages(),
  readAt: new Map<string, string>(),
  clubs: createDemoClubs(),
  insights: createDemoInsights(),
  ratingSummaries: createDemoRatings(),
  myRatings: new Map<string, UniversityRating>(),
};

/** Replaces a demo post with an updated copy (memoized components compare by reference). */
export function updateDemoPost(id: string, update: (post: Post) => Post) {
  demo.posts = demo.posts.map((p) => (p.id === id ? update(p) : p));
}

/** Home university of the demo account ("Try the demo"): it starts with a sample partner list. */
const DEMO_HOME = 'unimi';

type DemoPartnerState = { partnerships: Partnership[]; departments: Department[]; extraction: PartnerExtraction | null };
const partnerStates = new Map<string, DemoPartnerState>();

/** Sample partner data for a home university, created on first use. */
export function demoPartners(homeUniversityId: string): DemoPartnerState {
  let state = partnerStates.get(homeUniversityId);
  if (!state) {
    const seeded = homeUniversityId === DEMO_HOME;
    state = {
      partnerships: seeded ? createDemoPartnerships(homeUniversityId) : [],
      departments: createDemoDepartments(homeUniversityId),
      extraction: null,
    };
    partnerStates.set(homeUniversityId, state);
  }
  return state;
}
