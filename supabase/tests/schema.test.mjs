// Applies every migration and the seed to an in-memory Postgres (PGlite) with a
// minimal stand-in for Supabase's auth schema, roles and realtime publication,
// then checks the behaviour the app relies on: university-email sign-up, RLS,
// triggers, scores, clubs, groups, tokens and the career tools.
// Usage: npm run test:db (part of npm test)
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const supabaseDir = new URL('..', import.meta.url).pathname;
const db = new PGlite();

await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create publication supabase_realtime;
  create schema storage;
  create table storage.buckets (
    id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id),
    name text not null, owner uuid, unique (bucket_id, name)
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  grant usage on schema storage to anon, authenticated, service_role;
  grant all on storage.objects to authenticated, service_role;
  grant execute on function storage.foldername(text) to authenticated, service_role;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`);

const migrations = readdirSync(`${supabaseDir}/migrations`).filter((f) => f.endsWith('.sql')).sort();
for (const file of [...migrations.map((f) => `migrations/${f}`), 'seed.sql']) {
  try {
    await db.exec(readFileSync(`${supabaseDir}/${file}`, 'utf8'));
  } catch (error) {
    console.error(`Failed to apply ${file}:`, error.message);
    process.exit(1);
  }
}
const universityCount = (await db.query('select count(*)::int as n from public.universities')).rows[0].n;
console.log(`✓ ${migrations.length} migrations and the seed applied (${universityCount} universities)`);

const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const [A, B, C, D, E, R] = [1, 2, 3, 4, 5, 6].map(uid);

async function as(user, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ''}', false); set role ${user ? 'authenticated' : 'anon'};`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role;');
  }
}
const count = async (user, sql, params) => (await as(user, sql, params)).rows[0].n;

/** Runs as the edge functions do (service role, bypassing RLS). */
async function service(sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); set role service_role;`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role;');
  }
}

// ---------------------------------------------------------------------------
// University email only

const signUp = (id, email) => db.query('insert into auth.users (id, email) values ($1, $2)', [id, email]);
await assert.rejects(signUp(uid(99), 'someone@gmail.com'), /university email/);
await assert.rejects(signUp(uid(98), 'spoof@unimi.it.evil.com'), /university email/);
await signUp(A, 'alberto@studenti.unimi.it');
await signUp(B, 'lena@stud.uni-heidelberg.de');
await signUp(C, 'sam@cs.ucl.ac.uk');
await signUp(D, 'kim@smallcollege.edu');
await db.exec(`insert into public.email_allowlist (value, note) values ('reviewer@example.com', 'App Store review')`);
await signUp(R, 'reviewer@example.com');
await signUp(E, 'eve@studbocconi.it');
const profiles = await db.query('select id, verified, home_university_id, home_university from public.profiles order by id');
assert.deepEqual(
  profiles.rows.map((p) => [p.verified, p.home_university_id]),
  [
    [true, 'unimi'],
    [true, 'heidelberg'],
    [true, 'ucl'],
    [true, null],
    [true, 'unibocconi.it'],
    [false, null],
  ],
);
assert.equal(profiles.rows[0].home_university, 'University of Milan');
assert.equal((await as(null, `select public.is_university_email('x@gmail.com') as ok`)).rows[0].ok, false);
assert.equal((await as(null, `select public.is_university_email('x@student.uva.nl') as ok`)).rows[0].ok, true);
console.log('✓ only university emails can sign up; profiles are linked to the university of the email');

// ---------------------------------------------------------------------------
// Profiles

await as(A, `update public.profiles set display_name = 'Alberto R.', destination_id = 'heidelberg' where id = $1`, [A]);
await as(B, `update public.profiles set display_name = 'Lena M.', destination_id = 'unimi' where id = $1`, [B]);
await assert.rejects(as(A, `update public.profiles set verified = true where id = $1`, [A]));
assert.equal((await as(A, `update public.profiles set display_name = 'x' where id = $1 returning id`, [B])).rows.length, 0);
assert.equal(await count(null, 'select count(*)::int as n from public.profiles'), 0);
console.log('✓ profiles: own row only, never the verified flag, hidden from signed-out users');

// ---------------------------------------------------------------------------
// Community

const postId = (
  await as(A, `insert into public.posts (author_id, topic, body, university_id, field) values ($1, 'experience', 'Learning agreement approved!', 'heidelberg', 'biochemistry') returning id`, [A])
).rows[0].id;
await assert.rejects(as(A, `insert into public.posts (author_id, topic, body) values ($1, 'tip', 'Impersonating someone else')`, [B]));
await as(B, 'insert into public.post_likes (post_id, user_id) values ($1, $2)', [postId, B]);
await as(C, 'insert into public.post_likes (post_id, user_id) values ($1, $2) on conflict do nothing', [postId, C]);
await as(C, 'insert into public.post_likes (post_id, user_id) values ($1, $2) on conflict do nothing', [postId, C]);
await as(B, `insert into public.comments (post_id, author_id, body) values ($1, $2, 'Congrats!')`, [postId, B]);
const feed = await as(B, 'select like_count, comment_count, liked_by_me, author_name from public.post_feed where id = $1', [postId]);
assert.deepEqual(feed.rows[0], { like_count: 2, comment_count: 1, liked_by_me: true, author_name: 'Alberto R.' });
assert.equal(await count(null, 'select count(*)::int as n from public.posts'), 0);
console.log('✓ posts, likes, comments and counters; the community is for signed-in students only');

await as(D, 'insert into public.blocks (blocker_id, blocked_id) values ($1, $2)', [D, A]);
assert.equal(await count(D, 'select count(*)::int as n from public.post_feed'), 0);
assert.equal(await count(C, 'select count(*)::int as n from public.post_feed'), 1);
for (const reporter of [B, C, D]) {
  await as(reporter, `insert into public.reports (reporter_id, target_type, target_id, reason) values ($1, 'post', $2, 'spam') on conflict do nothing`, [reporter, postId]);
}
await as(D, `insert into public.reports (reporter_id, target_type, target_id, reason) values ($1, 'post', $2, 'spam') on conflict do nothing`, [D, postId]);
assert.equal(await count(C, 'select count(*)::int as n from public.post_feed'), 0);
assert.equal((await db.query('select report_count from public.posts where id = $1', [postId])).rows[0].report_count, 3);
console.log('✓ blocking hides content for the blocker; 3 reports hide a post for everyone');

await as(A, `insert into public.equivalences (submitted_by, home_university, home_course, home_ects, destination_id, destination_course, destination_ects, approved, academic_year) values ($1, 'University of Milan', 'Biochemistry II', 6, 'heidelberg', 'Molecular Biochemistry', 6, true, '2025/26')`, [A]);
assert.deepEqual(
  (await as(C, 'select home_ects, destination_course from public.equivalence_feed')).rows[0],
  { home_ects: 6, destination_course: 'Molecular Biochemistry' },
);
assert.deepEqual(
  (await as(C, `select members, equivalences from public.university_stats where university_id = 'heidelberg'`)).rows[0],
  { members: 1, equivalences: 1 },
);
console.log('✓ equivalences and university stats');

// ---------------------------------------------------------------------------
// Research requests and signals are private

await assert.rejects(as(A, `insert into public.research_requests (user_id, kind, request, request_hash) values ($1, 'visa', '{}', 'h')`, [A]));
await db.query(`insert into public.research_requests (user_id, kind, request, request_hash, status) values ($1, 'visa', '{}', 'h', 'running')`, [A]);
assert.equal(await count(A, 'select count(*)::int as n from public.research_requests'), 1);
assert.equal(await count(B, 'select count(*)::int as n from public.research_requests'), 0);
await as(A, `insert into public.user_signals (user_id, kind, value) values ($1, 'search', 'heidelberg')`, [A]);
await assert.rejects(as(A, `insert into public.user_signals (user_id, kind, value) values ($1, 'search', 'x')`, [B]));
assert.equal(await count(B, 'select count(*)::int as n from public.user_signals'), 0);
console.log('✓ research requests are written by the backend only; research and signals are private');

// ---------------------------------------------------------------------------
// Ratings, insights and the UNIVERSE score

const rate = (user, t, p, e, s) =>
  as(user, `insert into public.university_ratings (university_id, user_id, teaching, professors, environment, sustainability, relation, academic_year)
            values ('heidelberg', $1, $2, $3, $4, $5, 'exchange', '2025/26')
            on conflict (university_id, user_id) do update set teaching = excluded.teaching, professors = excluded.professors,
              environment = excluded.environment, sustainability = excluded.sustainability`, [user, t, p, e, s]);
await rate(A, 5, 5, 5, 5);
await rate(C, 3, 3, 3, 3);
let score = (await as(C, `select * from public.university_scores where university_id = 'heidelberg'`)).rows[0];
assert.equal(score.rating_count, 2);
assert.equal(score.provisional, true);
assert.equal(score.student_score, null);
assert.equal(score.score, null);
await rate(D, 4, 4, 4, 4);
await rate(C, 3, 3, 3, 3); // editing a rating does not add a new one
await assert.rejects(as(C, `insert into public.university_ratings (university_id, user_id, teaching, professors, environment, sustainability, relation, academic_year) values ('heidelberg', $1, 6, 1, 1, 1, 'exchange', '2025/26')`, [B]));
assert.equal(await count(C, 'select count(*)::int as n from public.university_ratings'), 1);
await db.exec(`insert into public.university_insights (university_id, status, esg_score, teaching_score) values ('heidelberg', 'done', 70, 60)`);
await assert.rejects(as(A, `update public.university_insights set esg_score = 100`).then((r) => {
  if (r.affectedRows === 0) throw new Error('no rows');
}));
score = (await as(C, `select * from public.university_scores where university_id = 'heidelberg'`)).rows[0];
assert.equal(score.rating_count, 3);
assert.equal(score.provisional, false);
assert.equal(score.student_score, 75); // average 4/5 -> 75/100
assert.equal(score.score, 70); // 0.35*70 + 0.25*60 + 0.40*75 = 69.5, rounded half up
console.log('✓ ratings are private, one per student; the UNIVERSE score combines ESG, teaching and students');

// ---------------------------------------------------------------------------
// Clubs

const clubId = (
  await as(B, `insert into public.clubs (university_id, name, category, created_by) values ('heidelberg', 'ESN Heidelberg', 'international', $1) returning id`, [B])
).rows[0].id;
await assert.rejects(as(B, `insert into public.clubs (university_id, name, created_by, verified) values ('heidelberg', 'Fake verified', $1, true)`, [B]));
await assert.rejects(as(B, `insert into public.clubs (university_id, name, created_by, source) values ('heidelberg', 'Fake AI', $1, 'ai')`, [B]));
await assert.rejects(as(C, `insert into public.clubs (university_id, name, created_by) values ('heidelberg', 'esn heidelberg', $1)`, [C]));
console.log('✓ students suggest clubs (unverified, no duplicates)');

// ---------------------------------------------------------------------------
// Groups and channels

const createGroup = (user, name, kind, visibility) =>
  as(user, `select public.create_group($1, 'desc', $2, $3, 'heidelberg') as id`, [name, kind, visibility]).then((r) => r.rows[0].id);

const publicGroup = await createGroup(A, 'Heidelberg Erasmus 2027', 'group', 'public');
const privateGroup = await createGroup(A, 'Flatmates', 'group', 'private');
const channel = await createGroup(A, 'Heidelberg news', 'channel', 'public');
await assert.rejects(as(A, `insert into public.groups (name, created_by) values ('Direct insert', $1)`, [A]));

assert.equal(await count(C, 'select count(*)::int as n from public.groups where id = $1', [privateGroup]), 0);
await as(C, 'insert into public.group_members (group_id, user_id) values ($1, $2)', [publicGroup, C]);
await assert.rejects(as(C, 'insert into public.group_members (group_id, user_id) values ($1, $2)', [privateGroup, C]));
await assert.rejects(as(C, `insert into public.group_members (group_id, user_id, role) values ($1, $2, 'admin')`, [channel, C]));
const code = (await as(A, 'select invite_code from public.group_directory where id = $1', [privateGroup])).rows[0].invite_code;
assert.match(code, /^[0-9A-F]{8}$/);
assert.notEqual((await as(C, 'select invite_code from public.group_directory where id = $1', [publicGroup])).rows[0].invite_code, null);
assert.equal((await as(B, 'select invite_code from public.group_directory where id = $1', [publicGroup])).rows[0].invite_code, null);
assert.equal((await as(C, 'select public.join_group_with_code($1) as id', [code.toLowerCase()])).rows[0].id, privateGroup);
await assert.rejects(as(C, `select public.join_group_with_code('NOPE1234')`), /Invalid invite code/);

await as(A, `insert into public.group_messages (group_id, author_id, body) values ($1, $2, 'Welcome!')`, [publicGroup, A]);
await as(A, `insert into public.group_messages (group_id, author_id, body) values ($1, $2, 'Who else arrives in October?')`, [publicGroup, A]);
await assert.rejects(as(B, `insert into public.group_messages (group_id, author_id, body) values ($1, $2, 'Not a member')`, [publicGroup, B]));
assert.equal(await count(B, 'select count(*)::int as n from public.group_messages'), 0);
let row = (await as(C, 'select member_count, unread_count, last_message_preview, my_role from public.group_directory where id = $1', [publicGroup])).rows[0];
assert.deepEqual(row, { member_count: 2, unread_count: 2, last_message_preview: 'Who else arrives in October?', my_role: 'member' });
await as(C, 'select public.mark_group_read($1)', [publicGroup]);
assert.equal((await as(C, 'select unread_count from public.group_directory where id = $1', [publicGroup])).rows[0].unread_count, 0);

await as(C, 'insert into public.group_members (group_id, user_id) values ($1, $2)', [channel, C]);
await assert.rejects(as(C, `insert into public.group_messages (group_id, author_id, body) values ($1, $2, 'Members cannot post in channels')`, [channel, C]));
await as(A, `insert into public.group_messages (group_id, author_id, body) values ($1, $2, 'Orientation week starts Monday')`, [channel, A]);
assert.equal(await count(C, 'select count(*)::int as n from public.group_message_feed where group_id = $1', [channel]), 1);
await as(C, 'delete from public.group_members where group_id = $1 and user_id = $2', [channel, C]);
assert.equal(await count(C, 'select count(*)::int as n from public.group_messages where group_id = $1', [channel]), 0);
console.log('✓ groups: public/private, invite codes, admin-only channels, unread counts, leave');

const clubChat = (await as(C, 'select public.club_group($1) as id', [clubId])).rows[0].id;
assert.equal((await as(D, 'select public.club_group($1) as id', [clubId])).rows[0].id, clubChat);
assert.equal((await as(D, 'select group_id from public.club_list where id = $1', [clubId])).rows[0].group_id, clubChat);
assert.equal((await as(D, 'select member_count from public.group_directory where id = $1', [clubChat])).rows[0].member_count, 2);
console.log('✓ each club gets one chat, created on first use');

// ---------------------------------------------------------------------------
// Tokens

const balance = async (user) => (await as(user, 'select public.my_token_balance() as n')).rows[0].n;
assert.equal(await balance(A), 3, 'welcome tokens');
assert.equal(await count(A, 'select count(*)::int as n from public.token_products'), 3);
assert.equal(await count(null, 'select count(*)::int as n from public.token_products'), 0);
await assert.rejects(as(A, `insert into public.token_ledger (user_id, delta, reason) values ($1, 1000, 'grant')`, [A]));
await assert.rejects(as(A, `select public.grant_purchase($1, 'universe_tokens_100', 'forged', 'PRODUCTION')`, [A]));
await assert.rejects(as(A, `select public.spend_tokens($1, 'cv_review', gen_random_uuid())`, [B]));

const grant = async (user, product, tx) =>
  (await service('select public.grant_purchase($1, $2, $3, $4) as n', [user, product, tx, 'PRODUCTION'])).rows[0].n;
assert.equal(await grant(A, 'universe_tokens_10', 'tx-1'), 10);
assert.equal(await grant(A, 'universe_tokens_10', 'tx-1'), 0, 'the same transaction is credited once');
assert.equal(await grant(A, 'unknown_product', 'tx-2'), 0);
assert.equal(await balance(A), 13);

const job1 = '10000000-0000-0000-0000-000000000001';
const job2 = '10000000-0000-0000-0000-000000000002';
const spend = async (user, feature, job) => (await service('select public.spend_tokens($1, $2, $3) as n', [user, feature, job])).rows[0].n;
assert.equal(await spend(A, 'opportunity_match', job1), 10);
assert.equal(await spend(A, 'cv_review', job2), 8);
await service('select public.refund_spend($1)', [job2]);
await service('select public.refund_spend($1)', [job2]);
assert.equal(await balance(A), 10, 'a failed job is refunded once');
assert.equal(await spend(B, 'opportunity_match', uid(700)), 0);
await assert.rejects(spend(B, 'cv_review', uid(701)), /insufficient_tokens/);
await assert.rejects(spend(B, 'no_such_feature', uid(702)), /unknown_feature/);

assert.equal((await service(`select public.refund_purchase('tx-1') as n`)).rows[0].n, 1);
assert.equal((await service(`select public.refund_purchase('tx-1') as n`)).rows[0].n, 0);
assert.equal(await balance(A), 0);
await assert.rejects(spend(A, 'cv_review', uid(703)), /insufficient_tokens/);
assert.equal((await service(`select public.reverse_refund('tx-1') as n`)).rows[0].n, 1);
assert.equal(await balance(A), 10);
assert.equal(await count(B, 'select count(*)::int as n from public.token_ledger where user_id = $1', [A]), 0);
assert.equal(await count(A, 'select count(*)::int as n from public.token_ledger'), 7);
console.log('✓ tokens: welcome bonus, purchases credited once, spends checked and refunded, refunds reversed; the ledger is private and read-only');

// ---------------------------------------------------------------------------
// Career: CV files, AI jobs, saved opportunities, links

await as(A, `insert into storage.objects (bucket_id, name, owner) values ('cvs', $1, $2)`, [`${A}/cv.pdf`, A]);
await assert.rejects(as(A, `insert into storage.objects (bucket_id, name, owner) values ('cvs', $1, $2)`, [`${B}/cv.pdf`, A]));
assert.equal(await count(B, 'select count(*)::int as n from storage.objects'), 0);
assert.equal(await count(A, 'select count(*)::int as n from storage.objects'), 1);
await as(A, `insert into public.cv_files (user_id, path, file_name, size_bytes) values ($1, $2, 'CV Alberto.pdf', 120000)`, [A, `${A}/cv.pdf`]);
await assert.rejects(as(B, `insert into public.cv_files (user_id, path, file_name, size_bytes) values ($1, $2, 'x.pdf', 10)`, [B, `${A}/cv.pdf`]));
assert.equal(await count(B, 'select count(*)::int as n from public.cv_files'), 0);

await assert.rejects(as(A, `insert into public.cv_reviews (user_id, request) values ($1, '{}')`, [A]));
await service(`insert into public.cv_reviews (user_id, request, status) values ($1, '{"targetRole":"Data analyst"}', 'running')`, [A]);
await service(`insert into public.opportunity_searches (user_id, request, status) values ($1, '{}', 'running')`, [A]);
assert.equal(await count(A, 'select count(*)::int as n from public.cv_reviews'), 1);
assert.equal(await count(B, 'select count(*)::int as n from public.cv_reviews'), 0);
assert.equal(await count(B, 'select count(*)::int as n from public.opportunity_searches'), 0);

await as(A, `insert into public.saved_opportunities (user_id, url, opportunity) values ($1, 'https://careers.example.org/1', '{"title":"Intern"}')`, [A]);
await assert.rejects(as(A, `insert into public.saved_opportunities (user_id, url, opportunity) values ($1, 'javascript:alert(1)', '{}')`, [A]));
assert.equal(await count(B, 'select count(*)::int as n from public.saved_opportunities'), 0);

await as(A, `update public.profiles set linkedin_url = 'https://www.linkedin.com/in/alberto-rossi', open_to_opportunities = true where id = $1`, [A]);
await assert.rejects(as(A, `update public.profiles set linkedin_url = 'https://evil.example/in/x' where id = $1`, [A]));
await assert.rejects(as(A, `update public.profiles set handshake_url = 'https://joinhandshake.com.evil.io/x' where id = $1`, [A]));
await as(A, `update public.profiles set handshake_url = 'https://app.joinhandshake.com/profiles/abc', jobteaser_url = 'https://www.jobteaser.com/en/users/42' where id = $1`, [A]);
assert.equal((await as(B, 'select linkedin_url from public.profiles where id = $1', [A])).rows[0].linkedin_url, 'https://www.linkedin.com/in/alberto-rossi');
console.log('✓ career: CV files private per student, AI jobs written by the backend only, saved opportunities, validated profile links');

// ---------------------------------------------------------------------------
// Account deletion cascades everything

await db.exec(`delete from auth.users where id = '${A}'`);
for (const [table, column] of [
  ['profiles', 'id'],
  ['posts', 'author_id'],
  ['equivalences', 'submitted_by'],
  ['research_requests', 'user_id'],
  ['university_ratings', 'user_id'],
  ['user_signals', 'user_id'],
  ['group_members', 'user_id'],
  ['group_messages', 'author_id'],
  ['token_ledger', 'user_id'],
  ['cv_files', 'user_id'],
  ['cv_reviews', 'user_id'],
  ['opportunity_searches', 'user_id'],
  ['saved_opportunities', 'user_id'],
]) {
  const left = await db.query(`select count(*)::int as n from public.${table} where ${column} = $1`, [A]);
  assert.equal(left.rows[0].n, 0, table);
}
console.log('✓ deleting the auth user removes all of their data');
console.log('ALL DATABASE CHECKS PASSED');
