-- Campus features open one university at a time, so each launch campus has
-- enough active students before the next one opens. CBS first.
--   launch_campuses  where campus features are open; launching another
--                    university is one insert (no app release needed):
--                    insert into public.launch_campuses (university_id) values ('<id>');
--   campus_people    visible students of a launch campus and those going there
--                    (same opt-in as travel buddies: profiles.discoverable)
--   plans            "Aperitivo at 7pm, who's in?": a time within the next 24 hours
--                    and a public place, visible to the campus until 3 hours after
--                    it starts; joining adds you to the plan's chat. 3 a day per student.

create table public.launch_campuses (
  -- No foreign key: migrations run before the seed loads the catalogue.
  university_id text primary key,
  launched_at date not null default current_date
);

insert into public.launch_campuses (university_id) values ('cbs.dk');

alter table public.launch_campuses enable row level security;
create policy "Launch campuses are public" on public.launch_campuses
  for select to anon, authenticated using (true);

-- The caller studies at `p_university` or is going there, and it is a launch campus.
create function public.campus_member(p_university text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles me
    join public.launch_campuses c on c.university_id = p_university
    where me.id = auth.uid() and p_university in (me.home_university_id, me.destination_id)
  )
$$;

grant execute on function public.campus_member(text) to authenticated;

-- Waves: students going to the same destination, or sharing a launch campus.
create or replace function public.can_wave(p_to uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles me
    join public.profiles p on p.id = p_to
    where me.id = auth.uid()
      and p.id <> me.id
      and me.discoverable
      and p.discoverable
      and (
        (me.destination_id is not null and p.destination_id = me.destination_id)
        or exists (
          select 1 from public.launch_campuses c
          where c.university_id in (me.home_university_id, me.destination_id)
            and c.university_id in (p.home_university_id, p.destination_id)
        )
      )
  ) and not public.blocked_with(p_to)
$$;

-- ---------------------------------------------------------------------------
-- Campus people

-- Visible students of each launch campus the caller belongs to; empty until the caller is visible too.
create view public.campus_people with (security_invoker = on) as
select
  c.university_id as campus_id,
  p.id,
  coalesce(nullif(p.display_name, ''), 'Student') as display_name,
  p.home_university,
  p.home_university_id,
  p.field,
  p.level,
  p.destination_id,
  p.term,
  p.verified,
  exists (select 1 from public.waves w where w.from_id = me.id and w.to_id = p.id) as waved_by_me,
  exists (select 1 from public.waves w where w.from_id = p.id and w.to_id = me.id) as waved_me,
  (
    select d.group_id from public.direct_chats d
    where d.user_low = least(me.id, p.id) and d.user_high = greatest(me.id, p.id)
  ) as chat_id
from public.launch_campuses c
join public.profiles me
  on me.id = auth.uid() and me.discoverable and c.university_id in (me.home_university_id, me.destination_id)
join public.profiles p
  on p.id <> me.id and p.discoverable and c.university_id in (p.home_university_id, p.destination_id)
where not public.blocked_with(p.id);

grant select on public.campus_people to authenticated;

-- Numbers only, so campus members see the community is worth joining before they are visible.
create function public.campus_people_count(p_university text)
returns table (total integer, incoming integer)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int, (count(*) filter (where p.destination_id = p_university))::int
  from public.profiles p
  where public.campus_member(p_university)
    and p.id <> auth.uid()
    and p.discoverable
    and p_university in (p.home_university_id, p.destination_id)
    and not public.blocked_with(p.id)
$$;

grant execute on function public.campus_people_count(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Plans

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  university_id text not null,
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  place text not null check (char_length(place) between 2 and 100),
  starts_at timestamptz not null,
  group_id uuid references public.groups (id) on delete set null,
  member_count integer not null default 0,
  report_count integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  check (starts_at between created_at - interval '15 minutes' and created_at + interval '24 hours')
);
create index plans_campus_idx on public.plans (university_id, starts_at) where not hidden;
create index plans_author_idx on public.plans (author_id, created_at desc);

create table public.plan_members (
  plan_id uuid not null references public.plans (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);
create index plan_members_user_idx on public.plan_members (user_id);

create function public.plan_member(p_plan uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.plan_members where plan_id = p_plan and user_id = auth.uid())
$$;

grant execute on function public.plan_member(uuid) to authenticated;

create function public.count_plan_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.plans set member_count = member_count + 1 where id = new.plan_id;
  else
    update public.plans set member_count = greatest(member_count - 1, 0) where id = old.plan_id;
  end if;
  return null;
end;
$$;

create trigger plan_members_count
  after insert or delete on public.plan_members
  for each row execute function public.count_plan_members();

-- A deleted plan takes its chat with it.
create function public.drop_plan_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.group_id is not null then
    delete from public.groups where id = old.group_id;
  end if;
  return null;
end;
$$;

create trigger plans_drop_group
  after delete on public.plans
  for each row execute function public.drop_plan_group();

-- Creates a plan and its private chat; the author is the first member.
create function public.create_plan(p_university text, p_title text, p_place text, p_starts_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  chat uuid;
  target uuid;
begin
  if me is null then
    raise exception 'Sign in required';
  end if;
  if not public.campus_member(p_university) then
    raise exception 'not_on_campus' using errcode = 'P0001';
  end if;
  if (select count(*) from public.plans where author_id = me and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'plan_limit' using errcode = 'P0001';
  end if;
  insert into public.groups (name, description, kind, visibility, university_id, created_by)
  values (left(trim(p_title), 60), left(trim(p_place), 300), 'group', 'private', p_university, me)
  returning id into chat;
  insert into public.plans (university_id, author_id, title, place, starts_at, group_id)
  values (p_university, me, trim(p_title), trim(p_place), p_starts_at, chat)
  returning id into target;
  insert into public.plan_members (plan_id, user_id) values (target, me);
  return target;
end;
$$;

-- Joins a live plan of the caller's campus and its chat; returns the chat.
create function public.join_plan(p_plan uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  select * into target from public.plans
  where id = p_plan and not hidden and starts_at > now() - interval '3 hours';
  if target is null or not public.campus_member(target.university_id) or public.blocked_with(target.author_id) then
    raise exception 'Unknown plan' using errcode = 'P0002';
  end if;
  insert into public.plan_members (plan_id, user_id) values (p_plan, auth.uid()) on conflict do nothing;
  if target.group_id is not null then
    insert into public.group_members (group_id, user_id) values (target.group_id, auth.uid()) on conflict do nothing;
  end if;
  return target.group_id;
end;
$$;

-- Leaves a plan and its chat (authors delete their plan instead).
create function public.leave_plan(p_plan uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  chat uuid;
begin
  select group_id into chat from public.plans where id = p_plan and author_id <> auth.uid();
  if not found then
    return;
  end if;
  delete from public.plan_members where plan_id = p_plan and user_id = auth.uid();
  if chat is not null then
    delete from public.group_members where group_id = chat and user_id = auth.uid();
  end if;
end;
$$;

grant execute on function
  public.create_plan(text, text, text, timestamptz),
  public.join_plan(uuid),
  public.leave_plan(uuid)
  to authenticated;

alter table public.plans enable row level security;
alter table public.plan_members enable row level security;

create policy "Campus students see live plans" on public.plans
  for select to authenticated using (
    not hidden
    and starts_at > now() - interval '3 hours'
    and public.campus_member(university_id)
    and not public.blocked_with(author_id)
  );
-- Plans are created through create_plan(); no direct inserts or updates.
create policy "Authors delete their plans" on public.plans
  for delete to authenticated using (author_id = auth.uid());

create policy "Plan members see each other" on public.plan_members
  for select to authenticated using (user_id = auth.uid() or public.plan_member(plan_id));
-- Members join and leave through join_plan() / leave_plan().

create view public.plan_feed with (security_invoker = on) as
select
  pl.id,
  pl.university_id,
  pl.title,
  pl.place,
  pl.starts_at,
  pl.member_count,
  pl.created_at,
  public.plan_member(pl.id) as joined_by_me,
  case when public.plan_member(pl.id) then pl.group_id end as group_id,
  a.id as author_id,
  coalesce(nullif(a.display_name, ''), 'Student') as author_name,
  a.home_university as author_home_university,
  a.field as author_field,
  a.destination_id as author_destination_id,
  a.verified as author_verified
from public.plans pl
join public.profiles a on a.id = pl.author_id;

grant select on public.plan_feed to authenticated;

-- ---------------------------------------------------------------------------
-- Reports: plans can be reported too (3 reports hide one).

alter table public.reports drop constraint reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('post', 'comment', 'message', 'user', 'group', 'club', 'moment', 'opportunity', 'plan'));

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
    when 'plan' then
      update public.plans set report_count = report_count + 1, hidden = hidden or report_count + 1 >= 3
        where id = new.target_id;
    else
      null;
  end case;
  return null;
end;
$$;
