import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildUserPrompt } from './prompt.ts';
import { RequestSchema } from './schema.ts';

const base = {
  kind: 'exchange',
  homeUniversity: 'University of Milan',
  program: '',
  level: 'bachelor',
  field: null,
  destinationId: null,
  destinationName: '',
  destinationCountry: '',
  citizenship: '',
  qualification: '',
  studyType: 'exchange',
  term: '',
  durationMonths: null,
  courses: [],
  notes: '',
};

test('each research kind requires its own fields', () => {
  assert.equal(RequestSchema.safeParse(base).success, false);
  assert.equal(
    RequestSchema.safeParse({ ...base, destinationId: 'heidelberg', courses: [{ name: 'Genetics', ects: 6 }] }).success,
    true,
  );
  assert.equal(RequestSchema.safeParse({ ...base, kind: 'admission', destinationId: 'ucl' }).success, false);
  assert.equal(RequestSchema.safeParse({ ...base, kind: 'admission', destinationId: 'ucl', program: 'MSc Data Science' }).success, true);
  assert.equal(RequestSchema.safeParse({ ...base, kind: 'visa', citizenship: 'it' }).success, false);
  const visa = RequestSchema.safeParse({ ...base, kind: 'visa', citizenship: 'it', destinationCountry: 'us', studyType: 'degree' });
  assert.equal(visa.success, true);
  assert.equal(visa.success && visa.data.citizenship, 'IT');
  assert.equal(RequestSchema.safeParse({ ...base, kind: 'scholarships', destinationCountry: 'JP' }).success, true);
});

test('prompts carry the task for the requested kind', () => {
  const parsed = RequestSchema.parse({ ...base, kind: 'visa', citizenship: 'IT', destinationCountry: 'US', studyType: 'degree', durationMonths: 24 });
  const prompt = buildUserPrompt(parsed, {
    destinationWebsite: null,
    destinationCountryName: 'United States',
    citizenshipName: 'Italy',
    now: new Date('2026-09-26T00:00:00Z'),
  });
  assert.match(prompt, /Task: student visa/);
  assert.match(prompt, /Citizenship: Italy/);
  assert.match(prompt, /Destination country: United States/);
  assert.match(prompt, /Duration: 24 months/);
  assert.doesNotMatch(prompt, /Courses the student needs to cover/);
});
