import assert from 'node:assert/strict';
import { test } from 'node:test';

import { jobPlatformLinks, normalizeProfileLink } from './job-links.ts';

test('builds a LinkedIn job search with keywords and location', () => {
  const [linkedin, handshake, jobteaser] = jobPlatformLinks('data analyst', 'Germany');
  assert.equal(linkedin.url, 'https://www.linkedin.com/jobs/search/?keywords=data+analyst&location=Germany');
  assert.equal(handshake.platform, 'handshake');
  assert.equal(jobteaser.platform, 'jobteaser');
  assert.equal(jobPlatformLinks('', '')[0].url, 'https://www.linkedin.com/jobs/search/');
});

test('normalises pasted LinkedIn profile links', () => {
  assert.equal(normalizeProfileLink('linkedin', 'linkedin.com/in/alberto-rossi/'), 'https://www.linkedin.com/in/alberto-rossi');
  assert.equal(normalizeProfileLink('linkedin', 'https://it.linkedin.com/in/alberto'), 'https://www.linkedin.com/in/alberto');
  assert.equal(normalizeProfileLink('linkedin', 'https://www.linkedin.com/company/example'), null);
  assert.equal(normalizeProfileLink('linkedin', 'https://linkedin.com.evil.io/in/x'), null);
  assert.equal(normalizeProfileLink('linkedin', '  '), '');
});

test('accepts Handshake and JobTeaser links only on their domains', () => {
  assert.equal(normalizeProfileLink('handshake', 'app.joinhandshake.com/profiles/abc'), 'https://app.joinhandshake.com/profiles/abc');
  assert.equal(normalizeProfileLink('handshake', 'https://joinhandshake.com.evil.io/x'), null);
  assert.equal(normalizeProfileLink('jobteaser', 'https://www.jobteaser.com/en/users/42/'), 'https://www.jobteaser.com/en/users/42');
});
