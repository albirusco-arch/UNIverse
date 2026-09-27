/**
 * Opportunities: internships, graduate jobs, part-time work and events. Each
 * row links to the original listing (LinkedIn, Handshake, JobTeaser,
 * Eventbrite, a university or club page); students can share one with its link.
 */
import type { Field, Opportunity, OpportunityKind } from '../types';

import { isDemoGuest, isDemoMode, notifyChange, requireClient, requireDemoStudent, requireUserId } from './core';
import { demo } from './demo-store';

type OpportunityRow = {
  id: string;
  kind: Opportunity['kind'];
  title: string;
  organization: string;
  city: string;
  country_code: string;
  remote: boolean;
  field: Field | null;
  url: string;
  source: Opportunity['source'];
  university_id: string | null;
  club_id: string | null;
  deadline: string | null;
  starts_at: string | null;
  created_at: string;
  verified: boolean;
};

function mapOpportunity(row: OpportunityRow): Opportunity {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    organization: row.organization,
    city: row.city,
    countryCode: row.country_code,
    remote: row.remote,
    field: row.field,
    url: row.url,
    source: row.source,
    universityId: row.university_id,
    clubId: row.club_id,
    deadline: row.deadline,
    startsAt: row.starts_at,
    createdAt: row.created_at,
    verified: row.verified,
  };
}

/** Guests see verified listings only (as the anon RLS policy on opportunities). */
const visibleToGuests = (item: Pick<Opportunity, 'verified'>) => item.verified;

/**
 * Open listings, newest first. Filtering and ranking happen in
 * `filterOpportunities` (src/lib/opportunities.ts) so they work offline too.
 */
export async function listOpportunities(): Promise<Opportunity[]> {
  if (isDemoMode) return demo.opportunities.filter((o) => !isDemoGuest() || visibleToGuests(o));
  const now = new Date().toISOString();
  const { data, error } = await requireClient()
    .from('opportunities')
    .select('id, kind, title, organization, city, country_code, remote, field, url, source, university_id, club_id, deadline, starts_at, created_at, verified')
    .or(`deadline.is.null,deadline.gte.${now}`)
    .or(`starts_at.is.null,starts_at.gte.${now}`)
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data as OpportunityRow[]).map(mapOpportunity);
}

export type OpportunityInput = {
  kind: OpportunityKind;
  title: string;
  organization: string;
  city: string;
  remote: boolean;
  url: string;
  deadline: string | null;
  startsAt: string | null;
  universityId: string | null;
  clubId: string | null;
  field: Field | null;
};

/** A student shares a listing with its link; it stays marked unverified. */
export async function shareOpportunity(input: OpportunityInput): Promise<void> {
  requireDemoStudent();
  if (isDemoMode) {
    demo.opportunities.unshift({
      ...input,
      id: `local-opportunity-${Date.now()}`,
      countryCode: '',
      source: 'student',
      createdAt: new Date().toISOString(),
      verified: false,
    });
  } else {
    const userId = await requireUserId();
    const { error } = await requireClient().from('opportunities').insert({
      kind: input.kind,
      title: input.title,
      organization: input.organization,
      city: input.city,
      remote: input.remote,
      url: input.url,
      deadline: input.deadline,
      starts_at: input.startsAt,
      university_id: input.universityId,
      club_id: input.clubId,
      field: input.field,
      created_by: userId,
    });
    if (error) throw error;
  }
  notifyChange();
}
