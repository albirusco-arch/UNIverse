import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fakeClient, message, toolUse } from '../_shared/fake-anthropic.ts';
import { platformFor, RequestSchema, type SubmittedResults } from './schema.ts';
import { findOpportunities } from './search.ts';

const request = RequestSchema.parse({
  types: ['internship'],
  keywords: 'bioinformatics, data analysis',
  countries: ['de', 'NL'],
  remote: true,
  startDate: 'March 2027',
  languages: 'English, Italian',
  useCv: true,
  notes: '',
});

const posting = (overrides: Partial<SubmittedResults['opportunities'][number]>) => ({
  title: 'Bioinformatics Intern',
  organization: 'Example Bio GmbH',
  type: 'internship' as const,
  location: 'Heidelberg, Germany',
  remote: false,
  deadline: '31 January 2027',
  startDate: 'March 2027',
  url: 'https://careers.examplebio.de/jobs/123',
  platform: 'company' as const,
  fit: 70,
  reasons: ['Python and lab data experience'],
  requirements: ['Enrolled student'],
  gaps: [],
  sourceIds: [1],
  ...overrides,
});

const results: SubmittedResults = {
  summary: 'Several open internships in Germany and the Netherlands.',
  opportunities: [
    posting({ fit: 90, sourceIds: [3], url: 'https://forum.example.org/post', title: 'Rumoured internship' }),
    posting({}),
    posting({ title: 'Data intern', url: 'https://www.linkedin.com/jobs/view/42', platform: 'company', fit: 80, sourceIds: [2] }),
    posting({ title: 'No link', url: 'not a url', sourceIds: [1] }),
  ],
  organizations: [{ name: 'EMBL', why: 'Strong internship programme.', careersUrl: 'https://www.embl.org/jobs', sourceIds: [4] }],
  tips: ['Apply 4–6 months ahead.'],
  sources: [
    { id: 1, url: 'https://careers.examplebio.de/jobs/123', title: 'Posting', kind: 'employer' },
    { id: 2, url: 'https://www.linkedin.com/jobs/view/42', title: 'LinkedIn posting', kind: 'job_board' },
    { id: 3, url: 'https://forum.example.org/post', title: 'Forum', kind: 'other' },
    { id: 4, url: 'https://www.embl.org/jobs', title: 'EMBL jobs', kind: 'employer' },
  ],
};

const fetched = (url: string) => ({
  type: 'web_fetch_tool_result',
  tool_use_id: 'srv',
  content: { type: 'web_fetch_result', url, retrieved_at: null, content: { type: 'document', source: { type: 'text', media_type: 'text/plain', data: '…' } } },
});

test('validates the search request', () => {
  assert.deepEqual(request.countries, ['DE', 'NL']);
  assert.equal(RequestSchema.safeParse({ ...request, types: [] }).success, false);
  assert.equal(RequestSchema.safeParse({ ...request, countries: ['DE', 'NL', 'FR', 'ES', 'IT', 'PT'] }).success, false);
});

test('detects the platform from the posting link', () => {
  assert.equal(platformFor('https://www.linkedin.com/jobs/view/1', 'company'), 'linkedin');
  assert.equal(platformFor('https://app.joinhandshake.com/jobs/9', 'other'), 'handshake');
  assert.equal(platformFor('https://www.jobteaser.com/en/job-offers/1', 'other'), 'jobteaser');
  assert.equal(platformFor('https://linkedin.com.evil.io/jobs', 'linkedin'), 'other');
  assert.equal(platformFor('https://careers.example.org', 'company'), 'company');
});

test('attaches the CV, keeps only linked postings and verifies the ones it opened', async () => {
  const { client, calls } = fakeClient([
    message([fetched('https://careers.examplebio.de/jobs/123'), fetched('https://www.linkedin.com/jobs/view/42')], 'pause_turn'),
    message([toolUse('submit_results', results)], 'tool_use'),
  ]);
  const now = new Date('2026-09-27T09:00:00Z');
  const student = { field: 'biochemistry', level: 'bachelor', homeUniversity: 'University of Milan', destination: '', countryNames: ['Germany', 'Netherlands'], hasCv: true, now };

  const { report } = await findOpportunities(client, request, student, 'JVBERi0xLjc=');

  const first = calls[0];
  const toolTypes = (first.tools as { type?: string; name: string }[]).map((t) => t.type ?? t.name);
  assert.deepEqual(toolTypes, ['web_search_20260209', 'web_fetch_20260209', 'submit_results']);
  const content = (first.messages as { content: { type: string }[] }[])[0].content;
  assert.equal(content[0].type, 'document');

  // The unlinked posting is dropped; verified postings come first, then by fit.
  assert.deepEqual(
    report.opportunities.map((o) => [o.title, o.verified, o.platform]),
    [
      ['Data intern', true, 'linkedin'],
      ['Bioinformatics Intern', true, 'company'],
      ['Rumoured internship', false, 'company'],
    ],
  );
  // EMBL was never opened in this session.
  assert.equal(report.organizations[0].verified, false);
  assert.equal(report.checkedAt, '2026-09-27T09:00:00.000Z');
});

test('works without a CV', async () => {
  const { client, calls } = fakeClient([message([toolUse('submit_results', { ...results, opportunities: [] })], 'tool_use')]);
  const now = new Date();
  await findOpportunities(client, { ...request, useCv: false }, { field: null, level: null, homeUniversity: '', destination: '', countryNames: [], hasCv: false, now }, null);
  const firstMessage = (calls[0].messages as { content: unknown }[])[0].content;
  assert.equal(typeof firstMessage, 'string');
  assert.match(firstMessage as string, /No CV attached/);
});
