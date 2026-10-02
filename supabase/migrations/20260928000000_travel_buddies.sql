-- Travel buddies: students going to the same destination find each other, wave,
-- and chat one to one once both have waved.
--   profiles.discoverable  opt-in, off by default; only visible students see the list
--                          (reciprocal, like Snap Map) and only they can be waved at
--   waves                  one per pair and direction, permanent, 30 a day per student
--   direct_chats           a private two-person chat (groups.kind = 'direct'), opened
--                          only after both students waved; it reuses the group chat
--                          (messages, unread counts, Realtime, reports)
-- Never a precise location, an age or a rating: a buddy card shows the same
-- profile fields students already see on posts (name, home university, field,
-- level, destination and semester).

alter table public.profiles add column discoverable boolean not null default false;
grant update (discoverable) on public.profiles to authenticated;

-- Semesters are saved in the language of the app ("Spring 2027", "Primavera 2027"):
-- this key compares them (src/lib/buddies.ts has the same rule).
create function public.term_key(p_term text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when lower(trim(p_term)) ~ '^(spring|primavera)\M.*\m[0-9]{4}\M' then substring(p_term from '[0-9]{4}') || '-spring'
    when lower(trim(p_term)) ~ '^(fall|autumn|autunno)\M.*\m[0-9]{4}\M' then substring(p_term from '[0-9]{4}') || '-fall'
    else nullif(lower(trim(p_term)), '')
  end
$$;

-- True when the caller and `p_other` blocked each other, in either direction.
-- (Security definer: students only see their own blocks.)
create function public.blocked_with(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p_other)
       or (b.blocker_id = p_other and b.blocked_id = auth.uid())
  )
$$;

-- Both students are visible, going to the same destination, and not blocked.
create function public.can_wave(p_to uuid)
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
      and me.destination_id is not null
      and p.destination_id = me.destination_id
  ) and not public.blocked_with(p_to)
$$;

grant execute on function public.blocked_with(uuid), public.can_wave(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Waves

create table public.waves (
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
create index waves_to_idx on public.waves (to_id);

create function public.limit_waves()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*) from public.waves w
    where w.from_id = new.from_id and w.created_at > now() - interval '24 hours'
  ) >= 30 then
    raise exception 'wave_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger waves_limit
  before insert on public.waves
  for each row execute function public.limit_waves();

alter table public.waves enable row level security;

create policy "Students see waves they sent or received" on public.waves
  for select to authenticated using (from_id = auth.uid() or to_id = auth.uid());
create policy "Students wave at visible students on their path" on public.waves
  for insert to authenticated with check (from_id = auth.uid() and public.can_wave(to_id));
-- No update or delete: a wave cannot be taken back and sent again (blocking is the way out).

-- ---------------------------------------------------------------------------
-- Direct chats (two-person groups)

alter table public.groups drop constraint groups_kind_check;
alter table public.groups add constraint groups_kind_check check (kind in ('group', 'channel', 'direct'));
-- Direct chats are private and have no owner, so create_group() and club_group()
-- (which always set created_by) can never make one.
alter table public.groups add constraint groups_direct_check
  check (kind <> 'direct' or (visibility = 'private' and created_by is null));

create table public.direct_chats (
  group_id uuid primary key references public.groups (id) on delete cascade,
  user_low uuid not null references public.profiles (id) on delete cascade,
  user_high uuid not null references public.profiles (id) on delete cascade,
  unique (user_low, user_high),
  check (user_low < user_high)
);

-- When either student deletes their account the chat goes with it.
create function public.drop_direct_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.groups where id = old.group_id;
  return null;
end;
$$;

create trigger direct_chats_drop_group
  after delete on public.direct_chats
  for each row execute function public.drop_direct_group();

alter table public.direct_chats enable row level security;

create policy "Students see their direct chats" on public.direct_chats
  for select to authenticated using (auth.uid() in (user_low, user_high));
-- Direct chats are created through open_direct_chat(); no direct inserts.

-- Returns the chat with `p_user`, creating it on first use. Both must have waved.
create function public.open_direct_chat(p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  low uuid;
  high uuid;
  target uuid;
begin
  if me is null then
    raise exception 'Sign in required';
  end if;
  if p_user is null or p_user = me
     or not exists (select 1 from public.waves where from_id = me and to_id = p_user)
     or not exists (select 1 from public.waves where from_id = p_user and to_id = me)
     or public.blocked_with(p_user) then
    raise exception 'not_connected' using errcode = 'P0001';
  end if;
  low := least(me, p_user);
  high := greatest(me, p_user);
  select group_id into target from public.direct_chats where user_low = low and user_high = high;
  if target is null then
    insert into public.groups (name, kind, visibility) values ('Direct chat', 'direct', 'private') returning id into target;
    insert into public.direct_chats (group_id, user_low, user_high) values (target, low, high);
  end if;
  insert into public.group_members (group_id, user_id) values (target, low), (target, high) on conflict do nothing;
  return target;
end;
$$;

grant execute on function public.open_direct_chat(uuid) to authenticated;

-- An invite code must never open someone else's direct chat.
create or replace function public.join_group_with_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  select id into target from public.groups where invite_code = upper(trim(p_code)) and not hidden and kind <> 'direct';
  if target is null then
    raise exception 'Invalid invite code' using errcode = 'P0002';
  end if;
  insert into public.group_members (group_id, user_id) values (target, auth.uid()) on conflict do nothing;
  return target;
end;
$$;

-- Both students write in a direct chat, until one blocks the other.
create or replace function public.can_post(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members m
    join public.groups g on g.id = m.group_id
    where m.group_id = p_group
      and m.user_id = auth.uid()
      and not g.hidden
      and (
        g.kind = 'group'
        or (g.kind = 'channel' and m.role in ('owner', 'admin'))
        or (g.kind = 'direct' and not exists (
          select 1 from public.direct_chats d
          where d.group_id = g.id
            and public.blocked_with(case when d.user_low = auth.uid() then d.user_high else d.user_low end)
        ))
      )
  )
$$;

-- The chat list names a direct chat after the other student and hides it once
-- either of them blocked the other. New columns go last (create or replace view).
create or replace view public.group_directory with (security_invoker = on) as
select
  g.id,
  case when g.kind = 'direct' then coalesce(nullif(peer.display_name, ''), 'Student') else g.name end as name,
  case when g.kind = 'direct' then coalesce(peer.home_university, '') else g.description end as description,
  g.kind,
  g.visibility,
  g.university_id,
  g.club_id,
  g.member_count,
  g.last_message_at,
  g.last_message_preview,
  g.created_at,
  m.role as my_role,
  case when m.role is not null and g.kind <> 'direct' then g.invite_code end as invite_code,
  case when m.role is null then 0 else (
    select count(*)::int from public.group_messages x
    where x.group_id = g.id and x.created_at > m.last_read_at and x.author_id <> auth.uid() and not x.hidden
  ) end as unread_count,
  peer.id as peer_id
from public.groups g
left join public.group_members m on m.group_id = g.id and m.user_id = auth.uid()
left join public.direct_chats d on d.group_id = g.id
left join public.profiles peer on peer.id = case when d.user_low = auth.uid() then d.user_high else d.user_low end
where g.kind <> 'direct' or (peer.id is not null and not public.blocked_with(peer.id));

-- ---------------------------------------------------------------------------
-- Read models

-- Visible students going to the caller's destination; empty until the caller is visible too.
create view public.travel_buddies with (security_invoker = on) as
select
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
from public.profiles me
join public.profiles p on p.destination_id = me.destination_id and p.id <> me.id
where me.id = auth.uid()
  and me.discoverable
  and p.discoverable
  and not public.blocked_with(p.id);

grant select on public.travel_buddies to authenticated;

-- How many visible students go to the caller's destination (and in the same
-- semester): numbers only, so students can see the list is worth joining
-- before they make themselves visible.
create function public.travel_buddy_count()
returns table (total integer, same_term integer)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int, (count(*) filter (where public.term_key(p.term) = public.term_key(me.term)))::int
  from public.profiles me
  join public.profiles p on p.destination_id = me.destination_id and p.id <> me.id
  where me.id = auth.uid() and p.discoverable and not public.blocked_with(p.id)
$$;

grant execute on function public.travel_buddy_count() to authenticated;
