import assert from 'node:assert/strict';
import { test } from 'node:test';

import { listFrom, looksLikeClaudeKey, parseCliJson, projectRef, publicKey, rowCount, withEnv } from './backend-setup.mjs';

test('reads JSON printed between CLI notices', () => {
  assert.deepEqual(parseCliJson('A new version is available\n[{"id":"abc"}]\n'), [{ id: 'abc' }]);
  assert.equal(parseCliJson('Access token not provided.'), null);
  assert.deepEqual(listFrom({ projects: [{ id: 'abc' }] }), [{ id: 'abc' }]);
  assert.deepEqual(listFrom(null), []);
});

test('uses the project ref, falling back to the id', () => {
  assert.equal(projectRef({ id: 'abcdefghijklmnopqrst' }), 'abcdefghijklmnopqrst');
  assert.equal(projectRef({ id: 'x', ref: 'abcdefghijklmnopqrst' }), 'abcdefghijklmnopqrst');
});

test('picks the anon key, or the publishable key on newer projects', () => {
  assert.equal(
    publicKey([
      { name: 'service_role', api_key: 'secret' },
      { name: 'anon', api_key: 'eyJanon' },
    ]),
    'eyJanon',
  );
  assert.equal(publicKey([{ name: 'default', type: 'publishable', api_key: 'sb_publishable_x' }]), 'sb_publishable_x');
  assert.equal(publicKey([{ name: 'service_role', api_key: 'secret' }]), null);
});

test('fills .env values without touching the other lines', () => {
  const example = '# Supabase\nEXPO_PUBLIC_SUPABASE_URL=\nEXPO_PUBLIC_SUPABASE_ANON_KEY=\nEXPO_PUBLIC_SUPPORT_EMAIL=help@example.com\n';
  assert.equal(
    withEnv(example, { EXPO_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'k$1' }),
    '# Supabase\nEXPO_PUBLIC_SUPABASE_URL=https://abc.supabase.co\nEXPO_PUBLIC_SUPABASE_ANON_KEY=k$1\nEXPO_PUBLIC_SUPPORT_EMAIL=help@example.com\n',
  );
  assert.equal(withEnv('A=1', { B: '2' }), 'A=1\nB=2\n');
});

test('recognises Claude keys and placeholders', () => {
  assert.ok(looksLikeClaudeKey(`sk-ant-api03-${'a1_B-'.repeat(10)}`));
  assert.ok(!looksLikeClaudeKey('sk-ant-la_nuova_chiave'));
  assert.ok(!looksLikeClaudeKey('paste-your-key-here'));
});

test('reads the row count from Content-Range', () => {
  assert.equal(rowCount('0-0/10269'), 10269);
  assert.equal(rowCount('*/0'), 0);
  assert.equal(rowCount('0-0/*'), null);
  assert.equal(rowCount(null), null);
});
