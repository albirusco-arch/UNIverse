import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeUrl } from '../_shared/sources.ts';
import { finalizeInsights, type SubmittedInsights } from './schema.ts';

const submitted: SubmittedInsights = {
  summary: 'Strong sustainability commitments.',
  esgScore: 72,
  teachingScore: 64,
  indicators: [
    { pillar: 'environmental', label: 'Net-zero target', value: '2030', sourceIds: [1] },
    { pillar: 'social', label: 'Accessibility service', value: 'Yes', sourceIds: [2] },
    { pillar: 'governance', label: 'Sustainability office', value: 'Yes', sourceIds: [4] },
    { pillar: 'teaching', label: 'Student satisfaction', value: '84%', sourceIds: [3] },
  ],
  clubs: [
    { name: 'ESN Example', category: 'international', description: 'Erasmus section.', website: '', instagram: '', sourceIds: [2] },
    { name: 'Invented Club', category: 'other', description: 'Not on any page.', website: '', instagram: '', sourceIds: [4] },
  ],
  sources: [
    { id: 1, url: 'https://www.uni.example/climate', title: 'Climate plan', kind: 'official_destination', academicYear: '2025' },
    { id: 2, url: 'https://www.uni.example/students', title: 'Student services', kind: 'official_destination', academicYear: '' },
    { id: 3, url: 'https://blog.example.org/ranking', title: 'Blog', kind: 'other', academicYear: '' },
    { id: 4, url: 'https://www.uni.example/never-opened', title: 'Governance', kind: 'official_destination', academicYear: '' },
  ],
};

const retrieved = (...urls: string[]) => new Set(urls.map((u) => normalizeUrl(u) as string));

test('keeps scores only with enough verified evidence', () => {
  const result = finalizeInsights(
    submitted,
    retrieved('https://uni.example/climate', 'https://uni.example/students', 'https://blog.example.org/ranking'),
    new Date('2026-09-26T00:00:00Z'),
  );
  // Two verified ESG indicators (environmental, social) -> ESG score kept.
  assert.equal(result.esgScore, 72);
  // The only teaching indicator comes from a blog -> not verified -> score withheld.
  assert.equal(result.teachingScore, null);
  assert.deepEqual(
    result.indicators.map((i) => i.verified),
    [true, true, false, false],
  );
});

test('withholds the ESG score when fewer than two indicators are verified', () => {
  const result = finalizeInsights(submitted, retrieved('https://uni.example/climate'), new Date());
  assert.equal(result.esgScore, null);
});

test('drops clubs that no retrieved page mentions', () => {
  const result = finalizeInsights(submitted, retrieved('https://uni.example/students'), new Date());
  assert.deepEqual(
    result.clubs.map((c) => [c.name, c.sourceUrl, c.verified]),
    [['ESN Example', 'https://www.uni.example/students', true]],
  );
});
