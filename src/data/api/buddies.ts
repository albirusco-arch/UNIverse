/**
 * Travel buddies (see supabase/migrations/20260928000000_travel_buddies.sql):
 * visible students going to the same destination wave at each other and chat
 * one to one once both have waved.
 */
import { termKey } from '@/lib/buddies';

import { getUniversity } from '../catalogue';
import { createDemoBuddies, DEMO_WAVES_BACK, demoGreeting } from '../demo/buddies';
import type { Buddy, BuddyCount, Field, Level } from '../types';

import {
  demoMe,
  demoProfile,
  isDemoGuest,
  isDemoMode,
  notifyChange,
  RateLimitError,
  requireClient,
  requireDemoStudent,
  requireUserId,
} from './core';
import { demo } from './demo-store';

type BuddyRow = {
  id: string;
  display_name: string;
  home_university: string;
  home_university_id: string | null;
  field: Field | null;
  level: Level | null;
  destination_id: string | null;
  term: string | null;
  verified: boolean;
  waved_by_me: boolean;
  waved_me: boolean;
  chat_id: string | null;
};

function mapBuddy(row: BuddyRow): Buddy {
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
    wavedByMe: row.waved_by_me,
    wavedMe: row.waved_me,
    chatId: row.chat_id,
  };
}

function demoBuddies(): Buddy[] {
  return createDemoBuddies(demoProfile)
    .filter((buddy) => !demo.blocked.has(buddy.id))
    .map((buddy) => ({
      ...buddy,
      wavedByMe: demo.wavedByMe.has(buddy.id),
      wavedMe: demo.wavedMe.has(buddy.id),
      chatId: demo.groups.find((g) => g.kind === 'direct' && g.peerId === buddy.id)?.id ?? null,
    }));
}

/** Visible students going to the student's destination, counted even before they are visible themselves. */
export async function countTravelBuddies(): Promise<BuddyCount> {
  if (isDemoGuest()) return { total: 0, sameTerm: 0 };
  if (isDemoMode) {
    const buddies = demoBuddies();
    const term = termKey(demoProfile.term);
    return { total: buddies.length, sameTerm: buddies.filter((b) => term !== null && termKey(b.term) === term).length };
  }
  const { data, error } = await requireClient().rpc('travel_buddy_count');
  if (error) throw error;
  const row = (data as { total: number; same_term: number }[] | null)?.[0];
  return { total: row?.total ?? 0, sameTerm: row?.same_term ?? 0 };
}

/** Empty until the student is visible too (reciprocal, enforced by the database). */
export async function listTravelBuddies(): Promise<Buddy[]> {
  if (isDemoGuest()) return [];
  if (isDemoMode) return demoProfile.discoverable ? demoBuddies() : [];
  const { data, error } = await requireClient().from('travel_buddies').select('*').limit(300);
  if (error) throw error;
  return (data as BuddyRow[]).map(mapBuddy);
}

export async function waveAt(userId: string) {
  requireDemoStudent();
  if (isDemoMode) {
    demo.wavedByMe.add(userId);
    notifyChange();
    // Some sample students wave back, so the demo reaches the chat.
    if (DEMO_WAVES_BACK.has(userId) && !demo.wavedMe.has(userId)) {
      setTimeout(() => {
        demo.wavedMe.add(userId);
        notifyChange();
      }, 2500);
    }
    return;
  }
  const me = await requireUserId();
  const { error } = await requireClient().from('waves').insert({ from_id: me, to_id: userId });
  // 23505: already waved.
  if (error && error.code !== '23505') {
    if (error.message.includes('wave_limit')) throw new RateLimitError('wave_limit');
    throw error;
  }
  notifyChange();
}

/** Opens the direct chat with a buddy (both must have waved), creating it on first use. */
export async function openDirectChat(buddy: Buddy): Promise<string> {
  requireDemoStudent();
  if (isDemoMode) {
    let group = demo.groups.find((g) => g.kind === 'direct' && g.peerId === buddy.id);
    if (!group) {
      group = {
        id: `direct-${buddy.id}`,
        name: buddy.displayName,
        description: buddy.homeUniversity,
        kind: 'direct',
        visibility: 'private',
        universityId: null,
        clubId: null,
        memberCount: 2,
        lastMessageAt: null,
        lastMessagePreview: '',
        myRole: 'member',
        unreadCount: 0,
        inviteCode: null,
        peerId: buddy.id,
        memberIds: [demoMe.id, buddy.id],
        ownerId: '',
      };
      demo.groups.unshift(group);
      const destination = getUniversity(buddy.destinationId)?.name ?? '';
      demo.messages.push({
        id: `direct-hello-${buddy.id}`,
        groupId: group.id,
        author: {
          id: buddy.id,
          displayName: buddy.displayName,
          homeUniversity: buddy.homeUniversity,
          field: buddy.field,
          destinationId: buddy.destinationId,
          verified: buddy.verified,
        },
        body: demoGreeting(destination),
        createdAt: new Date().toISOString(),
      });
    }
    notifyChange();
    return group.id;
  }
  await requireUserId();
  const { data, error } = await requireClient().rpc('open_direct_chat', { p_user: buddy.id });
  if (error) throw error;
  notifyChange();
  return data as string;
}
