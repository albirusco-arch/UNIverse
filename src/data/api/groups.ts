/**
 * Groups and channels (see supabase/migrations/20260926000400_groups.sql):
 * WhatsApp-style chats and Telegram-style public groups and channels.
 */
import { supabase } from '@/lib/supabase';

import { demoReplies, type DemoGroup } from '../demo/social';
import type { Group, GroupKind, GroupMessage, GroupVisibility } from '../types';

import {
  demoMe,
  isDemoGuest,
  isDemoMode,
  mapAuthor,
  notifyChange,
  requireClient,
  requireDemoStudent,
  requireUserId,
  type AuthorColumns,
} from './core';
import { demo } from './demo-store';

type GroupRow = {
  id: string;
  name: string;
  description: string;
  kind: GroupKind;
  visibility: GroupVisibility;
  university_id: string | null;
  club_id: string | null;
  member_count: number;
  last_message_at: string | null;
  last_message_preview: string;
  my_role: Group['myRole'];
  invite_code: string | null;
  unread_count: number;
  peer_id: string | null;
};

function mapGroup(row: GroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    kind: row.kind,
    visibility: row.visibility,
    universityId: row.university_id,
    clubId: row.club_id,
    memberCount: row.member_count,
    lastMessageAt: row.last_message_at,
    lastMessagePreview: row.last_message_preview,
    myRole: row.my_role,
    inviteCode: row.invite_code,
    unreadCount: row.unread_count,
    peerId: row.peer_id,
  };
}

type MessageRow = AuthorColumns & { id: string; group_id: string; body: string; created_at: string };

// ---------------------------------------------------------------------------
// Demo helpers

function demoView(group: DemoGroup): Group {
  const messages = demo.messages.filter((m) => m.groupId === group.id && !demo.blocked.has(m.author.id));
  const last = messages[messages.length - 1];
  const member = group.memberIds.includes(demoMe.id);
  const readAt = demo.readAt.get(group.id) ?? '';
  return {
    ...group,
    myRole: group.ownerId === demoMe.id ? 'owner' : member ? 'member' : null,
    inviteCode: member ? group.inviteCode : null,
    lastMessageAt: last?.createdAt ?? null,
    lastMessagePreview: last?.body.slice(0, 120) ?? '',
    unreadCount: member ? messages.filter((m) => m.createdAt > readAt && m.author.id !== demoMe.id).length : 0,
  };
}

/** Direct chats disappear once either student blocked the other (as in group_directory). */
function visibleDemo(group: DemoGroup): boolean {
  return !(group.kind === 'direct' && group.peerId && demo.blocked.has(group.peerId));
}

function findDemoGroup(id: string): DemoGroup {
  const group = demo.groups.find((g) => g.id === id);
  if (!group) throw new Error('Unknown group');
  return group;
}

function joinDemo(group: DemoGroup) {
  if (!group.memberIds.includes(demoMe.id)) {
    group.memberIds.push(demoMe.id);
    group.memberCount += 1;
  }
}

const byActivity = (a: Group, b: Group) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '');

// ---------------------------------------------------------------------------
// Queries

export async function listMyGroups(): Promise<Group[]> {
  if (isDemoGuest()) return [];
  if (isDemoMode) return demo.groups.filter(visibleDemo).map(demoView).filter((g) => g.myRole !== null).sort(byActivity);
  const { data, error } = await requireClient()
    .from('group_directory')
    .select('*')
    .not('my_role', 'is', null)
    .order('last_message_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data as GroupRow[]).map(mapGroup);
}

export type DiscoverFilter = { query?: string; kind?: GroupKind; universityId?: string };

export async function discoverGroups(filter: DiscoverFilter = {}): Promise<Group[]> {
  if (isDemoGuest()) return [];
  const q = filter.query?.trim().toLowerCase() ?? '';
  if (isDemoMode) {
    return demo.groups
      .map(demoView)
      .filter((g) => g.visibility === 'public')
      .filter((g) => !filter.kind || g.kind === filter.kind)
      .filter((g) => !filter.universityId || g.universityId === filter.universityId)
      .filter((g) => !q || `${g.name} ${g.description}`.toLowerCase().includes(q))
      .sort((a, b) => b.memberCount - a.memberCount);
  }
  let query = requireClient()
    .from('group_directory')
    .select('*')
    .eq('visibility', 'public')
    .order('member_count', { ascending: false })
    .limit(50);
  if (filter.kind) query = query.eq('kind', filter.kind);
  if (filter.universityId) query = query.eq('university_id', filter.universityId);
  if (q) query = query.ilike('name', `%${q}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data as GroupRow[]).map(mapGroup);
}

export async function getGroup(id: string): Promise<Group | null> {
  if (isDemoGuest()) return null;
  if (isDemoMode) {
    const group = demo.groups.find((g) => g.id === id);
    return group && visibleDemo(group) ? demoView(group) : null;
  }
  const { data, error } = await requireClient().from('group_directory').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapGroup(data as GroupRow) : null;
}

export async function listMessages(groupId: string): Promise<GroupMessage[]> {
  if (isDemoGuest()) return [];
  if (isDemoMode) {
    return demo.messages.filter((m) => m.groupId === groupId && !demo.blocked.has(m.author.id));
  }
  const { data, error } = await requireClient()
    .from('group_message_feed')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data as MessageRow[])
    .map((row) => ({ id: row.id, groupId: row.group_id, body: row.body, createdAt: row.created_at, author: mapAuthor(row) }))
    .reverse();
}

/** Calls `onChange` whenever a message is posted in the group (Supabase Realtime). */
export function subscribeToGroup(groupId: string, onChange: () => void): () => void {
  if (!supabase) return () => undefined;
  const channel = supabase
    .channel(`group:${groupId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` }, onChange)
    .subscribe();
  return () => {
    supabase?.removeChannel(channel);
  };
}

// ---------------------------------------------------------------------------
// Mutations

export async function createGroup(input: {
  name: string;
  description: string;
  kind: GroupKind;
  visibility: GroupVisibility;
  universityId: string | null;
}): Promise<string> {
  requireDemoStudent();
  if (isDemoMode) {
    const id = `local-group-${Date.now()}`;
    demo.groups.unshift({
      id,
      name: input.name,
      description: input.description,
      kind: input.kind,
      visibility: input.visibility,
      universityId: input.universityId,
      clubId: null,
      memberCount: 1,
      lastMessageAt: null,
      lastMessagePreview: '',
      myRole: 'owner',
      unreadCount: 0,
      inviteCode: Math.random().toString(36).slice(2, 10).toUpperCase(),
      peerId: null,
      memberIds: [demoMe.id],
      ownerId: demoMe.id,
    });
    notifyChange();
    return id;
  }
  await requireUserId();
  const { data, error } = await requireClient().rpc('create_group', {
    p_name: input.name,
    p_description: input.description,
    p_kind: input.kind,
    p_visibility: input.visibility,
    p_university_id: input.universityId,
  });
  if (error) throw error;
  notifyChange();
  return data as string;
}

export async function joinGroup(groupId: string) {
  requireDemoStudent();
  if (isDemoMode) {
    joinDemo(findDemoGroup(groupId));
  } else {
    const userId = await requireUserId();
    const { error } = await requireClient()
      .from('group_members')
      .upsert({ group_id: groupId, user_id: userId }, { ignoreDuplicates: true });
    if (error) throw error;
  }
  notifyChange();
}

export class InvalidInviteCodeError extends Error {}

export async function joinGroupWithCode(code: string): Promise<string> {
  requireDemoStudent();
  const normalized = code.trim().toUpperCase();
  if (isDemoMode) {
    const group = demo.groups.find((g) => g.inviteCode === normalized && g.kind !== 'direct');
    if (!group) throw new InvalidInviteCodeError('invalid code');
    joinDemo(group);
    notifyChange();
    return group.id;
  }
  await requireUserId();
  const { data, error } = await requireClient().rpc('join_group_with_code', { p_code: normalized });
  if (error) {
    if (error.code === 'P0002') throw new InvalidInviteCodeError('invalid code');
    throw error;
  }
  notifyChange();
  return data as string;
}

/** Opens the chat of a club, creating it on first use. */
export async function openClubGroup(clubId: string, clubName: string): Promise<string> {
  requireDemoStudent();
  if (isDemoMode) {
    let group = demo.groups.find((g) => g.clubId === clubId);
    if (!group) {
      const club = demo.clubs.find((c) => c.id === clubId);
      group = {
        id: `club-group-${clubId}`,
        name: clubName.slice(0, 60),
        description: club?.description ?? '',
        kind: 'group',
        visibility: 'public',
        universityId: club?.universityId ?? null,
        clubId,
        memberCount: 0,
        lastMessageAt: null,
        lastMessagePreview: '',
        myRole: null,
        unreadCount: 0,
        inviteCode: Math.random().toString(36).slice(2, 10).toUpperCase(),
        peerId: null,
        memberIds: [],
        ownerId: demoMe.id,
      };
      demo.groups.unshift(group);
    }
    joinDemo(group);
    notifyChange();
    return group.id;
  }
  await requireUserId();
  const { data, error } = await requireClient().rpc('club_group', { p_club: clubId });
  if (error) throw error;
  notifyChange();
  return data as string;
}

export async function leaveGroup(groupId: string) {
  requireDemoStudent();
  if (isDemoMode) {
    const group = findDemoGroup(groupId);
    group.memberIds = group.memberIds.filter((id) => id !== demoMe.id);
    group.memberCount = Math.max(0, group.memberCount - 1);
  } else {
    const userId = await requireUserId();
    const { error } = await requireClient().from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
    if (error) throw error;
  }
  notifyChange();
}

export async function sendMessage(groupId: string, body: string) {
  requireDemoStudent();
  if (isDemoMode) {
    const group = findDemoGroup(groupId);
    demo.messages.push({ id: `local-${Date.now()}`, groupId, author: demoMe, body, createdAt: new Date().toISOString() });
    demo.readAt.set(groupId, new Date().toISOString());
    notifyChange();
    // A friendly (sample) reply so the chat feels alive in demo mode.
    const replier = demo.messages.find((m) => m.groupId === groupId && m.author.id !== demoMe.id)?.author;
    if (replier && group.kind !== 'channel') {
      setTimeout(() => {
        const text = demoReplies[demo.messages.length % demoReplies.length];
        demo.messages.push({ id: `reply-${Date.now()}`, groupId, author: replier, body: text, createdAt: new Date().toISOString() });
        notifyChange();
      }, 2500);
    }
    return;
  }
  const userId = await requireUserId();
  const { error } = await requireClient().from('group_messages').insert({ group_id: groupId, author_id: userId, body });
  if (error) throw error;
  notifyChange();
}

export async function deleteMessage(messageId: string) {
  requireDemoStudent();
  if (isDemoMode) {
    demo.messages = demo.messages.filter((m) => m.id !== messageId);
  } else {
    const { error } = await requireClient().from('group_messages').delete().eq('id', messageId);
    if (error) throw error;
  }
  notifyChange();
}

export async function markGroupRead(groupId: string) {
  requireDemoStudent();
  if (isDemoMode) {
    demo.readAt.set(groupId, new Date().toISOString());
    return;
  }
  await requireClient().rpc('mark_group_read', { p_group: groupId });
}
