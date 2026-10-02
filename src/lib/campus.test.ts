import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Buddy } from '../data/types';
import {
  campusFor,
  campusRole,
  filterCampusPeople,
  isPlanLive,
  isTermCurrent,
  onCampusNow,
  PLAN_HOURS_AHEAD,
  planDay,
  planStartOptions,
  upcomingPlans,
} from './campus.ts';

const CBS = 'cbs.dk';
// 2 October 2026, 17:10 local time: the fall 2026 semester.
const now = new Date(2026, 9, 2, 17, 10);

function person(id: string, extra: Partial<Buddy> = {}): Buddy {
  return {
    id,
    displayName: id,
    homeUniversity: '',
    homeUniversityId: null,
    field: null,
    level: null,
    destinationId: null,
    term: null,
    verified: true,
    wavedByMe: false,
    wavedMe: false,
    chatId: null,
    ...extra,
  };
}

test('the campus is the first launch campus among home and destination', () => {
  assert.equal(campusFor({ homeUniversityId: CBS, destinationId: 'unibocconi.it' }, [CBS]), CBS);
  assert.equal(campusFor({ homeUniversityId: 'unimi', destinationId: CBS }, [CBS]), CBS);
  assert.equal(campusFor({ homeUniversityId: 'unimi', destinationId: 'heidelberg' }, [CBS]), null);
  assert.equal(campusFor({ homeUniversityId: null, destinationId: null }, [CBS]), null);
});

test('semesters: spring February–July, fall August–January, in either language', () => {
  assert.equal(isTermCurrent('Fall 2026', now), true);
  assert.equal(isTermCurrent('Autunno 2026', now), true);
  assert.equal(isTermCurrent('Spring 2027', now), false);
  assert.equal(isTermCurrent('Fall 2026', new Date(2027, 0, 20)), true);
  assert.equal(isTermCurrent('Fall 2026', new Date(2027, 1, 1)), false);
  assert.equal(isTermCurrent('Primavera 2027', new Date(2027, 6, 31)), true);
  assert.equal(isTermCurrent('Winter 2026', now), false);
  assert.equal(isTermCurrent(null, now), false);
});

test('locals and incoming students, and who is on campus now', () => {
  const local = person('local', { homeUniversityId: CBS });
  const localAbroad = person('abroad', { homeUniversityId: CBS, destinationId: 'nus', term: 'Fall 2026' });
  const localLeavingLater = person('later', { homeUniversityId: CBS, destinationId: 'nus', term: 'Spring 2027' });
  const incomingNow = person('incoming now', { homeUniversityId: 'hec.fr', destinationId: CBS, term: 'Fall 2026' });
  const incomingLater = person('incoming later', { homeUniversityId: 'unimi', destinationId: CBS, term: 'Spring 2027' });
  const people = [local, localAbroad, localLeavingLater, incomingNow, incomingLater];

  assert.equal(campusRole(local, CBS), 'local');
  assert.equal(campusRole(incomingNow, CBS), 'incoming');
  assert.deepEqual(people.filter((p) => onCampusNow(p, CBS, now)).map((p) => p.id), ['local', 'later', 'incoming now']);
  assert.deepEqual(filterCampusPeople(people, CBS, 'here', now).map((p) => p.id), ['local', 'later', 'incoming now']);
  assert.deepEqual(filterCampusPeople(people, CBS, 'local', now).map((p) => p.id), ['local', 'abroad', 'later']);
  assert.deepEqual(filterCampusPeople(people, CBS, 'incoming', now).map((p) => p.id), ['incoming now', 'incoming later']);
  assert.equal(filterCampusPeople(people, CBS, 'all', now).length, 5);
});

test('plans stay up until 3 hours after they start, next first', () => {
  const at = (hours: number) => ({ startsAt: new Date(now.getTime() + hours * 3600_000).toISOString() });
  assert.equal(isPlanLive(at(-2.9), now), true);
  assert.equal(isPlanLive(at(-3.1), now), false);
  const plans = [{ id: 'later', ...at(5) }, { id: 'gone', ...at(-4) }, { id: 'under way', ...at(-1) }, { id: 'soon', ...at(1) }];
  assert.deepEqual(upcomingPlans(plans, now).map((p) => p.id), ['under way', 'soon', 'later']);
});

test('plan days', () => {
  assert.equal(planDay(new Date(2026, 9, 2, 16, 0).toISOString(), now), 'now');
  assert.equal(planDay(new Date(2026, 9, 2, 19, 0).toISOString(), now), 'today');
  assert.equal(planDay(new Date(2026, 9, 3, 12, 0).toISOString(), now), 'tomorrow');
  assert.equal(planDay(new Date(2026, 9, 5, 12, 0).toISOString(), now), 'later');
});

test('start options: the next quarter hour, then lunch and evening slots within the window', () => {
  const options = planStartOptions(now);
  const labels = options.map((d) => `${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`);
  assert.deepEqual(labels, ['2 17:15', '2 18:00', '2 19:00', '2 20:00', '2 21:00', '2 22:00', '3 12:00', '3 13:00']);
  for (const option of options) {
    assert.ok(option.getTime() >= now.getTime());
    assert.ok(option.getTime() - now.getTime() < PLAN_HOURS_AHEAD * 3600_000);
  }
  // Late at night the evening slots move to the next day.
  const late = planStartOptions(new Date(2026, 9, 2, 23, 50)).map((d) => `${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`);
  assert.deepEqual(late, ['3 0:00', '3 12:00', '3 13:00', '3 18:00', '3 19:00', '3 20:00', '3 21:00', '3 22:00']);
});
