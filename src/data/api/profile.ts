/** Profile and account. */
import type { Field, Level, Profile } from '../types';

import { isDemoMode, notifyChange, requireClient } from './core';

type ProfileRow = {
  id: string;
  display_name: string;
  home_university: string;
  home_university_id: string | null;
  field: Field | null;
  level: Level | null;
  destination_id: string | null;
  term: string | null;
  verified: boolean;
  discoverable: boolean;
};

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    homeUniversity: row.home_university,
    homeUniversityId: row.home_university_id,
    field: row.field,
    level: row.level,
    destinationId: row.destination_id,
    term: row.term,
    verified: row.verified,
    discoverable: row.discoverable,
  };
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await requireClient().from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data ? mapProfile(data as ProfileRow) : null;
}

export async function saveProfile(profile: Profile) {
  const { error } = await requireClient()
    .from('profiles')
    .update({
      display_name: profile.displayName,
      home_university: profile.homeUniversity,
      home_university_id: profile.homeUniversityId,
      field: profile.field,
      level: profile.level,
      destination_id: profile.destinationId,
      term: profile.term,
      discoverable: profile.discoverable,
    })
    .eq('id', profile.id);
  if (error) throw error;
  notifyChange();
}

/** Server-side check of the university-email rule (the database enforces it at sign-up). */
export async function isUniversityEmailOnServer(email: string): Promise<boolean | null> {
  if (isDemoMode) return null;
  const { data, error } = await requireClient().rpc('is_university_email', { p_email: email });
  return error ? null : (data as boolean);
}

export async function deleteAccount() {
  if (isDemoMode) return;
  const { error } = await requireClient().functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
}
