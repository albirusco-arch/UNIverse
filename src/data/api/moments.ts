/**
 * Moments: photos from club life that stay up for 24 hours (BeReal-style),
 * with one emoji reaction per student. Images live in the private `moments`
 * storage bucket and are shown through short-lived signed URLs.
 */
import { applyReaction, isLive } from '@/lib/moments';

import type { Moment, MomentReaction } from '../types';

import {
  demoMe,
  isDemoMode,
  mapAuthor,
  notifyChange,
  requireClient,
  requireDemoStudent,
  requireUserId,
  type AuthorColumns,
} from './core';
import { demo } from './demo-store';

const BUCKET = 'moments';
const SIGNED_URL_SECONDS = 60 * 60;

type MomentRow = AuthorColumns & {
  id: string;
  club_id: string | null;
  club_name: string | null;
  university_id: string | null;
  image_path: string;
  caption: string;
  created_at: string;
  reactions: Partial<Record<MomentReaction, number>> | null;
  my_reaction: MomentReaction | null;
};

async function mapMoments(rows: MomentRow[]): Promise<Moment[]> {
  const paths = rows.map((row) => row.image_path);
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data, error } = await requireClient().storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
    if (error) throw error;
    data.forEach((item) => {
      if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
    });
  }
  return rows.map((row) => ({
    id: row.id,
    author: mapAuthor(row),
    clubId: row.club_id,
    clubName: row.club_name,
    universityId: row.university_id,
    imageUrl: urls.get(row.image_path) ?? '',
    caption: row.caption,
    createdAt: row.created_at,
    reactions: row.reactions ?? {},
    myReaction: row.my_reaction,
  }));
}

export type MomentFilter = { clubId?: string; universityIds?: string[] };

/** Live moments (last 24 hours), newest first. Students only. */
export async function listMoments(filter: MomentFilter = {}): Promise<Moment[]> {
  requireDemoStudent();
  const universityIds = filter.universityIds?.filter(Boolean);
  if (isDemoMode) {
    return demo.moments
      .filter((m) => isLive(m) && !demo.blocked.has(m.author.id))
      .filter((m) => !filter.clubId || m.clubId === filter.clubId)
      .filter((m) => !universityIds?.length || (m.universityId !== null && universityIds.includes(m.universityId)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  let query = requireClient().from('moment_feed').select('*').order('created_at', { ascending: false }).limit(100);
  if (filter.clubId) query = query.eq('club_id', filter.clubId);
  if (universityIds?.length) query = query.in('university_id', universityIds);
  const { data, error } = await query;
  if (error) throw error;
  return mapMoments(data as MomentRow[]);
}

export async function getMoment(id: string): Promise<Moment | null> {
  requireDemoStudent();
  if (isDemoMode) return demo.moments.find((m) => m.id === id && isLive(m)) ?? null;
  const { data, error } = await requireClient().from('moment_feed').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? (await mapMoments([data as MomentRow]))[0] : null;
}

export type MomentInput = {
  imageUri: string;
  mimeType: string;
  caption: string;
  clubId: string | null;
  clubName: string | null;
  universityId: string | null;
};

/** Uploads the photo and publishes the moment. */
export async function createMoment(input: MomentInput): Promise<string> {
  requireDemoStudent();
  if (isDemoMode) {
    const id = `local-moment-${Date.now()}`;
    demo.moments.unshift({
      id,
      author: demoMe,
      clubId: input.clubId,
      clubName: input.clubName,
      universityId: input.universityId,
      imageUrl: input.imageUri,
      caption: input.caption,
      createdAt: new Date().toISOString(),
      reactions: {},
      myReaction: null,
    });
    notifyChange();
    return id;
  }

  const userId = await requireUserId();
  const client = requireClient();
  const extension = input.mimeType === 'image/png' ? 'png' : input.mimeType === 'image/webp' ? 'webp' : 'jpg';
  // The first folder is the author's id: the storage policy only lets students write into their own folder.
  const path = `${userId}/${Date.now()}.${extension}`;
  const body = await (await fetch(input.imageUri)).arrayBuffer();
  const upload = await client.storage.from(BUCKET).upload(path, body, { contentType: input.mimeType, upsert: false });
  if (upload.error) throw upload.error;

  const { data, error } = await client
    .from('moments')
    .insert({
      author_id: userId,
      club_id: input.clubId,
      university_id: input.universityId,
      image_path: path,
      caption: input.caption,
    })
    .select('id')
    .single();
  if (error) {
    await client.storage.from(BUCKET).remove([path]);
    throw error;
  }
  notifyChange();
  return (data as { id: string }).id;
}

/** Sets the viewer's reaction, or clears it with null. */
export async function reactToMoment(momentId: string, reaction: MomentReaction | null): Promise<void> {
  requireDemoStudent();
  if (isDemoMode) {
    demo.moments = demo.moments.map((m) => (m.id === momentId ? { ...m, ...applyReaction(m, reaction) } : m));
  } else {
    const userId = await requireUserId();
    const client = requireClient();
    const { error } = reaction
      ? await client
          .from('moment_reactions')
          .upsert({ moment_id: momentId, user_id: userId, emoji: reaction }, { onConflict: 'moment_id,user_id' })
      : await client.from('moment_reactions').delete().eq('moment_id', momentId).eq('user_id', userId);
    if (error) throw error;
  }
  notifyChange();
}

export async function deleteMoment(momentId: string): Promise<void> {
  requireDemoStudent();
  if (isDemoMode) {
    demo.moments = demo.moments.filter((m) => m.id !== momentId);
  } else {
    const client = requireClient();
    const { data, error } = await client.from('moments').delete().eq('id', momentId).select('image_path').maybeSingle();
    if (error) throw error;
    if (data) await client.storage.from(BUCKET).remove([(data as { image_path: string }).image_path]);
  }
  notifyChange();
}
