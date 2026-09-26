// Applies the migration and seed to an in-memory Postgres (PGlite) with a minimal
// stand-in for Supabase's auth schema and roles, then checks RLS and triggers.
// Usage: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const repo = new URL('../..', import.meta.url).pathname;
const db = new PGlite();

// Minimal stand-in for the Supabase platform: roles, auth schema, default grants.
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`);

for (const file of ['migrations/20260926000000_init.sql', 'seed.sql']) {
  try {
    await db.exec(readFileSync(`${repo}/supabase/${file}`, 'utf8'));
  } catch (error) {
    console.error(`Failed to apply ${file}:`, error.message);
    process.exit(1);
  }
}
console.log('migration + seed applied');

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const C = '00000000-0000-0000-0000-00000000000c';
const D = '00000000-0000-0000-0000-00000000000d';
await db.exec(`
  insert into auth.users (id, email) values
    ('${A}', 'alberto@studenti.unimi.it'),
    ('${B}', 'someone@gmail.com'),
    ('${C}', 'c@uni-heidelberg.de'),
    ('${D}', 'd@stud.uni-heidelberg.de');
`);
const verified = await db.query(`select id, verified from public.profiles order by id`);
assert.deepEqual(verified.rows.map((r) => r.verified), [true, false, true, true]);
console.log('✓ profiles created on sign-up, verified by university email domain');

async function as(user, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ''}', false); set role ${user ? 'authenticated' : 'anon'};`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role;');
  }
}

// Profile updates: allowed columns only, own row only.
await as(A, `update public.profiles set display_name = 'Alberto R.', destination_id = 'heidelberg' where id = $1`, [A]);
await assert.rejects(as(A, `update public.profiles set verified = true where id = $1`, [A]));
const other = await as(A, `update public.profiles set display_name = 'hacked' where id = $1 returning id`, [B]);
assert.equal(other.rows.length, 0);
console.log('✓ users edit only their own profile and never the verified flag');

// Posts, likes, comments and counters.
const post = await as(A, `insert into public.posts (author_id, topic, body, university_id, field) values ($1, 'experience', 'Learning agreement approved!', 'heidelberg', 'biochemistry') returning id`, [A]);
const postId = post.rows[0].id;
await assert.rejects(as(A, `insert into public.posts (author_id, topic, body) values ($1, 'tip', 'Impersonating someone else')`, [B]));
await assert.rejects(as(null, `insert into public.posts (author_id, topic, body) values ($1, 'tip', 'Anonymous posting attempt')`, [A]));
await as(B, `insert into public.post_likes (post_id, user_id) values ($1, $2)`, [postId, B]);
await as(C, `insert into public.post_likes (post_id, user_id) values ($1, $2)`, [postId, C]);
await as(B, `insert into public.comments (post_id, author_id, body) values ($1, $2, 'Congrats!')`, [postId, B]);
let feed = await as(B, `select like_count, comment_count, liked_by_me, author_name, author_verified from public.post_feed where id = $1`, [postId]);
assert.deepEqual(feed.rows[0], { like_count: 2, comment_count: 1, liked_by_me: true, author_name: 'Alberto R.', author_verified: true });
await as(B, `delete from public.post_likes where post_id = $1 and user_id = $2`, [postId, B]);
feed = await as(B, `select like_count, liked_by_me from public.post_feed where id = $1`, [postId]);
assert.deepEqual(feed.rows[0], { like_count: 1, liked_by_me: false });
const anonFeed = await as(null, `select count(*)::int as n from public.post_feed`);
assert.equal(anonFeed.rows[0].n, 1);
console.log('✓ posting, likes, comments, counters and the anonymous feed work');

// Blocking hides the blocked author's content for the blocker only.
await as(B, `insert into public.blocks (blocker_id, blocked_id) values ($1, $2)`, [B, A]);
assert.equal((await as(B, `select count(*)::int as n from public.post_feed`)).rows[0].n, 0);
assert.equal((await as(C, `select count(*)::int as n from public.post_feed`)).rows[0].n, 1);
console.log('✓ blocking hides content for the blocker');

// Three distinct reports hide a post for everyone.
for (const reporter of [B, C, D]) {
  await as(reporter, `insert into public.reports (reporter_id, target_type, target_id, reason) values ($1, 'post', $2, 'spam')`, [reporter, postId]);
}
await assert.rejects(as(C, `insert into public.reports (reporter_id, target_type, target_id, reason) values ($1, 'post', $2, 'spam')`, [C, postId]));
assert.equal((await as(C, `select count(*)::int as n from public.post_feed`)).rows[0].n, 0);
assert.equal((await as(null, `select count(*)::int as n from public.posts`)).rows[0].n, 0);
console.log('✓ 3 reports auto-hide a post; duplicate reports are rejected');

// The app writes likes, saves, blocks and reports with ON CONFLICT DO NOTHING
// (supabase-js ignoreDuplicates), which must work with INSERT-only policies.
await as(C, `insert into public.reports (reporter_id, target_type, target_id, reason) values ($1, 'post', $2, 'spam') on conflict (reporter_id, target_type, target_id) do nothing`, [C, postId]);
await as(B, `insert into public.blocks (blocker_id, blocked_id) values ($1, $2) on conflict do nothing`, [B, A]);
await as(C, `insert into public.saved_universities (user_id, university_id) values ($1, 'heidelberg') on conflict do nothing`, [C]);
await as(C, `insert into public.saved_universities (user_id, university_id) values ($1, 'heidelberg') on conflict do nothing`, [C]);
const reportCount = await db.query(`select report_count from public.posts where id = $1`, [postId]);
assert.equal(reportCount.rows[0].report_count, 3);
console.log('✓ repeated likes/saves/blocks/reports are idempotent and do not double count');

// Equivalences and stats.
await as(A, `insert into public.equivalences (submitted_by, home_university, home_course, home_ects, destination_id, destination_course, destination_ects, approved, academic_year) values ($1, 'University of Milan', 'Biochemistry II', 6, 'heidelberg', 'Molecular Biochemistry', 6, true, '2025/26')`, [A]);
const eq = await as(null, `select home_ects, destination_course, author_name from public.equivalence_feed`);
assert.deepEqual(eq.rows[0], { home_ects: 6, destination_course: 'Molecular Biochemistry', author_name: 'Alberto R.' });
const stats = await as(null, `select members, equivalences from public.university_stats where university_id = 'heidelberg'`);
assert.deepEqual(stats.rows[0], { members: 1, equivalences: 1 });
console.log('✓ equivalences feed and university stats');

// Course matches: users read their own, only the service role writes.
await assert.rejects(as(A, `insert into public.course_matches (user_id, request, request_hash) values ($1, '{}', 'h')`, [A]));
await db.exec(`insert into public.course_matches (user_id, request, request_hash, status) values ('${A}', '{}', 'h', 'running')`);
assert.equal((await as(A, `select count(*)::int as n from public.course_matches`)).rows[0].n, 1);
assert.equal((await as(B, `select count(*)::int as n from public.course_matches`)).rows[0].n, 0);
console.log('✓ course matches are private and written only by the backend');

// Saved universities.
await as(A, `insert into public.saved_universities (user_id, university_id) values ($1, 'heidelberg')`, [A]);
assert.equal((await as(B, `select count(*)::int as n from public.saved_universities`)).rows[0].n, 0);
console.log('✓ saved universities are private');

// Account deletion cascades everything.
await db.exec(`delete from auth.users where id = '${A}'`);
for (const table of ['profiles', 'posts', 'equivalences', 'course_matches', 'saved_universities', 'blocks']) {
  const column = { profiles: 'id', posts: 'author_id', equivalences: 'submitted_by', course_matches: 'user_id', saved_universities: 'user_id', blocks: 'blocked_id' }[table];
  const left = await db.query(`select count(*)::int as n from public.${table} where ${column} = $1`, [A]);
  assert.equal(left.rows[0].n, 0, table);
}
console.log('✓ deleting the auth user removes all of their data');
console.log('ALL MIGRATION CHECKS PASSED');
