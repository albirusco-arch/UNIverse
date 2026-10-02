/**
 * Shared plumbing for the data layer: change notifications, the Supabase client
 * guard, the demo identity and row mapping for authors.
 */
import { isDemoMode, supabase } from '@/lib/supabase';

import type { Author, Profile } from '../types';

export { isDemoMode };

// ---------------------------------------------------------------------------
// Change notifications: screens re-fetch when data they show may have changed.

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyChange() {
  listeners.forEach((listener) => listener());
}

export class AuthRequiredError extends Error {
  constructor() {
    super('Sign in required');
  }
}

export class RateLimitError extends Error {}

export function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

export async function currentUserId(): Promise<string | null> {
  if (isDemoMode) return demoSignedIn ? demoMe.id : null;
  const { data } = await requireClient().auth.getSession();
  return data.session?.user.id ?? null;
}

export async function requireUserId(): Promise<string> {
  const id = await currentUserId();
  if (!id) throw new AuthRequiredError();
  return id;
}

/** Status code of a failed edge-function call, if any. */
export function functionErrorStatus(error: unknown): number | undefined {
  return (error as { context?: { status?: number } }).context?.status;
}

// ---------------------------------------------------------------------------
// Demo identity (kept in sync with the local profile by the session provider)

export let demoMe: Author = {
  id: 'me',
  displayName: 'You',
  homeUniversity: '',
  field: null,
  destinationId: null,
  verified: true,
};

/** The whole demo profile (travel buddies need the semester, level and visibility). */
export let demoProfile: Profile = {
  id: 'me',
  displayName: 'You',
  homeUniversity: '',
  homeUniversityId: null,
  field: null,
  level: null,
  destinationId: null,
  term: null,
  verified: true,
  discoverable: false,
};

let demoSignedIn = false;

/**
 * Demo mode mirrors the database rules for guests: student content (posts,
 * equivalences, groups, saved universities, research) is for signed-in
 * students only. True when a guest is browsing the demo.
 */
export function isDemoGuest(): boolean {
  return isDemoMode && !demoSignedIn;
}

/** Throws for guests in demo mode, as RLS does on the server. */
export function requireDemoStudent() {
  if (isDemoGuest()) throw new AuthRequiredError();
}

export function setDemoIdentity(profile: Profile, signedIn: boolean) {
  demoSignedIn = signedIn;
  demoProfile = { ...profile, id: 'me' };
  demoMe = {
    id: 'me',
    displayName: profile.displayName || 'You',
    homeUniversity: profile.homeUniversity,
    field: profile.field,
    destinationId: profile.destinationId,
    verified: profile.verified,
  };
}

// ---------------------------------------------------------------------------
// Row mapping shared by the feed views

export type AuthorColumns = {
  author_id: string;
  author_name: string;
  author_home_university: string;
  author_field: Author['field'];
  author_destination_id: string | null;
  author_verified: boolean;
};

export function mapAuthor(row: AuthorColumns): Author {
  return {
    id: row.author_id,
    displayName: row.author_name,
    homeUniversity: row.author_home_university,
    field: row.author_field,
    destinationId: row.author_destination_id,
    verified: row.author_verified,
  };
}

/** Research and insights still "running" after this long were cut off by the function's time limit. */
export const STALE_JOB_MS = 15 * 60 * 1000;
