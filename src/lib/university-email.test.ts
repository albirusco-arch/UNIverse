import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createEmailMatcher } from './university-email.ts';

const matcher = createEmailMatcher([
  { id: 'unimi', emailDomains: ['unimi.it', 'studenti.unimi.it'] },
  { id: 'bocconi', emailDomains: ['unibocconi.it', 'studbocconi.it'] },
  { id: 'heidelberg', emailDomains: ['uni-heidelberg.de'] },
]);

test('matches university domains and their subdomains', () => {
  assert.equal(matcher.match('giulia.rossi@studenti.unimi.it')?.id, 'unimi');
  assert.equal(matcher.match('x@stud.uni-heidelberg.de')?.id, 'heidelberg');
  assert.equal(matcher.match('A.B@StudBocconi.it')?.id, 'bocconi');
  assert.equal(matcher.match('someone@gmail.com'), null);
});

test('allows catalogue domains and academic top-level domains only', () => {
  assert.equal(matcher.isAllowed('giulia@studenti.unimi.it'), true);
  assert.equal(matcher.isAllowed('student@uci.edu'), true);
  assert.equal(matcher.isAllowed('student@cs.ucl.ac.uk'), true);
  assert.equal(matcher.isAllowed('student@student.unimelb.edu.au'), true);
  assert.equal(matcher.isAllowed('someone@gmail.com'), false);
  assert.equal(matcher.isAllowed('someone@education.com'), false);
  assert.equal(matcher.isAllowed('not-an-email'), false);
  assert.equal(matcher.isAllowed('spoof@unimi.it.evil.com'), false);
});
