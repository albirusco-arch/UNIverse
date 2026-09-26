/** Profile and account. */
import type { CareerLinks, Field, Level, Profile, PublicProfile } from '../types';

import { demoMe, isDemoMode, notifyChange, requireClient } from './core';
import { demo } from './demo-store';

const NO_LINKS: CareerLinks = { linkedinUrl: '', handshakeUrl: '', jobteaserUrl: '', openToOpportunities: false };

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
  linkedin_url: string;
  handshake_url: string;
  jobteaser_url: string;
  open_to_opportunities: boolean;
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
    linkedinUrl: row.linkedin_url ?? '',
    handshakeUrl: row.handshake_url ?? '',
    jobteaserUrl: row.jobteaser_url ?? '',
    openToOpportunities: row.open_to_opportunities ?? false,
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
      linkedin_url: profile.linkedinUrl,
      handshake_url: profile.handshakeUrl,
      jobteaser_url: profile.jobteaserUrl,
      open_to_opportunities: profile.openToOpportunities,
    })
    .eq('id', profile.id);
  if (error) throw error;
  notifyChange();
}

/** Another student's profile, with the career links they chose to share. */
export async function getPublicProfile(id: string): Promise<PublicProfile | null> {
  if (isDemoMode) {
    const author = [demoMe, ...demo.posts.map((p) => p.author), ...demo.messages.map((m) => m.author)].find((a) => a.id === id);
    return author ? { ...author, ...(demo.links[id] ?? NO_LINKS), level: null } : null;
  }
  const { data, error } = await requireClient().from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const profile = mapProfile(data as ProfileRow);
  return {
    id: profile.id,
    displayName: profile.displayName,
    homeUniversity: profile.homeUniversity,
    field: profile.field,
    destinationId: profile.destinationId,
    verified: profile.verified,
    level: profile.level,
    linkedinUrl: profile.linkedinUrl,
    handshakeUrl: profile.handshakeUrl,
    jobteaserUrl: profile.jobteaserUrl,
    openToOpportunities: profile.openToOpportunities,
  };
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
