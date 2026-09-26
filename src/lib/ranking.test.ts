import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Post, RatingSummary } from '../data/types';
import { rankPosts } from './feed-ranking.ts';
import { combineScore, isTopRated, studentScore } from './scores.ts';

const now = Date.parse('2026-09-26T12:00:00Z');
const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString();

function post(id: string, overrides: Partial<Post> = {}): Post {
  return {
    id,
    author: { id: `a-${id}`, displayName: id, homeUniversity: 'Somewhere', field: null, destinationId: null, verified: true },
    topic: 'question',
    body: 'A generic question about student life abroad',
    universityId: null,
    field: null,
    createdAt: hoursAgo(1),
    likeCount: 0,
    commentCount: 0,
    likedByMe: false,
    savedByMe: false,
    ...overrides,
  };
}

const context = {
  field: 'biochemistry' as const,
  homeUniversity: 'University of Milan',
  destinationId: 'heidelberg',
  savedUniversityIds: ['lmu'],
  now,
};

test('posts about the destination rank first and say why', () => {
  const ranked = rankPosts([post('generic'), post('dest', { universityId: 'heidelberg' }), post('saved', { universityId: 'lmu' })], {
    ...context,
    signals: [],
  });
  assert.deepEqual(
    ranked.map((r) => r.post.id),
    ['dest', 'saved', 'generic'],
  );
  assert.deepEqual(ranked[0].reason, { kind: 'destination' });
  assert.equal(ranked[2].reason, null);
});

test('searches, views and researched courses personalise the feed', () => {
  const posts = [
    post('generic'),
    post('viewed', { universityId: 'kuleuven' }),
    post('keyword', { body: 'Anyone matched Molecular Genetics in their learning agreement?' }),
  ];
  const ranked = rankPosts(posts, {
    ...context,
    signals: [
      { kind: 'view_university', value: 'kuleuven', createdAt: hoursAgo(2) },
      { kind: 'research', value: 'kuleuven', createdAt: hoursAgo(3) },
      { kind: 'course', value: 'Molecular Genetics', createdAt: hoursAgo(5) },
    ],
  });
  assert.equal(ranked[2].post.id, 'generic');
  assert.deepEqual(ranked.find((r) => r.post.id === 'viewed')?.reason, { kind: 'interest', universityId: 'kuleuven' });
  assert.equal(ranked.find((r) => r.post.id === 'keyword')?.reason?.kind, 'keyword');
});

test('old posts fade even when relevant', () => {
  const ranked = rankPosts(
    [post('old-dest', { universityId: 'heidelberg', createdAt: hoursAgo(24 * 60) }), post('fresh')],
    { ...context, signals: [] },
  );
  assert.equal(ranked[0].post.id, 'fresh');
});

const ratings = (count: number, value: number | null): RatingSummary => ({
  count,
  teaching: value,
  professors: value,
  environment: value,
  sustainability: value,
});

test('the UNIVERSE score matches the database view', () => {
  assert.equal(studentScore(ratings(2, 5)), null);
  assert.equal(studentScore(ratings(3, 4)), 75);
  const full = combineScore('heidelberg', 70, 60, ratings(3, 4));
  assert.equal(full.score, 70); // (0.35*70 + 0.25*60 + 0.40*75) = 69.5 -> 70
  assert.equal(full.provisional, false);
  const provisional = combineScore('x', 80, null, ratings(1, 5));
  assert.equal(provisional.score, 80);
  assert.equal(provisional.provisional, true);
  assert.equal(combineScore('y', null, null, ratings(0, null)).score, null);
  assert.equal(isTopRated(full), false);
  assert.equal(isTopRated(combineScore('z', 90, 80, ratings(5, 4.5))), true);
});
