import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Buddy, Profile } from '../data/types';
import { connection, filterBuddies, matchReasons, parseTerm, rankBuddies, termKey } from './buddies.ts';

const viewer: Pick<Profile, 'term' | 'field' | 'level'> = { term: 'Spring 2027', field: 'business', level: 'bachelor' };

function buddy(id: string, extra: Partial<Buddy> = {}): Buddy {
  return {
    id,
    displayName: id,
    homeUniversity: '',
    homeUniversityId: null,
    field: null,
    level: null,
    destinationId: 'cbs.dk',
    term: null,
    verified: true,
    wavedByMe: false,
    wavedMe: false,
    chatId: null,
    ...extra,
  };
}

test('connection follows the waves in both directions', () => {
  assert.equal(connection(buddy('a')), 'none');
  assert.equal(connection(buddy('a', { wavedByMe: true })), 'waved');
  assert.equal(connection(buddy('a', { wavedMe: true })), 'incoming');
  assert.equal(connection(buddy('a', { wavedByMe: true, wavedMe: true })), 'connected');
});

test('semesters compare across languages', () => {
  assert.deepEqual(parseTerm('Primavera 2027'), { season: 'spring', year: 2027 });
  assert.deepEqual(parseTerm(' Fall 2026 '), { season: 'fall', year: 2026 });
  assert.equal(parseTerm('Winter 2026'), null);
  assert.equal(termKey('Spring 2027'), termKey('primavera 2027'));
  assert.equal(termKey('Autunno 2026'), '2026-fall');
  assert.equal(termKey('Winter 2026'), 'winter 2026');
  assert.equal(termKey(''), null);
  assert.equal(termKey(null), null);
  assert.deepEqual(matchReasons(buddy('a', { term: 'Primavera 2027' }), viewer), ['term']);
});

test('match reasons need the same value on both sides', () => {
  assert.deepEqual(matchReasons(buddy('a', { term: 'Spring 2027', field: 'business', level: 'bachelor' }), viewer), ['term', 'field', 'level']);
  assert.deepEqual(matchReasons(buddy('a', { term: 'Fall 2027', field: 'law', level: 'master' }), viewer), []);
  assert.deepEqual(matchReasons(buddy('a'), { term: null, field: null, level: null }), []);
  // "Other" is not a shared field.
  assert.deepEqual(matchReasons(buddy('a', { field: 'other' }), { ...viewer, field: 'other' }), []);
});

test('waves waiting for an answer come first, then the closest matches', () => {
  const ranked = rankBuddies(
    [
      buddy('field+level', { field: 'business', level: 'bachelor' }),
      buddy('nothing'),
      buddy('term', { term: 'Spring 2027' }),
      buddy('waved at me', { wavedMe: true }),
      buddy('all', { term: 'Spring 2027', field: 'business', level: 'bachelor' }),
      buddy('connected', { wavedMe: true, wavedByMe: true }),
    ],
    viewer,
  );
  assert.deepEqual(
    ranked.map((b) => b.id),
    ['waved at me', 'all', 'term', 'field+level', 'connected', 'nothing'],
  );
});

test('filters keep the matching students', () => {
  const list = [
    buddy('a', { term: 'Spring 2027' }),
    buddy('b', { field: 'business', wavedMe: true }),
    buddy('c', { level: 'bachelor', wavedMe: true, wavedByMe: true }),
  ];
  assert.equal(filterBuddies(list, viewer, 'all').length, 3);
  assert.deepEqual(filterBuddies(list, viewer, 'term').map((b) => b.id), ['a']);
  assert.deepEqual(filterBuddies(list, viewer, 'field').map((b) => b.id), ['b']);
  assert.deepEqual(filterBuddies(list, viewer, 'level').map((b) => b.id), ['c']);
  assert.deepEqual(filterBuddies(list, viewer, 'waves').map((b) => b.id), ['b']);
});
