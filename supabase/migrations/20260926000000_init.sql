-- UNIverse initial schema: profiles, community (posts, comments, likes, saves),
-- moderation (reports, blocks), crowdsourced course equivalences and AI course matches.
-- Row Level Security is enabled on every table; the app only uses the anon key.

-- ---------------------------------------------------------------------------
-- Reference data

create table public.universities (
  id text primary key,
  name text not null,
  city text not null,
  country text not null,
  country_code text not null check (char_length(country_code) = 2),
  region text not null check (region in ('europe', 'uk', 'north_america', 'asia', 'oceania')),
  website text not null,
  email_domains text[] not null default '{}'
);

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user; email stays in auth.users and is never exposed)

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  home_university text not null default '' check (char_length(home_university) <= 200),
  field text check (field in (
    'life_sciences', 'biochemistry', 'medicine', 'computer_science', 'engineering', 'business',
    'law', 'physics_math', 'humanities', 'social_sciences', 'architecture', 'other'
  )),
  level text check (level in ('bachelor', 'master', 'phd', 'researcher')),
  destination_id text references public.universities (id) on delete set null,
  term text check (char_length(term) <= 60),
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

-- Users may edit their own profile, but never the verified flag.
revoke update on public.profiles from anon, authenticated;
grant update (display_name, home_university, field, level, destination_id, term) on public.profiles to authenticated;

-- Create the profile on sign-up; verified when the email domain belongs to a known university.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  email_domain text := lower(split_part(new.email, '@', 2));
begin
  insert into public.profiles (id, verified)
  values (
    new.id,
    exists (
      select 1
      from public.universities u, unnest(u.email_domains) as d(domain)
      where email_domain = d.domain or email_domain like '%.' || d.domain
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Community

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  topic text not null check (topic in ('question', 'experience', 'housing', 'tip')),
  body text not null check (char_length(body) between 10 and 4000),
  university_id text references public.universities (id) on delete set null,
  field text,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  report_count integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index posts_created_at_idx on public.posts (created_at desc);
create index posts_university_idx on public.posts (university_id, created_at desc);
create index posts_author_idx on public.posts (author_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  report_count integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id, created_at);

create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.post_saves (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.saved_universities (
  user_id uuid not null references public.profiles (id) on delete cascade,
  university_id text not null references public.universities (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, university_id)
);

-- Denormalised counters, maintained by triggers (users cannot update others' posts).
create function public.bump_post_counter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
  target uuid := case when tg_op = 'INSERT' then new.post_id else old.post_id end;
begin
  if tg_table_name = 'post_likes' then
    update public.posts set like_count = greatest(like_count + delta, 0) where id = target;
  else
    update public.posts set comment_count = greatest(comment_count + delta, 0) where id = target;
  end if;
  return null;
end;
$$;

create trigger post_likes_counter
  after insert or delete on public.post_likes
  for each row execute function public.bump_post_counter();

create trigger comments_counter
  after insert or delete on public.comments
  for each row execute function public.bump_post_counter();

-- ---------------------------------------------------------------------------
-- Moderation (App Store Review Guideline 1.2)

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment', 'user')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'harassment', 'misinformation', 'inappropriate')),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
create index reports_open_idx on public.reports (created_at) where status = 'open';

-- Content reported by 3 different people is hidden until a moderator reviews it.
create function public.apply_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.target_type = 'post' then
    update public.posts
      set report_count = report_count + 1, hidden = hidden or report_count + 1 >= 3
      where id = new.target_id;
  elsif new.target_type = 'comment' then
    update public.comments
      set report_count = report_count + 1, hidden = hidden or report_count + 1 >= 3
      where id = new.target_id;
  end if;
  return null;
end;
$$;

create trigger reports_apply
  after insert on public.reports
  for each row execute function public.apply_report();

-- ---------------------------------------------------------------------------
-- Crowdsourced course equivalences (from signed learning agreements)

create table public.equivalences (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references public.profiles (id) on delete cascade,
  home_university text not null check (char_length(home_university) between 2 and 200),
  home_course text not null check (char_length(home_course) between 1 and 200),
  home_ects numeric(4, 1) check (home_ects between 0 and 60),
  destination_id text not null references public.universities (id) on delete cascade,
  destination_course text not null check (char_length(destination_course) between 1 and 200),
  destination_ects numeric(4, 1) check (destination_ects between 0 and 60),
  approved boolean not null,
  academic_year text not null check (char_length(academic_year) between 4 and 20),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index equivalences_destination_idx on public.equivalences (destination_id, created_at desc);

-- ---------------------------------------------------------------------------
-- AI course matches (written only by the course-match edge function)

create table public.course_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  request jsonb not null,
  request_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'error')),
  report jsonb,
  error text,
  model text,
  cached_from uuid references public.course_matches (id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index course_matches_user_idx on public.course_matches (user_id, created_at desc);
create index course_matches_cache_idx on public.course_matches (request_hash, completed_at desc) where status = 'done';

-- ---------------------------------------------------------------------------
-- Row Level Security

alter table public.universities enable row level security;
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_saves enable row level security;
alter table public.saved_universities enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.equivalences enable row level security;
alter table public.course_matches enable row level security;

create policy "Universities are public" on public.universities
  for select to anon, authenticated using (true);

create policy "Profiles are public" on public.profiles
  for select to anon, authenticated using (true);
create policy "Users update their own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "Visible posts are public" on public.posts
  for select to anon, authenticated using (not hidden);
create policy "Users create their own posts" on public.posts
  for insert to authenticated with check (author_id = auth.uid());
create policy "Users delete their own posts" on public.posts
  for delete to authenticated using (author_id = auth.uid());

create policy "Visible comments are public" on public.comments
  for select to anon, authenticated using (not hidden);
create policy "Users comment as themselves" on public.comments
  for insert to authenticated with check (
    author_id = auth.uid()
    and exists (select 1 from public.posts p where p.id = post_id and not p.hidden)
  );
create policy "Users delete their own comments" on public.comments
  for delete to authenticated using (author_id = auth.uid());

create policy "Users see their own likes" on public.post_likes
  for select to authenticated using (user_id = auth.uid());
create policy "Users like as themselves" on public.post_likes
  for insert to authenticated with check (user_id = auth.uid());
create policy "Users remove their own likes" on public.post_likes
  for delete to authenticated using (user_id = auth.uid());

create policy "Users see their own saves" on public.post_saves
  for select to authenticated using (user_id = auth.uid());
create policy "Users save as themselves" on public.post_saves
  for insert to authenticated with check (user_id = auth.uid());
create policy "Users remove their own saves" on public.post_saves
  for delete to authenticated using (user_id = auth.uid());

create policy "Users see their saved universities" on public.saved_universities
  for select to authenticated using (user_id = auth.uid());
create policy "Users save universities" on public.saved_universities
  for insert to authenticated with check (user_id = auth.uid());
create policy "Users unsave universities" on public.saved_universities
  for delete to authenticated using (user_id = auth.uid());

create policy "Users see their own blocks" on public.blocks
  for select to authenticated using (blocker_id = auth.uid());
create policy "Users block as themselves" on public.blocks
  for insert to authenticated with check (blocker_id = auth.uid());
create policy "Users unblock" on public.blocks
  for delete to authenticated using (blocker_id = auth.uid());

create policy "Users see their own reports" on public.reports
  for select to authenticated using (reporter_id = auth.uid());
create policy "Users report as themselves" on public.reports
  for insert to authenticated with check (reporter_id = auth.uid());

create policy "Visible equivalences are public" on public.equivalences
  for select to anon, authenticated using (not hidden);
create policy "Users share their own equivalences" on public.equivalences
  for insert to authenticated with check (submitted_by = auth.uid());
create policy "Users delete their own equivalences" on public.equivalences
  for delete to authenticated using (submitted_by = auth.uid());

create policy "Users see their own matches" on public.course_matches
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Read models used by the app (security_invoker: RLS of the caller applies)

create view public.post_feed with (security_invoker = on) as
select
  p.id,
  p.topic,
  p.body,
  p.university_id,
  p.field,
  p.created_at,
  p.like_count,
  p.comment_count,
  a.id as author_id,
  coalesce(nullif(a.display_name, ''), 'Student') as author_name,
  a.home_university as author_home_university,
  a.field as author_field,
  a.destination_id as author_destination_id,
  a.verified as author_verified,
  exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = auth.uid()) as liked_by_me,
  exists (select 1 from public.post_saves s where s.post_id = p.id and s.user_id = auth.uid()) as saved_by_me
from public.posts p
join public.profiles a on a.id = p.author_id
where not exists (
  select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = p.author_id
);

create view public.comment_feed with (security_invoker = on) as
select
  c.id,
  c.post_id,
  c.body,
  c.created_at,
  a.id as author_id,
  coalesce(nullif(a.display_name, ''), 'Student') as author_name,
  a.home_university as author_home_university,
  a.field as author_field,
  a.destination_id as author_destination_id,
  a.verified as author_verified
from public.comments c
join public.profiles a on a.id = c.author_id
where not exists (
  select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = c.author_id
);

create view public.equivalence_feed with (security_invoker = on) as
select
  e.id,
  e.home_university,
  e.home_course,
  e.home_ects::float8 as home_ects,
  e.destination_id,
  e.destination_course,
  e.destination_ects::float8 as destination_ects,
  e.approved,
  e.academic_year,
  e.created_at,
  a.id as author_id,
  coalesce(nullif(a.display_name, ''), 'Student') as author_name,
  a.home_university as author_home_university,
  a.field as author_field,
  a.destination_id as author_destination_id,
  a.verified as author_verified
from public.equivalences e
join public.profiles a on a.id = e.submitted_by
where not exists (
  select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = e.submitted_by
);

create view public.university_stats with (security_invoker = on) as
select
  u.id as university_id,
  (select count(*) from public.profiles p where p.destination_id = u.id)::int as members,
  (select count(*) from public.equivalences e where e.destination_id = u.id and not e.hidden)::int as equivalences
from public.universities u;

grant select on public.post_feed, public.comment_feed, public.equivalence_feed, public.university_stats
  to anon, authenticated;
