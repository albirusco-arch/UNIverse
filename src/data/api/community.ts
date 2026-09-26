/** Community: posts, comments, likes, saves, moderation and course equivalences. */
import { normalize } from '../catalogue';
import type { Comment, Equivalence, Field, Post, ReportReason, ReportTarget, Topic } from '../types';

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
import { demo, updateDemoPost } from './demo-store';

function visibleDemoPosts() {
  return demo.posts.filter((p) => !demo.blocked.has(p.author.id));
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

export function mapEquivalence(row: EquivalenceRow): Equivalence {
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
  if (isDemoGuest()) return [];
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
  if (isDemoGuest()) return null;
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
  requireDemoStudent();
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
  requireDemoStudent();
  if (isDemoMode) {
    demo.posts = demo.posts.filter((p) => p.id !== id);
  } else {
    const { error } = await requireClient().from('posts').delete().eq('id', id);
    if (error) throw error;
  }
  notifyChange();
}

export async function setPostLiked(post: Post, liked: boolean) {
  requireDemoStudent();
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
  requireDemoStudent();
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
  if (isDemoGuest()) return [];
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
  requireDemoStudent();
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

export async function reportContent(targetType: ReportTarget, targetId: string, reason: ReportReason) {
  requireDemoStudent();
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
  requireDemoStudent();
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
  if (isDemoGuest()) return [];
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
  requireDemoStudent();
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
