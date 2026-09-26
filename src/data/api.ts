/**
 * Data access for the whole app. Every function works against Supabase when it is
 * configured, and against in-memory sample data otherwise (demo mode).
 */
import { isDemoMode, supabase } from '@/lib/supabase';

import {
  createDemoComments,
  createDemoEquivalences,
  createDemoMatch,
  createDemoPosts,
  demoAuthors,
} from './demo';
import type {
  Author,
  Comment,
  CourseMatch,
  CourseMatchRequest,
  Equivalence,
  Field,
  Level,
  Post,
  Profile,
  Region,
  ReportReason,
  Topic,
  University,
  UniversityStats,
} from './types';
import universitiesJson from './universities.json';

export const universities = universitiesJson as University[];
const universityById = new Map(universities.map((u) => [u.id, u]));

export function getUniversity(id: string | null | undefined): University | undefined {
  return id ? universityById.get(id) : undefined;
}

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

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

async function requireUserId(): Promise<string> {
  if (isDemoMode) return demoMe.id;
  const { data } = await requireClient().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new AuthRequiredError();
  return id;
}

export class AuthRequiredError extends Error {
  constructor() {
    super('Sign in required');
  }
}

// ---------------------------------------------------------------------------
// Demo store

let demoMe: Author = {
  id: 'me',
  displayName: 'You',
  homeUniversity: '',
  field: null,
  destinationId: null,
  verified: false,
};
const demo = {
  posts: createDemoPosts(),
  comments: createDemoComments(),
  equivalences: createDemoEquivalences(),
  matches: [] as CourseMatch[],
  savedUniversities: new Set<string>(['heidelberg']),
  blocked: new Set<string>(),
};

/** Keeps the demo author in sync with the local profile. */
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

/** Replaces a demo post with an updated copy (memoized components compare by reference). */
function updateDemoPost(id: string, update: (post: Post) => Post) {
  demo.posts = demo.posts.map((p) => (p.id === id ? update(p) : p));
}

function visibleDemoPosts() {
  return demo.posts.filter((p) => !demo.blocked.has(p.author.id));
}

// ---------------------------------------------------------------------------
// Row mapping (Supabase views -> app types)

type AuthorColumns = {
  author_id: string;
  author_name: string;
  author_home_university: string;
  author_field: Field | null;
  author_destination_id: string | null;
  author_verified: boolean;
};

function mapAuthor(row: AuthorColumns): Author {
  return {
    id: row.author_id,
    displayName: row.author_name,
    homeUniversity: row.author_home_university,
    field: row.author_field,
    destinationId: row.author_destination_id,
    verified: row.author_verified,
  };
}

type PostRow = AuthorColumns & {
  id: string;
  topic: Topic;
  body: string;
  university_id: string | null;
  field: Field | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  saved_by_me: boolean;
};

function mapPost(row: PostRow): Post {
  return {
    id: row.id,
    author: mapAuthor(row),
    topic: row.topic,
    body: row.body,
    universityId: row.university_id,
    field: row.field,
    createdAt: row.created_at,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    likedByMe: row.liked_by_me,
    savedByMe: row.saved_by_me,
  };
}

type CommentRow = AuthorColumns & { id: string; post_id: string; body: string; created_at: string };

type EquivalenceRow = AuthorColumns & {
  id: string;
  home_university: string;
  home_course: string;
  home_ects: number | null;
  destination_id: string;
  destination_course: string;
  destination_ects: number | null;
  approved: boolean;
  academic_year: string;
  created_at: string;
};

function mapEquivalence(row: EquivalenceRow): Equivalence {
  return {
    id: row.id,
    submittedBy: mapAuthor(row),
    homeUniversity: row.home_university,
    homeCourse: row.home_course,
    homeEcts: row.home_ects,
    destinationId: row.destination_id,
    destinationCourse: row.destination_course,
    destinationEcts: row.destination_ects,
    approved: row.approved,
    academicYear: row.academic_year,
    createdAt: row.created_at,
  };
}

type MatchRow = {
  id: string;
  status: CourseMatch['status'];
  request: CourseMatchRequest;
  report: CourseMatch['report'];
  error: string | null;
  created_at: string;
};

/** A research still "running" after this long was cut off by the function's time limit. */
const STALE_MATCH_MS = 10 * 60 * 1000;

function mapMatch(row: MatchRow): CourseMatch {
  const pending = row.status === 'pending' || row.status === 'running';
  const stale = pending && Date.now() - new Date(row.created_at).getTime() > STALE_MATCH_MS;
  return {
    id: row.id,
    status: stale ? 'error' : row.status,
    request: row.request,
    report: row.report,
    error: stale ? 'timeout' : row.error,
    createdAt: row.created_at,
  };
}

type ProfileRow = {
  id: string;
  display_name: string;
  home_university: string;
  field: Field | null;
  level: Level | null;
  destination_id: string | null;
  term: string | null;
  verified: boolean;
};

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    homeUniversity: row.home_university,
    field: row.field,
    level: row.level,
    destinationId: row.destination_id,
    term: row.term,
    verified: row.verified,
  };
}

// ---------------------------------------------------------------------------
// Universities

export function searchUniversities(query: string, region: Region | 'all' = 'all'): University[] {
  const q = normalize(query);
  return universities.filter((u) => {
    if (region !== 'all' && u.region !== region) return false;
    if (!q) return true;
    return [u.name, u.city, u.country].some((value) => normalize(value).includes(q));
  });
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export async function getUniversityStats(): Promise<Record<string, UniversityStats>> {
  if (isDemoMode) {
    const stats: Record<string, UniversityStats> = {};
    const bump = (id: string | null, key: keyof UniversityStats) => {
      if (!id) return;
      stats[id] ??= { members: 0, equivalences: 0 };
      stats[id][key] += 1;
    };
    Object.values(demoAuthors).forEach((author) => bump(author.destinationId, 'members'));
    demo.equivalences.forEach((e) => bump(e.destinationId, 'equivalences'));
    return stats;
  }
  const { data, error } = await requireClient().from('university_stats').select('*');
  if (error) throw error;
  const stats: Record<string, UniversityStats> = {};
  for (const row of data as { university_id: string; members: number; equivalences: number }[]) {
    stats[row.university_id] = { members: row.members, equivalences: row.equivalences };
  }
  return stats;
}

export async function listSavedUniversityIds(): Promise<string[]> {
  if (isDemoMode) return [...demo.savedUniversities];
  const { data: session } = await requireClient().auth.getSession();
  if (!session.session) return [];
  const { data, error } = await requireClient().from('saved_universities').select('university_id');
  if (error) throw error;
  return (data as { university_id: string }[]).map((row) => row.university_id);
}

export async function setUniversitySaved(universityId: string, saved: boolean) {
  if (isDemoMode) {
    if (saved) demo.savedUniversities.add(universityId);
    else demo.savedUniversities.delete(universityId);
  } else {
    const userId = await requireUserId();
    const table = requireClient().from('saved_universities');
    const { error } = saved
      ? await table.upsert({ user_id: userId, university_id: universityId }, { ignoreDuplicates: true })
      : await table.delete().eq('user_id', userId).eq('university_id', universityId);
    if (error) throw error;
  }
  notifyChange();
}

// ---------------------------------------------------------------------------
// Posts & comments

export type PostFilter = {
  universityId?: string;
  topics?: Topic[];
  field?: Field | null;
  verifiedOnly?: boolean;
  query?: string;
  authorId?: string;
  limit?: number;
};

export async function listPosts(filter: PostFilter = {}): Promise<Post[]> {
  if (isDemoMode) {
    const q = normalize(filter.query ?? '');
    return visibleDemoPosts()
      .filter((p) => !filter.universityId || p.universityId === filter.universityId)
      .filter((p) => !filter.topics?.length || filter.topics.includes(p.topic))
      .filter((p) => !filter.field || p.field === filter.field)
      .filter((p) => !filter.verifiedOnly || p.author.verified)
      .filter((p) => !filter.authorId || p.author.id === filter.authorId)
      .filter((p) => !q || normalize(p.body).includes(q))
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
      .slice(0, filter.limit ?? 50);
  }
  let query = requireClient()
    .from('post_feed')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(filter.limit ?? 50);
  if (filter.universityId) query = query.eq('university_id', filter.universityId);
  if (filter.topics?.length) query = query.in('topic', filter.topics);
  if (filter.field) query = query.eq('field', filter.field);
  if (filter.verifiedOnly) query = query.eq('author_verified', true);
  if (filter.authorId) query = query.eq('author_id', filter.authorId);
  if (filter.query?.trim()) query = query.ilike('body', `%${filter.query.trim()}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data as PostRow[]).map(mapPost);
}

export async function getPost(id: string): Promise<Post | null> {
  if (isDemoMode) return visibleDemoPosts().find((p) => p.id === id) ?? null;
  const { data, error } = await requireClient().from('post_feed').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapPost(data as PostRow) : null;
}

export async function createPost(input: {
  topic: Topic;
  body: string;
  universityId: string | null;
  field: Field | null;
}): Promise<string> {
  if (isDemoMode) {
    const id = `local-${Date.now()}`;
    demo.posts.unshift({
      id,
      author: demoMe,
      ...input,
      createdAt: new Date().toISOString(),
      likeCount: 0,
      commentCount: 0,
      likedByMe: false,
      savedByMe: false,
    });
    notifyChange();
    return id;
  }
  const userId = await requireUserId();
  const { data, error } = await requireClient()
    .from('posts')
    .insert({
      author_id: userId,
      topic: input.topic,
      body: input.body,
      university_id: input.universityId,
      field: input.field,
    })
    .select('id')
    .single();
  if (error) throw error;
  notifyChange();
  return (data as { id: string }).id;
}

export async function deletePost(id: string) {
  if (isDemoMode) {
    demo.posts = demo.posts.filter((p) => p.id !== id);
  } else {
    const { error } = await requireClient().from('posts').delete().eq('id', id);
    if (error) throw error;
  }
  notifyChange();
}

export async function setPostLiked(post: Post, liked: boolean) {
  if (isDemoMode) {
    updateDemoPost(post.id, (p) =>
      p.likedByMe === liked ? p : { ...p, likedByMe: liked, likeCount: p.likeCount + (liked ? 1 : -1) },
    );
  } else {
    const userId = await requireUserId();
    const table = requireClient().from('post_likes');
    const { error } = liked
      ? await table.upsert({ post_id: post.id, user_id: userId }, { ignoreDuplicates: true })
      : await table.delete().eq('post_id', post.id).eq('user_id', userId);
    if (error) throw error;
  }
  notifyChange();
}

export async function setPostSaved(post: Post, saved: boolean) {
  if (isDemoMode) {
    updateDemoPost(post.id, (p) => ({ ...p, savedByMe: saved }));
  } else {
    const userId = await requireUserId();
    const table = requireClient().from('post_saves');
    const { error } = saved
      ? await table.upsert({ post_id: post.id, user_id: userId }, { ignoreDuplicates: true })
      : await table.delete().eq('post_id', post.id).eq('user_id', userId);
    if (error) throw error;
  }
  notifyChange();
}

export async function listComments(postId: string): Promise<Comment[]> {
  if (isDemoMode) {
    return demo.comments
      .filter((c) => c.postId === postId && !demo.blocked.has(c.author.id))
      .sort((x, y) => x.createdAt.localeCompare(y.createdAt));
  }
  const { data, error } = await requireClient()
    .from('comment_feed')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as CommentRow[]).map((row) => ({
    id: row.id,
    postId: row.post_id,
    body: row.body,
    createdAt: row.created_at,
    author: mapAuthor(row),
  }));
}

export async function createComment(postId: string, body: string) {
  if (isDemoMode) {
    demo.comments.push({
      id: `local-${Date.now()}`,
      postId,
      author: demoMe,
      body,
      createdAt: new Date().toISOString(),
    });
    updateDemoPost(postId, (p) => ({ ...p, commentCount: p.commentCount + 1 }));
  } else {
    const userId = await requireUserId();
    const { error } = await requireClient()
      .from('comments')
      .insert({ post_id: postId, author_id: userId, body });
    if (error) throw error;
  }
  notifyChange();
}

// ---------------------------------------------------------------------------
// Moderation (App Store Review Guideline 1.2: report + block for user content)

export async function reportContent(
  targetType: 'post' | 'comment' | 'user',
  targetId: string,
  reason: ReportReason,
) {
  if (isDemoMode) return;
  const userId = await requireUserId();
  const { error } = await requireClient()
    .from('reports')
    .upsert(
      { reporter_id: userId, target_type: targetType, target_id: targetId, reason },
      { onConflict: 'reporter_id,target_type,target_id', ignoreDuplicates: true },
    );
  if (error) throw error;
}

export async function blockUser(userId: string) {
  if (isDemoMode) {
    demo.blocked.add(userId);
  } else {
    const me = await requireUserId();
    const { error } = await requireClient()
      .from('blocks')
      .upsert({ blocker_id: me, blocked_id: userId }, { ignoreDuplicates: true });
    if (error) throw error;
  }
  notifyChange();
}

// ---------------------------------------------------------------------------
// Equivalences

export async function listEquivalences(filter: { destinationId?: string } = {}): Promise<Equivalence[]> {
  if (isDemoMode) {
    return demo.equivalences
      .filter((e) => !filter.destinationId || e.destinationId === filter.destinationId)
      .filter((e) => !demo.blocked.has(e.submittedBy.id))
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  }
  let query = requireClient().from('equivalence_feed').select('*').order('created_at', { ascending: false });
  if (filter.destinationId) query = query.eq('destination_id', filter.destinationId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as EquivalenceRow[]).map(mapEquivalence);
}

export async function createEquivalence(input: Omit<Equivalence, 'id' | 'submittedBy' | 'createdAt'>) {
  if (isDemoMode) {
    demo.equivalences.unshift({
      ...input,
      id: `local-${Date.now()}`,
      submittedBy: demoMe,
      createdAt: new Date().toISOString(),
    });
  } else {
    const userId = await requireUserId();
    const { error } = await requireClient().from('equivalences').insert({
      submitted_by: userId,
      home_university: input.homeUniversity,
      home_course: input.homeCourse,
      home_ects: input.homeEcts,
      destination_id: input.destinationId,
      destination_course: input.destinationCourse,
      destination_ects: input.destinationEcts,
      approved: input.approved,
      academic_year: input.academicYear,
    });
    if (error) throw error;
  }
  notifyChange();
}

// ---------------------------------------------------------------------------
// AI course matching (see supabase/functions/course-match)

export class RateLimitError extends Error {}

export async function requestCourseMatch(request: CourseMatchRequest): Promise<string> {
  if (isDemoMode) {
    const id = `demo-${Date.now()}`;
    demo.matches.unshift({ ...createDemoMatch(request, id), status: 'running', report: null });
    // Simulate the research delay so the progress UI can be seen.
    setTimeout(() => {
      const index = demo.matches.findIndex((m) => m.id === id);
      if (index >= 0) demo.matches[index] = createDemoMatch(request, id);
      notifyChange();
    }, 6000);
    notifyChange();
    return id;
  }
  await requireUserId();
  const { data, error } = await requireClient().functions.invoke<{ id: string }>('course-match', {
    body: { request },
  });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 429) throw new RateLimitError('rate limited');
    throw error;
  }
  if (!data?.id) throw new Error('Missing match id');
  notifyChange();
  return data.id;
}

export async function getCourseMatch(id: string): Promise<CourseMatch | null> {
  if (isDemoMode) return demo.matches.find((m) => m.id === id) ?? null;
  const { data, error } = await requireClient()
    .from('course_matches')
    .select('id,status,request,report,error,created_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapMatch(data as MatchRow) : null;
}

export async function listMyMatches(): Promise<CourseMatch[]> {
  if (isDemoMode) return [...demo.matches];
  const { data: session } = await requireClient().auth.getSession();
  if (!session.session) return [];
  const { data, error } = await requireClient()
    .from('course_matches')
    .select('id,status,request,report,error,created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data as MatchRow[]).map(mapMatch);
}

// ---------------------------------------------------------------------------
// Profile & account

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
      field: profile.field,
      level: profile.level,
      destination_id: profile.destinationId,
      term: profile.term,
    })
    .eq('id', profile.id);
  if (error) throw error;
  notifyChange();
}

export async function deleteAccount() {
  if (isDemoMode) return;
  const { error } = await requireClient().functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
}
