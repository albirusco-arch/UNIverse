/** In-memory state for demo mode (no backend configured). */
import { createDemoComments, createDemoEquivalences, createDemoPosts } from '../demo/community';
import {
  createDemoClubs,
  createDemoGroups,
  createDemoInsights,
  createDemoMessages,
  createDemoRatings,
} from '../demo/social';
import type {
  CareerLinks,
  CvFile,
  CvReview,
  FeaturePrice,
  LedgerEntry,
  OpportunitySearch,
  Post,
  Research,
  SavedOpportunity,
  Signal,
  UniversityRating,
} from '../types';

const now = Date.now();

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
  // Tokens: the welcome bonus plus demo credit, so every paid tool can be tried.
  ledger: [
    { id: 'l-demo', delta: 10, reason: 'grant', feature: null, createdAt: new Date(now - 60_000).toISOString() },
    { id: 'l-welcome', delta: 3, reason: 'welcome', feature: null, createdAt: new Date(now - 120_000).toISOString() },
  ] as LedgerEntry[],
  products: [
    { productId: 'universe_tokens_10', tokens: 10 },
    { productId: 'universe_tokens_30', tokens: 30 },
    { productId: 'universe_tokens_100', tokens: 100 },
  ],
  prices: [
    { feature: 'cv_review', cost: 2, freePerDay: 0 },
    { feature: 'opportunity_match', cost: 3, freePerDay: 0 },
    { feature: 'research', cost: 1, freePerDay: 3 },
  ] as FeaturePrice[],
  cv: null as CvFile | null,
  cvReviews: [] as CvReview[],
  opportunitySearches: [] as OpportunitySearch[],
  savedOpportunities: [] as SavedOpportunity[],
  /** Career links other (sample) students chose to share; none by default. */
  links: {} as Record<string, CareerLinks>,
};

/** Replaces a demo post with an updated copy (memoized components compare by reference). */
export function updateDemoPost(id: string, update: (post: Post) => Post) {
  demo.posts = demo.posts.map((p) => (p.id === id ? update(p) : p));
}
