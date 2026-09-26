-- UNIVERSE core schema: university catalogue, university-email-only accounts,
-- profiles, saved universities, personalisation signals and moderation.
-- Row Level Security is enabled on every table; the app only uses the anon key.

-- ---------------------------------------------------------------------------
-- Catalogue (seeded from src/data/*.json by scripts/generate-seed.mjs)

create table public.countries (
  code text primary key check (code ~ '^[A-Z]{2}$'),
  name text not null,
  region text not null check (region in (
    'europe', 'uk', 'north_america', 'latin_america', 'asia', 'middle_east', 'africa', 'oceania'
  )),
  erasmus_programme boolean not null default false
);

create table public.universities (
  id text primary key,
  name text not null,
  city text not null default '',
  country text not null,
  country_code text not null references public.countries (code),
  region text not null,
  website text not null,
  email_domains text[] not null default '{}',
  erasmus_code text,
  erasmus_programme boolean not null default false,
  featured boolean not null default false
);
create index universities_email_domains_idx on public.universities using gin (email_domains);

-- ---------------------------------------------------------------------------
-- University email only: sign-up is refused for non-academic addresses.

-- Extra addresses or domains allowed to sign up (e.g. the App Store review account).
create table public.email_allowlist (
  value text primary key check (value = lower(value)),
  note text not null default ''
);

create function public.university_for_email(p_email text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with d as (select lower(split_part(p_email, '@', 2)) as domain)
  select u.id
  from public.universities u, unnest(u.email_domains) as x(domain), d
  where d.domain = x.domain or d.domain like '%.' || x.domain
  order by u.featured desc, length(x.domain) desc
  limit 1
$$;

create function public.is_university_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1 from public.email_allowlist a
      where a.value = lower(p_email) or a.value = lower(split_part(p_email, '@', 2))
    )
    or public.university_for_email(p_email) is not null
    or lower(split_part(p_email, '@', 2)) ~ '(^|\.)(edu|edu\.[a-z]{2}|ac\.[a-z]{2})$'
$$;

grant execute on function public.is_university_email(text) to anon, authenticated;

create function public.enforce_university_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or not public.is_university_email(new.email) then
    raise exception 'A university email address is required' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger enforce_university_email
  before insert on auth.users
  for each row execute function public.enforce_university_email();

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user; the email stays in auth.users and is never exposed)

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  home_university text not null default '' check (char_length(home_university) <= 200),
  home_university_id text references public.universities (id) on delete set null,
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
grant update (display_name, home_university, home_university_id, field, level, destination_id, term)
  on public.profiles to authenticated;

-- Create the profile on sign-up, linked to the university the email belongs to.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  university_id text := public.university_for_email(new.email);
begin
  insert into public.profiles (id, verified, home_university_id, home_university)
  values (
    new.id,
    university_id is not null
      or lower(split_part(new.email, '@', 2)) ~ '(^|\.)(edu|edu\.[a-z]{2}|ac\.[a-z]{2})$',
    university_id,
    coalesce((select u.name from public.universities u where u.id = university_id), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Saved universities and personalisation signals

create table public.saved_universities (
  user_id uuid not null references public.profiles (id) on delete cascade,
  university_id text not null references public.universities (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, university_id)
);

-- What each student searches, views and researches; used to rank their feed.
create table public.user_signals (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('search', 'view_university', 'research', 'save_university', 'course')),
  value text not null check (char_length(value) between 1 and 200),
  created_at timestamptz not null default now()
);
create index user_signals_user_idx on public.user_signals (user_id, created_at desc);

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
  target_type text not null check (target_type in ('post', 'comment', 'message', 'user', 'group', 'club')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'harassment', 'misinformation', 'inappropriate')),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
create index reports_open_idx on public.reports (created_at) where status = 'open';

-- Content reported by 3 different people is hidden until a moderator reviews it.
-- (The target tables are created by later migrations; PL/pgSQL resolves them at run time.)
create function public.apply_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  case new.target_type
    when 'post' then
      update public.posts set report_count = report_count + 1, hidden = hidden or report_count + 1 >= 3
        where id = new.target_id;
    when 'comment' then
      update public.comments set report_count = report_count + 1, hidden = hidden or report_count + 1 >= 3
        where id = new.target_id;
    when 'message' then
      update public.group_messages set report_count = report_count + 1, hidden = hidden or report_count + 1 >= 3
        where id = new.target_id;
    when 'group' then
      update public.groups set report_count = report_count + 1, hidden = hidden or report_count + 1 >= 3
        where id = new.target_id;
    when 'club' then
      update public.clubs set report_count = report_count + 1, hidden = hidden or report_count + 1 >= 3
        where id = new.target_id;
    else
      null;
  end case;
  return null;
end;
$$;

create trigger reports_apply
  after insert on public.reports
  for each row execute function public.apply_report();

-- ---------------------------------------------------------------------------
-- Row Level Security

alter table public.countries enable row level security;
alter table public.universities enable row level security;
alter table public.email_allowlist enable row level security;
alter table public.profiles enable row level security;
alter table public.saved_universities enable row level security;
alter table public.user_signals enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

create policy "Countries are public" on public.countries
  for select to anon, authenticated using (true);
create policy "Universities are public" on public.universities
  for select to anon, authenticated using (true);
-- email_allowlist has no policies: only the service role and the functions above read it.

create policy "Profiles are visible to students" on public.profiles
  for select to authenticated using (true);
create policy "Users update their own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "Users see their saved universities" on public.saved_universities
  for select to authenticated using (user_id = auth.uid());
create policy "Users save universities" on public.saved_universities
  for insert to authenticated with check (user_id = auth.uid());
create policy "Users unsave universities" on public.saved_universities
  for delete to authenticated using (user_id = auth.uid());

create policy "Users see their own signals" on public.user_signals
  for select to authenticated using (user_id = auth.uid());
create policy "Users record their own signals" on public.user_signals
  for insert to authenticated with check (user_id = auth.uid());
create policy "Users clear their own signals" on public.user_signals
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
