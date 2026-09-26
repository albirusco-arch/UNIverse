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

/** A paid AI feature was requested without enough tokens. */
export class InsufficientTokensError extends Error {}

/** A CV-based feature was requested before uploading a CV. */
export class NoCvError extends Error {}

export function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

export async function currentUserId(): Promise<string | null> {
  if (isDemoMode) return demoMe.id;
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

/** Maps a failed edge-function call to the app's typed errors (or rethrows it). */
export async function throwFunctionError(error: unknown): Promise<never> {
  const status = functionErrorStatus(error);
  if (status === 429) throw new RateLimitError('rate limited');
  if (status === 402) throw new InsufficientTokensError('insufficient tokens');
  if (status === 400) {
    const response = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
    const body = await response?.json?.().catch(() => null);
    if (body?.error === 'no_cv') throw new NoCvError('no cv');
  }
  throw error;
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

export function setDemoIdentity(profile: Profile) {
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
