import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Partnership, Region, University } from '../data/types';
import { destinationRank } from './destination-order.ts';
import { FIELD_ISCED, iscedOverlap, subjectCoverage } from './isced.ts';
import { filterOptions, NO_FILTERS, searchPartners, trustRank } from './partner-search.ts';

function university(id: string, countryCode: string, region: Region, name = id): University {
  return { id, name, city: '', country: countryCode, countryCode, region, website: '', emailDomains: [], erasmusCode: null, erasmus: region === 'europe', featured: false, kind: 'university', verified: false };
}

const catalogue = new Map(
  [
    university('heidelberg', 'DE', 'europe', 'Heidelberg University'),
    university('ucl', 'GB', 'uk', 'University College London'),
    university('toronto', 'CA', 'north_america', 'University of Toronto'),
    university('melbourne', 'AU', 'oceania', 'University of Melbourne'),
    university('nus', 'SG', 'asia', 'National University of Singapore'),
    university('berkeley', 'US', 'north_america', 'UC Berkeley'),
    university('uva', 'NL', 'europe', 'University of Amsterdam'),
  ].map((u) => [u.id, u]),
);
const lookup = (id: string) => catalogue.get(id);

function agreement(partner: string, overrides: Partial<Partnership> = {}): Partnership {
  return {
    id: `p-${partner}`,
    homeUniversityId: 'unimi',
    partnerUniversityId: partner,
    agreementType: 'erasmus',
    homeDepartment: null,
    iscedCodes: [],
    levels: [],
    languages: [],
    languageLevel: '',
    places: null,
    academicYear: '2026/27',
    source: 'admin',
    sourceUrl: 'https://www.unimi.it/partners',
    verified: true,
    lastVerified: '2026-09-01',
    ...overrides,
  };
}

const bio = { id: 'dept-bio', name: 'Biosciences' };
const econ = { id: 'dept-econ', name: 'Economics' };
const list = [
  agreement('berkeley', { agreementType: 'bilateral', languages: ['en'] }),
  agreement('nus', { agreementType: 'bilateral', languages: ['en'], iscedCodes: ['061'] }),
  agreement('melbourne', { agreementType: 'bilateral', languages: ['en'] }),
  agreement('toronto', { agreementType: 'bilateral', languages: ['en', 'fr'] }),
  agreement('ucl', { languages: ['en'], source: 'ai', verified: false }),
  agreement('heidelberg', { homeDepartment: bio, iscedCodes: ['051'], languages: ['de', 'en'], languageLevel: 'B2' }),
  agreement('uva', { homeDepartment: econ, iscedCodes: ['041', '0311'], languages: ['en'], source: 'student', verified: false }),
];

test('destinations are ordered Europe, Canada, Australia, others, United States', () => {
  const order = ['berkeley', 'nus', 'melbourne', 'toronto', 'ucl', 'heidelberg']
    .map((id) => catalogue.get(id)!)
    .sort((a, b) => destinationRank(a) - destinationRank(b))
    .map((u) => u.countryCode);
  assert.deepEqual(order, ['GB', 'DE', 'CA', 'AU', 'SG', 'US']);
});

test('ISCED codes overlap by prefix; agreements without subjects are open to all', () => {
  assert.equal(iscedOverlap('04', '0413'), true);
  assert.equal(iscedOverlap('051', '0512'), true);
  assert.equal(iscedOverlap('051', '052'), false);
  assert.equal(subjectCoverage([], ['051']), 'open');
  assert.equal(subjectCoverage(['05'], FIELD_ISCED.biochemistry), 'match');
  assert.equal(subjectCoverage(['041'], FIELD_ISCED.biochemistry), 'none');
  assert.equal(subjectCoverage(['041'], []), 'match');
});

test('without filters: verified agreements first, then Europe-first, US last', () => {
  const ids = searchPartners(list, NO_FILTERS, lookup).map((r) => r.university.id);
  assert.deepEqual(ids, ['heidelberg', 'toronto', 'melbourne', 'nus', 'berkeley', 'ucl', 'uva']);
  assert.equal(trustRank(list[4]), 1); // read from the official list, not yet confirmed
  assert.equal(trustRank(list[6]), 2); // suggested by a student
});

test('the student department comes first; other departments only when the subject matches', () => {
  const results = searchPartners(list, { ...NO_FILTERS, departmentId: bio.id, subjects: ['051'] }, lookup);
  assert.equal(results[0].university.id, 'heidelberg');
  assert.equal(results[0].fit, 'department');
  assert.equal(results.some((r) => r.university.id === 'uva'), false); // economics agreement
  assert.equal(results.some((r) => r.university.id === 'nus'), false); // computing only
  assert.equal(results.find((r) => r.university.id === 'toronto')?.fit, 'open');
});

test('a field of study keeps matching agreements and open ones', () => {
  const ids = searchPartners(list, { ...NO_FILTERS, subjects: FIELD_ISCED.business }, lookup).map((r) => [r.university.id, r.fit]);
  assert.deepEqual(ids[0], ['uva', 'subject']);
  assert.equal(ids.some(([id]) => id === 'heidelberg' || id === 'nus'), false);
});

test('destination, agreement type and language filters', () => {
  const only = (filters: Partial<typeof NO_FILTERS>) => searchPartners(list, { ...NO_FILTERS, ...filters }, lookup).map((r) => r.university.id);
  assert.deepEqual(only({ region: 'europe' }), ['heidelberg', 'uva']);
  assert.deepEqual(only({ country: 'GB' }), ['ucl']);
  assert.deepEqual(only({ agreement: 'erasmus' }), ['heidelberg', 'ucl', 'uva']);
  assert.deepEqual(only({ language: 'de' }), ['heidelberg']);
  assert.deepEqual(only({ language: 'fr', agreement: 'bilateral' }), ['toronto']);
});

test('filter chips list the countries (Europe first) and languages present', () => {
  const options = filterOptions(list, lookup);
  assert.deepEqual(options.countries, ['DE', 'GB', 'NL', 'CA', 'AU', 'SG', 'US']);
  assert.deepEqual(options.languages, ['en', 'de', 'fr']);
});
