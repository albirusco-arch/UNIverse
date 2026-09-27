-- Opportunities (internships, jobs and events linking to where they are published)
-- and moments (club photos that stay up for 24 hours, with one emoji reaction each).

-- ---------------------------------------------------------------------------
-- Opportunities
--
-- LinkedIn, Handshake, JobTeaser and Eventbrite have no public API to read
-- their listings: rows come from an admin import of listings the platform or
-- organiser lets us republish (verified), or from students sharing a link
-- (unverified). Applying always happens on the original page.

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('internship', 'graduate', 'part_time', 'event')),
  title text not null check (char_length(title) between 3 and 160),
  organization text not null check (char_length(organization) between 1 and 120),
  city text not null default '' check (char_length(city) <= 100),
  country_code text not null default '' check (country_code ~ '^([A-Z]{2})?$'),
  remote boolean not null default false,
  field text,
  url text not null check (url ~ '^https://' and char_length(url) <= 500),
  source text not null default 'student' check (source in (
    'linkedin', 'handshake', 'jobteaser', 'eventbrite', 'university', 'club', 'student'
  )),
  university_id text references public.universities (id) on delete set null,
  club_id uuid references public.clubs (id) on delete set null,
  deadline timestamptz,
  starts_at timestamptz,
  verified boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  report_count integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (url)
);
create index opportunities_created_idx on public.opportunities (created_at desc) where not hidden;

alter table public.opportunities enable row level security;

create policy "Students read visible opportunities" on public.opportunities
  for select to authenticated using (not hidden);
create policy "Guests read verified opportunities" on public.opportunities
  for select to anon using (not hidden and verified);
create policy "Students share opportunities" on public.opportunities
  for insert to authenticated with check (
    created_by = auth.uid() and source = 'student' and not verified and report_count = 0 and not hidden
  );
create policy "Students delete opportunities they shared" on public.opportunities
  for delete to authenticated using (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Moments

create table public.moments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  club_id uuid references public.clubs (id) on delete cascade,
  university_id text references public.universities (id) on delete set null,
  image_path text not null unique check (char_length(image_path) <= 200),
  caption text not null default '' check (char_length(caption) <= 140),
  report_count integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  -- Photos are stored under the author's folder (see the storage policies below).
  check (image_path like author_id::text || '/%')
);
create index moments_created_idx on public.moments (created_at desc) where not hidden;
create index moments_club_idx on public.moments (club_id, created_at desc);
create index moments_author_idx on public.moments (author_id, created_at desc);

create table public.moment_reactions (
  moment_id uuid not null references public.moments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (emoji in ('🔥', '😂', '😍', '👏', '😮')),
  created_at timestamptz not null default now(),
  primary key (moment_id, user_id)
);

-- A club moment belongs to the club's university; at most 10 moments a day per student.
create function public.prepare_moment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.club_id is not null then
    select c.university_id into new.university_id from public.clubs c where c.id = new.club_id;
  end if;
  if (
    select count(*) from public.moments m
    where m.author_id = new.author_id and m.created_at > now() - interval '24 hours'
  ) >= 10 then
    raise exception 'moment_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger moments_prepare
  before insert on public.moments
  for each row execute function public.prepare_moment();

alter table public.moments enable row level security;
alter table public.moment_reactions enable row level security;

create policy "Students read live moments" on public.moments
  for select to authenticated using (not hidden and created_at > now() - interval '24 hours');
create policy "Students post their own moments" on public.moments
  for insert to authenticated with check (author_id = auth.uid() and report_count = 0 and not hidden);
create policy "Students delete their own moments" on public.moments
  for delete to authenticated using (author_id = auth.uid());

create policy "Students read reactions" on public.moment_reactions
  for select to authenticated using (true);
create policy "Students react as themselves" on public.moment_reactions
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.moments m
      where m.id = moment_id and not m.hidden and m.created_at > now() - interval '24 hours'
    )
  );
create policy "Students change their reaction" on public.moment_reactions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Students remove their reaction" on public.moment_reactions
  for delete to authenticated using (user_id = auth.uid());

create view public.moment_feed with (security_invoker = on) as
select
  m.id,
  m.club_id,
  c.name as club_name,
  m.university_id,
  m.image_path,
  m.caption,
  m.created_at,
  (
    select jsonb_object_agg(r.emoji, r.n)
    from (select emoji, count(*)::int as n from public.moment_reactions where moment_id = m.id group by emoji) r
  ) as reactions,
  (select r.emoji from public.moment_reactions r where r.moment_id = m.id and r.user_id = auth.uid()) as my_reaction,
  a.id as author_id,
  coalesce(nullif(a.display_name, ''), 'Student') as author_name,
  a.home_university as author_home_university,
  a.field as author_field,
  a.destination_id as author_destination_id,
  a.verified as author_verified
from public.moments m
join public.profiles a on a.id = m.author_id
left join public.clubs c on c.id = m.club_id
where not exists (
  select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = m.author_id
);

grant select on public.moment_feed to authenticated;

-- ---------------------------------------------------------------------------
-- Reports: moments and opportunities can be reported too (3 reports hide them).

alter table public.reports drop constraint reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('post', 'comment', 'message', 'user', 'group', 'club', 'moment', 'opportunity'));

create or replace function public.apply_report()
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
    when 'moment' then
      update public.moments set report_count = report_count + 1, hidden = hidden or report_count + 1 >= 3
        where id = new.target_id;
    when 'opportunity' then
      update public.opportunities set report_count = report_count + 1, hidden = hidden or report_count + 1 >= 3
        where id = new.target_id;
    else
      null;
  end case;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for moment photos (skipped where Supabase Storage is absent, e.g. tests).

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (select 1 from pg_tables where schemaname = 'storage' and tablename = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('moments', 'moments', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;

    execute $p$
      create policy "Students read moment photos" on storage.objects
        for select to authenticated using (bucket_id = 'moments')
    $p$;
    execute $p$
      create policy "Students upload moment photos to their folder" on storage.objects
        for insert to authenticated
        with check (bucket_id = 'moments' and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
    execute $p$
      create policy "Students delete their moment photos" on storage.objects
        for delete to authenticated
        using (bucket_id = 'moments' and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
  end if;
end;
$$;
