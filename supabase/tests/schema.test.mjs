// Applies every migration and the seed to an in-memory Postgres (PGlite) with a
// minimal stand-in for Supabase's auth schema, roles and realtime publication,
// then checks the behaviour the app relies on: university-email sign-up, RLS,
// triggers, scores, clubs and groups.
// Usage: npm run test:db (part of npm test)
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

import { agreementsSql, createResolver, readAgreements } from '../../scripts/lib/partnerships-csv.mjs';

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

// Catalogue: Europe-first curated entries with their type; nothing is marked verified yet.
const catalogueCheck = (await db.query(
  `select id, kind, verified from public.universities
   where id in ('cbs.dk', 'unibocconi.it', 'barcelonagse.eu', 'hec.fr', 'essec.edu', 'escp.eu', 'novasbe.unl.pt', 'london.edu', 'oxford.ac.uk', 'tum')
   order by id`,
)).rows;
assert.equal(catalogueCheck.length, 10);
assert.deepEqual(
  catalogueCheck.filter((u) => u.kind === 'business_school').map((u) => u.id),
  ['barcelonagse.eu', 'cbs.dk', 'escp.eu', 'essec.edu', 'hec.fr', 'london.edu', 'novasbe.unl.pt', 'unibocconi.it'],
);
assert.equal((await db.query('select count(*)::int as n from public.universities where verified')).rows[0].n, 0);
for (const [email, id] of [
  ['anna@london.edu', 'london.edu'],
  ['marc@edu.escp.eu', 'escp.eu'],
  ['jo@student.maastrichtuniversity.nl', 'unimaas.nl'],
  ['li@bse.eu', 'barcelonagse.eu'],
  ['sam@student.cbs.dk', 'cbs.dk'],
]) {
  assert.equal((await db.query('select public.university_for_email($1) as id', [email])).rows[0].id, id, email);
}
const catalogueDepartments = (await db.query(
  `select count(*)::int as n, bool_and(source = 'catalogue' and not verified) as unverified from public.departments where university_id = 'tum'`,
)).rows[0];
assert.deepEqual(catalogueDepartments, { n: 7, unverified: true });
console.log('✓ catalogue: business schools typed, new schools recognised at sign-in, curated departments unverified');

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
// Ratings, insights and the UNIverse score

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
console.log('✓ ratings are private, one per student; the UNIverse score combines ESG, teaching and students');

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
// Guests (signed out): the catalogue and general university information only

await db.query(
  `insert into public.clubs (university_id, name, category, source, source_url, verified)
   values ('heidelberg', 'Heidelberg Rowing Club', 'sports', 'ai', 'https://www.uni-heidelberg.de/sport', true)`,
);
assert.ok((await count(null, 'select count(*)::int as n from public.universities')) > 10000);
assert.ok((await count(null, 'select count(*)::int as n from public.countries')) > 100);
assert.equal(await count(null, `select count(*)::int as n from public.university_scores where university_id = 'heidelberg'`), 1);
await as(null, 'select * from public.university_insights');
// Student-suggested clubs (and their chats) need an account; official-page clubs are general information.
assert.deepEqual(
  (await as(null, `select name, group_id from public.club_list where university_id = 'heidelberg'`)).rows,
  [{ name: 'Heidelberg Rowing Club', group_id: null }],
);
for (const relation of [
  'profiles',
  'posts',
  'comments',
  'post_likes',
  'equivalences',
  'university_ratings',
  'saved_universities',
  'user_signals',
  'research_requests',
  'groups',
  'group_members',
  'group_messages',
  'post_feed',
  'equivalence_feed',
  'university_stats',
  'group_directory',
]) {
  assert.equal(await count(null, `select count(*)::int as n from public.${relation}`), 0, `guests must not read ${relation}`);
}
await assert.rejects(as(null, `insert into public.posts (author_id, topic, body) values ($1, 'question', 'A guest question')`, [A]));
await assert.rejects(as(null, `insert into public.comments (post_id, author_id, body) values ($1, $2, 'Guest comment')`, [postId, A]));
await assert.rejects(as(null, `insert into public.saved_universities (user_id, university_id) values ($1, 'ucl')`, [A]));
await assert.rejects(
  as(null, `insert into public.equivalences (submitted_by, home_university, home_course, home_ects, destination_id, destination_course, destination_ects, approved, academic_year)
            values ($1, 'University of Milan', 'Genetics', 6, 'heidelberg', 'Genetics', 6, true, '2025/26')`, [A]),
);
await assert.rejects(
  as(null, `insert into public.university_ratings (university_id, user_id, teaching, professors, environment, sustainability, relation, academic_year)
            values ('ucl', $1, 5, 5, 5, 5, 'exchange', '2025/26')`, [A]),
);
await assert.rejects(as(null, `insert into public.clubs (university_id, name) values ('ucl', 'Guest club')`));
await assert.rejects(as(null, `select public.create_group('Guest group', '', 'group', 'public', null)`));
console.log('✓ guests read the catalogue, insights, scores and official-page clubs; student content and every write need an account');

// ---------------------------------------------------------------------------
// Partnerships, departments and courses (written by the backend; students suggest)

const official = 'https://www.unimi.it/en/international/study-abroad/erasmus-partners';
const [biosciences] = (
  await db.query(
    `insert into public.departments (university_id, name, kind, isced_codes, source, source_url, verified, last_verified)
     values ('unimi', 'Department of Biosciences', 'department', '{051}', 'admin', $1, true, '2026-09-01') returning id`,
    [official],
  )
).rows;
const agreement = (home, partner, type, extra = {}) =>
  db.query(
    `insert into public.partnerships (home_university_id, partner_university_id, agreement_type, home_department_id, isced_codes, languages, source, source_url, verified, last_verified, hidden)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
    [home, partner, type, extra.department ?? null, extra.isced ?? '{}', extra.languages ?? '{}', extra.source ?? 'admin', extra.url ?? official, extra.verified ?? true, extra.checked ?? '2026-09-01', extra.hidden ?? false],
  );
await agreement('unimi', 'heidelberg', 'erasmus', { department: biosciences.id, isced: '{051,0512}', languages: '{de,en}' });
await agreement('unimi', 'ucl', 'erasmus', { source: 'ai', verified: false, languages: '{en}' });
await agreement('unimi', 'unibocconi.it', 'other', { hidden: true });
await assert.rejects(agreement('unimi', 'heidelberg', 'erasmus', { department: biosciences.id }), /duplicate key/);
await assert.rejects(agreement('ucl', 'heidelberg', 'erasmus', { department: biosciences.id }), /foreign key/); // not a UCL department
await assert.rejects(agreement('unimi', 'unimi', 'bilateral'), /check/);
await assert.rejects(agreement('unimi', 'ucl', 'bilateral', { isced: '{4a}' }), /check/);
await assert.rejects(agreement('unimi', 'ucl', 'bilateral', { languages: '{eng}' }), /check/);
await assert.rejects(agreement('unimi', 'ucl', 'bilateral', { url: 'ftp://unimi.it/list' }), /check/);

// Students suggest agreements of their own home university only, unverified and with the official link.
const suggest = (user, home, partner, extra = {}) =>
  as(user,
    `insert into public.partnerships (home_university_id, partner_university_id, agreement_type, source, source_url, verified, created_by)
     values ($1, $2, 'bilateral', $3, $4, $5, $6)`,
    [home, partner, extra.source ?? 'student', extra.url ?? 'https://www.unimi.it/en/overseas', extra.verified ?? false, extra.as ?? user],
  );
await suggest(A, 'unimi', 'ucl');
await assert.rejects(suggest(A, 'ucl', 'unimi'), /row-level security/); // not A's university
await assert.rejects(suggest(A, 'unimi', 'heidelberg', { verified: true }), /row-level security/);
await assert.rejects(suggest(A, 'unimi', 'heidelberg', { source: 'admin' }), /row-level security/);
await assert.rejects(suggest(A, 'unimi', 'heidelberg', { as: B }), /row-level security/);
await assert.rejects(suggest(A, 'unimi', 'heidelberg', { url: 'not a link' }), /check/);
await as(A, `update public.partnerships set verified = true where source = 'student'`);
await as(A, `delete from public.partnerships`);
assert.equal((await db.query(`select count(*)::int as n from public.partnerships where source = 'student' and not verified`)).rows[0].n, 1);
assert.equal((await db.query('select count(*)::int as n from public.partnerships')).rows[0].n, 4);

// Guests see agreements from official lists; students also see suggestions; hidden rows nobody.
const visible = async (user) =>
  (await as(user, `select partner_university_id as p, agreement_type as t, source, home_department_name as d from public.partner_list where home_university_id = 'unimi' order by 1, 2, 3`)).rows;
assert.deepEqual(await visible(null), [
  { p: 'heidelberg', t: 'erasmus', source: 'admin', d: 'Department of Biosciences' },
  { p: 'ucl', t: 'erasmus', source: 'ai', d: null },
]);
assert.equal((await visible(C)).length, 3);
assert.equal(await count(null, `select count(*)::int as n from public.departments where university_id = 'unimi'`), 1);
await assert.rejects(as(A, `insert into public.departments (university_id, name, source, source_url) values ('unimi', 'Fake', 'admin', $1)`, [official]));
await db.query(
  `insert into public.courses (university_id, department_id, code, title, ects, level, language, term, isced_code, source, source_url)
   values ('unimi', $1, 'B12', 'Biochemistry II', 6, 'bachelor', 'it', 'spring', '0512', 'admin', $2)`,
  [biosciences.id, official],
);
assert.equal(await count(null, `select count(*)::int as n from public.courses where department_id = $1`, [biosciences.id]), 1);
await assert.rejects(as(A, `insert into public.courses (university_id, title, source, source_url) values ('unimi', 'Fake course', 'admin', $1)`, [official]));
await assert.rejects(
  db.query(`insert into public.courses (university_id, department_id, title, source, source_url) values ('ucl', $1, 'Wrong department', 'admin', $2)`, [biosciences.id, official]),
  /foreign key/,
);
await db.query(`insert into public.partner_extractions (university_id, status, found, matched) values ('unimi', 'done', 40, 37)`);
assert.equal(await count(null, 'select count(*)::int as n from public.partner_extractions'), 0);
assert.equal(await count(A, 'select count(*)::int as n from public.partner_extractions'), 1);
await assert.rejects(as(A, `insert into public.partner_extractions (university_id) values ('ucl')`));
// Removing a department keeps its agreements, now university-wide.
await db.query('delete from public.departments where id = $1', [biosciences.id]);
assert.equal(
  (await db.query(`select home_department_id, home_university_id from public.partnerships where partner_university_id = 'heidelberg'`)).rows[0].home_university_id,
  'unimi',
);
assert.equal((await db.query(`select count(*)::int as n from public.courses where department_id is null and title = 'Biochemistry II'`)).rows[0].n, 1);
console.log('✓ partnerships: official sources, departments of the home university, student suggestions unverified, guests see official lists');

// The admin import (scripts/import-partnerships.mjs) produces SQL that runs and can be re-run.
const catalogueRows = JSON.parse(readFileSync(new URL('../../src/data/universities.json', import.meta.url), 'utf8'));
const imported = readAgreements(
  `home_university,partner_university,agreement_type,department,isced_codes,languages,places,academic_year,source_url
unimi,uni-heidelberg.de,erasmus,Dipartimento d'Informatica,061,de;en,2,2026/27,${official}
unimi,ucl,other,,,en,,2026/27,${official}`,
  createResolver(catalogueRows),
);
assert.deepEqual(imported.errors, []);
const importSql = agreementsSql(imported.agreements, { today: '2026-09-27', origin: 'test.csv' });
await db.exec(importSql);
await db.exec(importSql);
const importedRows = (
  await db.query(
    `select a.partner_university_id as p, a.agreement_type as t, a.source, a.verified, a.last_verified::text as checked, d.name as department
     from public.partnerships a left join public.departments d on d.id = a.home_department_id
     where a.home_university_id = 'unimi' and a.last_verified = '2026-09-27' order by 1, 2`,
  )
).rows;
assert.deepEqual(importedRows, [
  { p: 'heidelberg', t: 'erasmus', source: 'admin', verified: true, checked: '2026-09-27', department: "Dipartimento d'Informatica" },
  { p: 'ucl', t: 'other', source: 'admin', verified: true, checked: '2026-09-27', department: null },
]);
console.log('✓ admin import SQL runs, confirms agreements and can be re-run');

// ---------------------------------------------------------------------------
// Opportunities and moments

await db.exec(`insert into public.opportunities (kind, title, organization, url, source, verified)
  values ('internship', 'Imported internship', 'Acme', 'https://example.org/imported', 'linkedin', true)`);
const sharedId = (
  await as(B, `insert into public.opportunities (kind, title, organization, url, created_by) values ('event', 'Career night', 'ESN', 'https://example.org/night', $1) returning id`, [B])
).rows[0].id;
await assert.rejects(as(B, `insert into public.opportunities (kind, title, organization, url, created_by, verified) values ('event', 'Fake verified', 'X', 'https://example.org/fake', $1, true)`, [B]));
await assert.rejects(as(B, `insert into public.opportunities (kind, title, organization, url, created_by, source) values ('event', 'Fake LinkedIn', 'X', 'https://example.org/fake2', $1, 'linkedin')`, [B]));
await assert.rejects(as(B, `insert into public.opportunities (kind, title, organization, url, created_by) values ('event', 'No https', 'X', 'http://example.org', $1)`, [B]));
assert.equal(await count(null, 'select count(*)::int as n from public.opportunities'), 1);
assert.equal(await count(C, 'select count(*)::int as n from public.opportunities'), 2);
for (const reporter of [A, C, D]) {
  await as(reporter, `insert into public.reports (reporter_id, target_type, target_id, reason) values ($1, 'opportunity', $2, 'spam')`, [reporter, sharedId]);
}
assert.equal(await count(C, 'select count(*)::int as n from public.opportunities'), 1);
console.log('✓ opportunities: guests see verified listings, students share links (unverified), 3 reports hide one');

const momentId = (
  await as(B, `insert into public.moments (author_id, club_id, university_id, image_path, caption) values ($1, $2, 'ucl', $3, 'Buddy dinner') returning id, university_id`, [B, clubId, `${B}/1.jpg`])
).rows[0];
assert.equal(momentId.university_id, 'heidelberg');
await assert.rejects(as(B, `insert into public.moments (author_id, image_path) values ($1, $2)`, [B, `${C}/stolen.jpg`]));
await assert.rejects(as(C, `insert into public.moments (author_id, image_path) values ($1, $2)`, [B, `${B}/2.jpg`]));
await as(C, `insert into public.moment_reactions (moment_id, user_id, emoji) values ($1, $2, '🔥')`, [momentId.id, C]);
await as(D, `insert into public.moment_reactions (moment_id, user_id, emoji) values ($1, $2, '🔥')`, [momentId.id, D]);
await as(D, `insert into public.moment_reactions (moment_id, user_id, emoji) values ($1, $2, '😂') on conflict (moment_id, user_id) do update set emoji = excluded.emoji`, [momentId.id, D]);
await assert.rejects(as(D, `insert into public.moment_reactions (moment_id, user_id, emoji) values ($1, $2, '🔥')`, [momentId.id, C]));
await assert.rejects(as(C, `insert into public.moment_reactions (moment_id, user_id, emoji) values ($1, $2, '💩') on conflict (moment_id, user_id) do update set emoji = excluded.emoji`, [momentId.id, C]));
const momentFeed = (await as(D, 'select club_name, reactions, my_reaction, author_name from public.moment_feed where id = $1', [momentId.id])).rows[0];
assert.deepEqual(momentFeed, { club_name: 'ESN Heidelberg', reactions: { '🔥': 1, '😂': 1 }, my_reaction: '😂', author_name: 'Lena M.' });
assert.equal(await count(null, 'select count(*)::int as n from public.moments'), 0);
await db.exec(`update public.moments set created_at = now() - interval '25 hours' where id = '${momentId.id}'`);
assert.equal(await count(C, 'select count(*)::int as n from public.moment_feed'), 0);
for (let i = 0; i < 10; i++) {
  await as(C, `insert into public.moments (author_id, image_path) values ($1, $2)`, [C, `${C}/${i}.jpg`]);
}
await assert.rejects(as(C, `insert into public.moments (author_id, image_path) values ($1, $2)`, [C, `${C}/11.jpg`]), /moment_limit/);
console.log('✓ moments: own folder only, club university enforced, one reaction each, gone after 24 hours, 10 a day');

// ---------------------------------------------------------------------------
// Travel buddies: visible students going to the same destination wave, then chat

const [F, G, H] = [7, 8, 9].map(uid);
await signUp(F, 'fede@studenti.unimi.it');
await signUp(G, 'gio@studbocconi.it');
await signUp(H, 'hana@stud.uni-heidelberg.de');
const plan = (user, name, term) =>
  as(user, `update public.profiles set display_name = $2, destination_id = 'cbs.dk', term = $3 where id = $1`, [user, name, term]);
const makeVisible = (user) => as(user, 'update public.profiles set discoverable = true where id = $1', [user]);
const wave = (from, to) => as(from, 'insert into public.waves (from_id, to_id) values ($1, $2)', [from, to]);
await plan(F, 'Fede', 'Spring 2027');
await plan(G, 'Gio', 'Primavera 2027'); // the same semester, saved in Italian
await plan(H, 'Hana', 'Fall 2027');

// Opt-in and reciprocal: hidden students see counts only and cannot wave or be waved at.
await makeVisible(G);
await makeVisible(H);
assert.deepEqual((await as(F, 'select * from public.travel_buddy_count()')).rows[0], { total: 2, same_term: 1 });
assert.equal(await count(F, 'select count(*)::int as n from public.travel_buddies'), 0);
await assert.rejects(wave(F, G), /row-level security/);
await assert.rejects(wave(G, F), /row-level security/);
await makeVisible(F);
assert.deepEqual(
  (await as(F, 'select display_name, term, waved_by_me, waved_me, chat_id from public.travel_buddies order by display_name')).rows,
  [
    { display_name: 'Gio', term: 'Primavera 2027', waved_by_me: false, waved_me: false, chat_id: null },
    { display_name: 'Hana', term: 'Fall 2027', waved_by_me: false, waved_me: false, chat_id: null },
  ],
);
// Students going somewhere else are not listed and cannot wave.
await makeVisible(B);
assert.equal(await count(F, 'select count(*)::int as n from public.travel_buddies where id = $1', [B]), 0);
await assert.rejects(wave(B, F), /row-level security/);

// Waves: one per direction, as yourself, private to the pair, never taken back.
await wave(F, G);
await assert.rejects(wave(F, G), /duplicate key/);
await assert.rejects(as(F, 'insert into public.waves (from_id, to_id) values ($1, $2)', [H, G]), /row-level security/);
await as(F, 'delete from public.waves');
assert.equal((await db.query('select count(*)::int as n from public.waves')).rows[0].n, 1);
assert.deepEqual((await as(G, 'select waved_by_me, waved_me from public.travel_buddies where id = $1', [F])).rows[0], { waved_by_me: false, waved_me: true });
assert.equal(await count(H, 'select count(*)::int as n from public.waves'), 0);

// A direct chat opens only once both have waved, and stays between the two.
await assert.rejects(as(F, 'select public.open_direct_chat($1)', [G]), /not_connected/);
await wave(G, F);
const dm = (await as(F, 'select public.open_direct_chat($1) as id', [G])).rows[0].id;
assert.equal((await as(G, 'select public.open_direct_chat($1) as id', [F])).rows[0].id, dm);
assert.equal((await as(G, 'select chat_id from public.travel_buddies where id = $1', [F])).rows[0].chat_id, dm);
await as(F, `insert into public.group_messages (group_id, author_id, body) values ($1, $2, 'Ciao! CBS in spring too?')`, [dm, F]);
assert.deepEqual(
  (await as(G, 'select name, description, kind, visibility, my_role, invite_code, unread_count, member_count, peer_id from public.group_directory where id = $1', [dm])).rows[0],
  { name: 'Fede', description: 'University of Milan', kind: 'direct', visibility: 'private', my_role: 'member', invite_code: null, unread_count: 1, member_count: 2, peer_id: F },
);
assert.equal(await count(H, 'select count(*)::int as n from public.group_directory where id = $1', [dm]), 0);
assert.equal(await count(H, 'select count(*)::int as n from public.group_messages where group_id = $1', [dm]), 0);
const dmCode = (await db.query('select invite_code from public.groups where id = $1', [dm])).rows[0].invite_code;
await assert.rejects(as(H, 'select public.join_group_with_code($1)', [dmCode]), /Invalid invite code/);
await assert.rejects(as(H, 'insert into public.group_members (group_id, user_id) values ($1, $2)', [dm, H]));
await assert.rejects(as(H, `select public.create_group('Fake direct', '', 'direct', 'private', null)`), /groups_direct_check/);
await assert.rejects(as(H, 'insert into public.direct_chats (group_id, user_low, user_high) values ($1, $2, $3)', [dm, F, H]));
await as(F, `update public.groups set name = 'Renamed' where id = $1`, [dm]);
assert.equal((await db.query('select name from public.groups where id = $1', [dm])).rows[0].name, 'Direct chat');

// At most 30 waves a day.
const fans = Array.from({ length: 30 }, (_, i) => uid(100 + i));
for (const [i, id] of fans.entries()) await signUp(id, `fan${i}@studenti.unimi.it`);
await db.query('insert into public.waves (from_id, to_id) select $1, unnest($2::uuid[])', [H, fans]);
await assert.rejects(wave(H, F), /wave_limit/);

// Guests see nothing.
assert.equal(await count(null, 'select count(*)::int as n from public.waves'), 0);
assert.equal(await count(null, 'select count(*)::int as n from public.direct_chats'), 0);
assert.equal(await count(null, 'select count(*)::int as n from public.travel_buddies'), 0);
assert.deepEqual((await as(null, 'select * from public.travel_buddy_count()')).rows[0], { total: 0, same_term: 0 });

// Blocking hides the student and the chat, and stops messages.
await as(G, 'insert into public.blocks (blocker_id, blocked_id) values ($1, $2)', [G, F]);
assert.equal(await count(F, 'select count(*)::int as n from public.travel_buddies where id = $1', [G]), 0);
assert.equal(await count(F, 'select count(*)::int as n from public.group_directory where id = $1', [dm]), 0);
assert.equal(await count(G, 'select count(*)::int as n from public.group_directory where id = $1', [dm]), 0);
await assert.rejects(as(F, `insert into public.group_messages (group_id, author_id, body) values ($1, $2, 'Still there?')`, [dm, F]));
await assert.rejects(as(F, 'select public.open_direct_chat($1)', [G]), /not_connected/);
assert.deepEqual((await as(F, 'select * from public.travel_buddy_count()')).rows[0], { total: 1, same_term: 0 });

// Deleting an account removes its waves and direct chats.
await db.exec(`delete from auth.users where id = '${F}'`);
assert.equal((await db.query('select count(*)::int as n from public.groups where id = $1', [dm])).rows[0].n, 0);
assert.equal((await db.query('select count(*)::int as n from public.waves where from_id = $1 or to_id = $1', [F])).rows[0].n, 0);
assert.deepEqual(
  (await db.query(`select public.term_key('Spring 2027') a, public.term_key(' primavera 2027') b, public.term_key('Autunno 2026') c, public.term_key('Fall 2026') d, public.term_key('Winter 2026') e, public.term_key('') f`)).rows[0],
  { a: '2027-spring', b: '2027-spring', c: '2026-fall', d: '2026-fall', e: 'winter 2026', f: null },
);
console.log('✓ travel buddies: opt-in and reciprocal, same destination, waves, direct chats after mutual waves, 30 a day, blocks');

// ---------------------------------------------------------------------------
// Launch campus (CBS): its students and those going there meet, and make plans

const [K, L] = [10, 11].map(uid);
await signUp(K, 'kasper@student.cbs.dk');
await signUp(L, 'liv@student.cbs.dk');
assert.equal((await db.query('select home_university_id from public.profiles where id = $1', [K])).rows[0].home_university_id, 'cbs.dk');
assert.deepEqual((await as(null, 'select university_id from public.launch_campuses')).rows, [{ university_id: 'cbs.dk' }]);
assert.equal((await db.query('select count(*)::int as n from public.universities u join public.launch_campuses c on c.university_id = u.id')).rows[0].n, 1);
await as(K, `update public.profiles set display_name = 'Kasper', discoverable = true where id = $1`, [K]);
await as(L, `update public.profiles set display_name = 'Liv' where id = $1`, [L]);

// Locals see the incoming students and the other way round, once visible; others see nothing.
assert.deepEqual((await as(K, `select * from public.campus_people_count('cbs.dk')`)).rows[0], { total: 2, incoming: 2 });
assert.deepEqual((await as(L, `select * from public.campus_people_count('cbs.dk')`)).rows[0], { total: 3, incoming: 2 });
assert.equal(await count(L, 'select count(*)::int as n from public.campus_people'), 0);
assert.deepEqual(
  (await as(K, `select display_name, home_university_id, destination_id from public.campus_people where campus_id = 'cbs.dk' order by display_name`)).rows,
  [
    { display_name: 'Gio', home_university_id: 'unibocconi.it', destination_id: 'cbs.dk' },
    { display_name: 'Hana', home_university_id: 'heidelberg', destination_id: 'cbs.dk' },
  ],
);
assert.deepEqual((await as(G, 'select display_name from public.campus_people order by display_name')).rows.map((r) => r.display_name), ['Hana', 'Kasper']);
assert.equal(await count(C, 'select count(*)::int as n from public.campus_people'), 0);
assert.deepEqual((await as(C, `select * from public.campus_people_count('cbs.dk')`)).rows[0], { total: 0, incoming: 0 });
assert.equal(await count(B, `select count(*)::int as n from public.campus_people where campus_id = 'heidelberg'`), 0); // not launched

// Campus students wave and chat across home and destination; outsiders cannot.
await wave(K, G);
await wave(G, K);
assert.ok((await as(K, 'select public.open_direct_chat($1) as id', [G])).rows[0].id);
await makeVisible(C);
await assert.rejects(wave(C, K), /row-level security/);

// Plans: campus members only, within the next 24 hours, through create_plan().
const createPlan = (user, campus, title, startsIn = '2 hours') =>
  as(user, `select public.create_plan($1, $2, 'Café by Solbjerg Plads', now() + $3::interval) as id`, [campus, title, startsIn]).then((r) => r.rows[0].id);
const aperitivo = await createPlan(K, 'cbs.dk', 'Aperitivo for exchange students');
assert.equal(await count(L, 'select count(*)::int as n from public.plan_feed where id = $1', [aperitivo]), 1);
assert.equal(await count(G, 'select count(*)::int as n from public.plan_feed where id = $1', [aperitivo]), 1);
assert.equal(await count(C, 'select count(*)::int as n from public.plan_feed'), 0);
await assert.rejects(createPlan(C, 'cbs.dk', 'Gatecrash'), /not_on_campus/);
await assert.rejects(createPlan(B, 'heidelberg', 'Not launched yet'), /not_on_campus/);
await assert.rejects(createPlan(K, 'cbs.dk', 'Next week', '3 days'), /check/);
await assert.rejects(as(K, `insert into public.plans (university_id, author_id, title, place, starts_at) values ('cbs.dk', $1, 'Direct insert', 'Bar', now())`, [K]));
await assert.rejects(as(K, `update public.plans set hidden = false, member_count = 99 where id = $1 returning id`, [aperitivo]).then((r) => {
  if (r.rows.length === 0) throw new Error('no rows');
}));

// Joining adds you to the plan's chat; leaving takes you out; the author stays.
const planChat = (await as(L, 'select public.join_plan($1) as id', [aperitivo])).rows[0].id;
assert.deepEqual(
  (await as(L, 'select member_count, joined_by_me, group_id, author_name from public.plan_feed where id = $1', [aperitivo])).rows[0],
  { member_count: 2, joined_by_me: true, group_id: planChat, author_name: 'Kasper' },
);
assert.equal((await as(G, 'select group_id from public.plan_feed where id = $1', [aperitivo])).rows[0].group_id, null);
await as(L, `insert into public.group_messages (group_id, author_id, body) values ($1, $2, 'On my way!')`, [planChat, L]);
assert.equal(await count(K, 'select count(*)::int as n from public.group_message_feed where group_id = $1', [planChat]), 1);
await assert.rejects(as(C, 'select public.join_plan($1)', [aperitivo]), /Unknown plan/);
await as(L, 'select public.leave_plan($1)', [aperitivo]);
await as(K, 'select public.leave_plan($1)', [aperitivo]);
assert.deepEqual((await as(L, 'select member_count, joined_by_me from public.plan_feed where id = $1', [aperitivo])).rows[0], { member_count: 1, joined_by_me: false });
assert.equal((await db.query('select count(*)::int as n from public.group_members where group_id = $1', [planChat])).rows[0].n, 1);

// Three a day; gone 3 hours after the start.
const lunch = await createPlan(K, 'cbs.dk', 'Lunch at the canteen', '20 hours');
const study = await createPlan(K, 'cbs.dk', 'Study group', '22 hours');
await assert.rejects(createPlan(K, 'cbs.dk', 'One too many'), /plan_limit/);
await db.query(`update public.plans set created_at = now() - interval '5 hours', starts_at = now() - interval '4 hours' where id = $1`, [aperitivo]);
assert.equal(await count(L, 'select count(*)::int as n from public.plan_feed where id = $1', [aperitivo]), 0);
await assert.rejects(as(L, 'select public.join_plan($1)', [aperitivo]), /Unknown plan/);

// Blocks hide plans; 3 reports hide one for everyone; deleting a plan deletes its chat.
await as(H, 'insert into public.blocks (blocker_id, blocked_id) values ($1, $2)', [H, K]);
assert.equal(await count(H, 'select count(*)::int as n from public.plan_feed where author_id = $1', [K]), 0);
assert.equal(await count(G, 'select count(*)::int as n from public.plan_feed where author_id = $1', [K]), 2);
for (const reporter of [G, L, H]) {
  await as(reporter, `insert into public.reports (reporter_id, target_type, target_id, reason) values ($1, 'plan', $2, 'spam')`, [reporter, lunch]);
}
assert.equal(await count(G, 'select count(*)::int as n from public.plan_feed where id = $1', [lunch]), 0);
const studyChat = (await db.query('select group_id from public.plans where id = $1', [study])).rows[0].group_id;
await as(G, 'delete from public.plans where id = $1', [study]);
assert.equal((await db.query('select count(*)::int as n from public.plans where id = $1', [study])).rows[0].n, 1);
await as(K, 'delete from public.plans where id = $1', [study]);
assert.equal((await db.query('select count(*)::int as n from public.groups where id = $1', [studyChat])).rows[0].n, 0);

// Guests see nothing; deleting an account removes its plans and their chats.
for (const relation of ['campus_people', 'plans', 'plan_members', 'plan_feed']) {
  assert.equal(await count(null, `select count(*)::int as n from public.${relation}`), 0, `guests must not read ${relation}`);
}
await db.exec(`delete from auth.users where id = '${K}'`);
assert.equal((await db.query('select count(*)::int as n from public.plans where author_id = $1', [K])).rows[0].n, 0);
assert.equal((await db.query('select count(*)::int as n from public.groups where id = $1', [planChat])).rows[0].n, 0);
console.log('✓ launch campus: CBS students and incoming students meet, plans within 24 hours, 3 a day, chats, blocks, reports');

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
  ['moments', 'author_id'],
  ['moment_reactions', 'user_id'],
]) {
  const left = await db.query(`select count(*)::int as n from public.${table} where ${column} = $1`, [A]);
  assert.equal(left.rows[0].n, 0, table);
}
console.log('✓ deleting the auth user removes all of their data');
console.log('ALL DATABASE CHECKS PASSED');
