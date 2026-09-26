/** The personalised "For you" community feed. */
import { rankPosts, type RankedPost } from '@/lib/feed-ranking';

import type { Profile } from '../types';

import { listPosts, type PostFilter } from './community';
import { listSignals } from './signals';
import { listSavedUniversityIds } from './universities';

/** Ranks the latest posts for this student; filters narrow the candidates first. */
export async function listForYou(profile: Profile, filter: PostFilter = {}): Promise<RankedPost[]> {
  const [posts, signals, saved] = await Promise.all([
    listPosts({ ...filter, limit: 150 }),
    listSignals().catch(() => []),
    listSavedUniversityIds().catch(() => []),
  ]);
  return rankPosts(posts, {
    field: profile.field,
    homeUniversity: profile.homeUniversity,
    destinationId: profile.destinationId,
    savedUniversityIds: saved,
    signals,
  });
}
