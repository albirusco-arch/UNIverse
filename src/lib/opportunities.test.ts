import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Moment, Opportunity } from '../data/types';
import { applyReaction, isLive, trendingClubs } from './moments.ts';
import { externalSearchUrl, filterOpportunities, NO_OPPORTUNITY_FILTERS } from './opportunities.ts';

const now = new Date('2026-10-01T12:00:00Z');

function opportunity(id: string, overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id,
    kind: 'internship',
    title: 'Marketing intern',
    organization: 'Acme',
    city: 'Milano',
    countryCode: 'IT',
    remote: false,
    field: null,
    url: 'https://example.org/job',
    source: 'linkedin',
    universityId: null,
    clubId: null,
    deadline: null,
    startsAt: null,
    createdAt: '2026-09-20T00:00:00Z',
    verified: true,
    ...overrides,
  };
}

test('filters by kind, source, place, remote and keywords, and hides closed listings', () => {
  const items = [
    opportunity('a'),
    opportunity('b', { kind: 'event', source: 'eventbrite', title: 'Career fair', startsAt: '2026-10-05T09:00:00Z' }),
    opportunity('c', { deadline: '2026-09-30T00:00:00Z' }),
    opportunity('d', { remote: true, city: 'Berlin', countryCode: 'DE', title: 'Data analyst' }),
    opportunity('e', { source: 'student', verified: false }),
  ];
  const ids = (filter: Partial<typeof NO_OPPORTUNITY_FILTERS>) =>
    filterOpportunities(items, { ...NO_OPPORTUNITY_FILTERS, ...filter }, now).map((o) => o.id);

  assert.deepEqual(ids({}), ['b', 'a', 'd', 'e']);
  assert.deepEqual(ids({ kinds: ['event'] }), ['b']);
  assert.deepEqual(ids({ sources: ['student'] }), ['e']);
  assert.deepEqual(ids({ remoteOnly: true }), ['d']);
  assert.deepEqual(ids({ location: 'milano' }), ['b', 'a', 'e']);
  assert.deepEqual(ids({ location: 'de' }), ['d']);
  assert.deepEqual(ids({ query: 'data BERLIN' }), ['d']);
});

test('search links carry the filters to each platform', () => {
  const filter = { ...NO_OPPORTUNITY_FILTERS, query: 'marketing', location: 'Milano', kinds: ['internship' as const] };
  assert.equal(
    externalSearchUrl('linkedin', filter),
    'https://www.linkedin.com/jobs/search/?keywords=marketing&location=Milano&f_E=1',
  );
  assert.equal(externalSearchUrl('handshake', filter), 'https://app.joinhandshake.com/stu/postings?query=marketing+Milano');
  assert.equal(externalSearchUrl('jobteaser', filter, 'it'), 'https://www.jobteaser.com/it/job-offers?q=marketing+Milano');
  assert.equal(externalSearchUrl('eventbrite', { ...filter, location: 'Reggio Emilia' }), 'https://www.eventbrite.com/d/reggio-emilia/marketing/');
  assert.equal(
    externalSearchUrl('linkedin', { ...NO_OPPORTUNITY_FILTERS, kinds: ['part_time'], remoteOnly: true }),
    'https://www.linkedin.com/jobs/search/?keywords=part+time&f_JT=P&f_WT=2',
  );
  assert.equal(externalSearchUrl('eventbrite', NO_OPPORTUNITY_FILTERS), 'https://www.eventbrite.com/d/online/career/');
});

function moment(id: string, clubId: string | null, hoursAgo: number, reactions: Moment['reactions'] = {}): Moment {
  return {
    id,
    author: { id: 'u', displayName: 'U', homeUniversity: '', field: null, destinationId: null, verified: true },
    clubId,
    clubName: clubId,
    universityId: null,
    imageUrl: '',
    caption: '',
    createdAt: new Date(now.getTime() - hoursAgo * 3600_000).toISOString(),
    reactions,
    myReaction: null,
  };
}

test('moments last 24 hours and clubs rank by live activity', () => {
  assert.equal(isLive(moment('x', null, 23), now), true);
  assert.equal(isLive(moment('x', null, 25), now), false);

  const ranked = trendingClubs(
    [
      moment('1', 'esn', 1, { '🔥': 2 }),
      moment('2', 'esn', 3),
      moment('3', 'rowing', 2, { '😍': 9 }),
      moment('4', 'debate', 30, { '🔥': 50 }),
      moment('5', null, 1),
    ],
    now,
  );
  assert.deepEqual(
    ranked.map((c) => [c.clubId, c.moments, c.reactions]),
    [
      ['rowing', 1, 9],
      ['esn', 2, 2],
    ],
  );
});

test('changing a reaction moves the count', () => {
  const first = applyReaction({ reactions: { '🔥': 1 }, myReaction: null }, '🔥');
  assert.deepEqual(first, { reactions: { '🔥': 2 }, myReaction: '🔥' });
  const switched = applyReaction(first, '😂');
  assert.deepEqual(switched, { reactions: { '🔥': 1, '😂': 1 }, myReaction: '😂' });
  assert.deepEqual(applyReaction(switched, null), { reactions: { '🔥': 1, '😂': 0 }, myReaction: null });
});
