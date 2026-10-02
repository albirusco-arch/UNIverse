/**
 * Launch campuses (see supabase/migrations/20260929000000_campus_launch.sql):
 * campus features open one university at a time, CBS first. The students of a
 * launch campus and those going there find each other (waves and chats as in
 * buddies.ts) and make plans for the next 24 hours.
 */
import { createDemoBuddies } from '../demo/buddies';
import { createDemoCampusPeople, DEMO_LAUNCH_CAMPUSES, demoPlanGreeting, type DemoPlan } from '../demo/campus';
import type { Buddy, CampusCount, Plan } from '../types';

import {
  demoMe,
  demoProfile,
  isDemoGuest,
  isDemoMode,
  mapAuthor,
  mapBuddy,
  notifyChange,
  RateLimitError,
  requireClient,
  requireDemoStudent,
  requireUserId,
  type AuthorColumns,
  type BuddyRow,
} from './core';
import { demo } from './demo-store';

type PlanRow = AuthorColumns & {
  id: string;
  university_id: string;
  title: string;
  place: string;
  starts_at: string;
  created_at: string;
  member_count: number;
  joined_by_me: boolean;
  group_id: string | null;
};

function mapPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    universityId: row.university_id,
    title: row.title,
    place: row.place,
    startsAt: row.starts_at,
    createdAt: row.created_at,
    author: mapAuthor(row),
    memberCount: row.member_count,
    joinedByMe: row.joined_by_me,
    groupId: row.group_id,
  };
}

// ---------------------------------------------------------------------------
// Demo helpers (the same rules as the database)

function demoMember(campusId: string): boolean {
  return (
    !isDemoGuest() &&
    DEMO_LAUNCH_CAMPUSES.includes(campusId) &&
    (demoProfile.homeUniversityId === campusId || demoProfile.destinationId === campusId)
  );
}

function demoCampusPeople(campusId: string): Buddy[] {
  const goingThere = demoProfile.destinationId === campusId ? createDemoBuddies(demoProfile) : [];
  return [...createDemoCampusPeople(campusId), ...goingThere]
    .filter((person) => !demo.blocked.has(person.id))
    .map((person) => ({
      ...person,
      wavedByMe: demo.wavedByMe.has(person.id),
      wavedMe: demo.wavedMe.has(person.id),
      chatId: demo.groups.find((g) => g.kind === 'direct' && g.peerId === person.id)?.id ?? null,
    }));
}

function demoPlanView(plan: DemoPlan): Plan {
  const { chatId, ...rest } = plan;
  return { ...rest, groupId: plan.joinedByMe ? chatId : null };
}

function findDemoPlan(id: string): DemoPlan {
  const plan = demo.plans.find((p) => p.id === id);
  if (!plan) throw new Error('Unknown plan');
  return plan;
}

// ---------------------------------------------------------------------------
// Queries

/** Universities where campus features are open (CBS first). */
export async function listLaunchCampuses(): Promise<string[]> {
  if (isDemoMode) return DEMO_LAUNCH_CAMPUSES;
  const { data, error } = await requireClient().from('launch_campuses').select('university_id');
  if (error) throw error;
  return (data as { university_id: string }[]).map((row) => row.university_id);
}

/** Visible students of the campus, counted even before the student is visible. */
export async function countCampusPeople(campusId: string): Promise<CampusCount> {
  if (isDemoMode) {
    if (!demoMember(campusId)) return { total: 0, incoming: 0 };
    const people = demoCampusPeople(campusId);
    return { total: people.length, incoming: people.filter((p) => p.destinationId === campusId).length };
  }
  const { data, error } = await requireClient().rpc('campus_people_count', { p_university: campusId });
  if (error) throw error;
  const row = (data as { total: number; incoming: number }[] | null)?.[0];
  return { total: row?.total ?? 0, incoming: row?.incoming ?? 0 };
}

/** Empty until the student is visible too (reciprocal, enforced by the database). */
export async function listCampusPeople(campusId: string): Promise<Buddy[]> {
  if (isDemoMode) return demoMember(campusId) && demoProfile.discoverable ? demoCampusPeople(campusId) : [];
  const { data, error } = await requireClient().from('campus_people').select('*').eq('campus_id', campusId).limit(500);
  if (error) throw error;
  return (data as BuddyRow[]).map(mapBuddy);
}

/** Plans of the campus until 3 hours after they start. */
export async function listPlans(campusId: string): Promise<Plan[]> {
  if (isDemoMode) {
    if (!demoMember(campusId)) return [];
    return demo.plans
      .filter((p) => p.universityId === campusId && !demo.blocked.has(p.author.id))
      .map(demoPlanView);
  }
  const { data, error } = await requireClient()
    .from('plan_feed')
    .select('*')
    .eq('university_id', campusId)
    .order('starts_at')
    .limit(100);
  if (error) throw error;
  return (data as PlanRow[]).map(mapPlan);
}

// ---------------------------------------------------------------------------
// Mutations

export async function createPlan(input: { campusId: string; title: string; place: string; startsAt: Date }): Promise<string> {
  requireDemoStudent();
  if (isDemoMode) {
    const today = demo.plans.filter(
      (p) => p.author.id === demoMe.id && Date.now() - new Date(p.createdAt).getTime() < 24 * 60 * 60 * 1000,
    );
    if (today.length >= 3) throw new RateLimitError('plan_limit');
    const id = `local-plan-${Date.now()}`;
    const chatId = `plan-chat-${id}`;
    demo.groups.unshift({
      id: chatId,
      name: input.title.slice(0, 60),
      description: input.place,
      kind: 'group',
      visibility: 'private',
      universityId: input.campusId,
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
    demo.plans.push({
      id,
      universityId: input.campusId,
      title: input.title,
      place: input.place,
      startsAt: input.startsAt.toISOString(),
      createdAt: new Date().toISOString(),
      author: demoMe,
      memberCount: 1,
      joinedByMe: true,
      groupId: null,
      chatId,
    });
    notifyChange();
    return id;
  }
  await requireUserId();
  const { data, error } = await requireClient().rpc('create_plan', {
    p_university: input.campusId,
    p_title: input.title,
    p_place: input.place,
    p_starts_at: input.startsAt.toISOString(),
  });
  if (error) {
    if (error.message.includes('plan_limit')) throw new RateLimitError('plan_limit');
    throw error;
  }
  notifyChange();
  return data as string;
}

/** Joins a plan and its chat; returns the chat. */
export async function joinPlan(planId: string): Promise<string | null> {
  requireDemoStudent();
  if (isDemoMode) {
    const plan = findDemoPlan(planId);
    if (!plan.chatId) {
      plan.chatId = `plan-chat-${plan.id}`;
      demo.groups.unshift({
        id: plan.chatId,
        name: plan.title.slice(0, 60),
        description: plan.place,
        kind: 'group',
        visibility: 'private',
        universityId: plan.universityId,
        clubId: null,
        memberCount: plan.memberCount,
        lastMessageAt: null,
        lastMessagePreview: '',
        myRole: null,
        unreadCount: 0,
        inviteCode: Math.random().toString(36).slice(2, 10).toUpperCase(),
        peerId: null,
        memberIds: [plan.author.id],
        ownerId: plan.author.id,
      });
      demo.messages.push({
        id: `plan-hello-${plan.id}`,
        groupId: plan.chatId,
        author: plan.author,
        body: demoPlanGreeting,
        createdAt: new Date().toISOString(),
      });
    }
    const chat = demo.groups.find((g) => g.id === plan.chatId);
    if (!plan.joinedByMe) {
      plan.joinedByMe = true;
      plan.memberCount += 1;
      if (chat && !chat.memberIds.includes(demoMe.id)) {
        chat.memberIds.push(demoMe.id);
        chat.memberCount += 1;
      }
    }
    notifyChange();
    return plan.chatId;
  }
  await requireUserId();
  const { data, error } = await requireClient().rpc('join_plan', { p_plan: planId });
  if (error) throw error;
  notifyChange();
  return (data as string | null) ?? null;
}

export async function leavePlan(planId: string) {
  requireDemoStudent();
  if (isDemoMode) {
    const plan = findDemoPlan(planId);
    if (plan.joinedByMe && plan.author.id !== demoMe.id) {
      plan.joinedByMe = false;
      plan.memberCount = Math.max(0, plan.memberCount - 1);
      const chat = demo.groups.find((g) => g.id === plan.chatId);
      if (chat) {
        chat.memberIds = chat.memberIds.filter((id) => id !== demoMe.id);
        chat.memberCount = Math.max(0, chat.memberCount - 1);
      }
    }
  } else {
    await requireUserId();
    const { error } = await requireClient().rpc('leave_plan', { p_plan: planId });
    if (error) throw error;
  }
  notifyChange();
}

/** Authors delete their plan, and its chat with it. */
export async function deletePlan(planId: string) {
  requireDemoStudent();
  if (isDemoMode) {
    const plan = findDemoPlan(planId);
    demo.plans = demo.plans.filter((p) => p.id !== planId);
    demo.groups = demo.groups.filter((g) => g.id !== plan.chatId);
  } else {
    const { error } = await requireClient().from('plans').delete().eq('id', planId);
    if (error) throw error;
  }
  notifyChange();
}
