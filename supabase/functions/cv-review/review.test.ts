import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fakeClient, message, toolUse } from '../_shared/fake-anthropic.ts';
import { reviewCv } from './review.ts';
import { RequestSchema, type CvReport } from './schema.ts';

const request = RequestSchema.parse({
  targetRole: 'Data analyst intern',
  targetType: 'internship',
  industry: 'Biotech',
  country: 'de',
  jobDescription: '',
  notes: '',
});

const report: CvReport = {
  overallScore: 68,
  summary: 'Solid academic CV; experience bullets need outcomes.',
  headline: 'Biotechnology student with Python and lab data analysis experience',
  strengths: ['Clear education section'],
  improvements: [
    {
      priority: 'high',
      section: 'Experience',
      issue: 'Duties instead of results',
      suggestion: 'Lead with what changed thanks to your work.',
      example: 'Automated plate-reader analysis in Python for a 6-person lab.',
    },
  ],
  atsChecks: [{ check: 'Standard section headings', status: 'pass', detail: 'Education, Experience, Skills.' }],
  keywords: { present: ['Python'], missing: ['SQL'] },
  sectionScores: [{ section: 'Experience', score: 55, comment: 'Add outcomes.' }],
  nextSteps: ['Rewrite the two lab bullets with outcomes.'],
};

test('validates the review request', () => {
  assert.equal(request.country, 'DE');
  assert.equal(RequestSchema.safeParse({ ...request, targetRole: 'x' }).success, false);
  assert.equal(RequestSchema.safeParse({ ...request, targetType: 'astronaut' }).success, false);
  assert.equal(RequestSchema.safeParse({ ...request, country: 'Germany' }).success, false);
});

test('sends the CV as a PDF document, without web tools, and returns the review', async () => {
  const { client, calls } = fakeClient([message([toolUse('submit_review', report)], 'tool_use')]);
  const student = { field: 'biochemistry', level: 'bachelor', homeUniversity: 'University of Milan', countryName: 'Germany' };

  const result = await reviewCv(client, 'JVBERi0xLjc=', request, student, { now: new Date('2026-09-27T09:00:00Z') });

  const params = calls[0];
  assert.equal(params.model, 'claude-opus-5');
  assert.deepEqual((params.tools as { name: string }[]).map((t) => t.name), ['submit_review']);
  const content = (params.messages as { content: { type: string; source?: { media_type: string } }[] }[])[0].content;
  assert.equal(content[0].type, 'document');
  assert.equal(content[0].source?.media_type, 'application/pdf');
  assert.equal(content[1].type, 'text');
  assert.match((content[1] as unknown as { text: string }).text, /Data analyst intern[\s\S]*Germany/);
  assert.equal(result.report.overallScore, 68);
  assert.equal(result.report.checkedAt, '2026-09-27T09:00:00.000Z');
});

test('rejects invented scores outside 0–100 and asks again', async () => {
  const { client, calls } = fakeClient([
    message([toolUse('submit_review', { ...report, overallScore: 140 }, 'toolu_bad')], 'tool_use'),
    message([toolUse('submit_review', report, 'toolu_good')], 'tool_use'),
  ]);
  const result = await reviewCv(client, 'JVBERi0xLjc=', request, {
    field: null,
    level: null,
    homeUniversity: '',
    countryName: '',
  });
  assert.equal(calls.length, 2);
  assert.equal(result.report.overallScore, 68);
});
