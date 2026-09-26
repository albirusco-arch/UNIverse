-- Groups: a mix of WhatsApp and Telegram.
--   kind "group"   everyone chats          kind "channel"  only admins post
--   public         discoverable, join freely
--   private        invite code only
-- Messages are delivered live through Supabase Realtime (RLS applies).

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 60),
  description text not null default '' check (char_length(description) <= 300),
  kind text not null default 'group' check (kind in ('group', 'channel')),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  university_id text references public.universities (id) on delete set null,
  club_id uuid references public.clubs (id) on delete set null,
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  created_by uuid references public.profiles (id) on delete set null,
  member_count integer not null default 0,
  last_message_at timestamptz,
  last_message_preview text not null default '',
  report_count integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index groups_one_per_club on public.groups (club_id) where club_id is not null;
create index groups_public_idx on public.groups (last_message_at desc nulls last) where visibility = 'public';

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

create table public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  report_count integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index group_messages_group_idx on public.group_messages (group_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers (security definer, so policies can use them without recursion)

create function public.group_role(p_group uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.group_members where group_id = p_group and user_id = auth.uid()
$$;

create function public.can_post(p_group uuid)
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
      and (g.kind = 'group' or m.role in ('owner', 'admin'))
  )
$$;

grant execute on function public.group_role(uuid), public.can_post(uuid) to authenticated;

-- The creator becomes the owner.
create function public.add_group_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.group_members (group_id, user_id, role) values (new.id, new.created_by, 'owner');
  end if;
  return new;
end;
$$;

create trigger groups_add_owner
  after insert on public.groups
  for each row execute function public.add_group_owner();

create function public.count_group_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.groups set member_count = member_count + 1 where id = new.group_id;
  else
    update public.groups set member_count = greatest(member_count - 1, 0) where id = old.group_id;
  end if;
  return null;
end;
$$;

create trigger group_members_count
  after insert or delete on public.group_members
  for each row execute function public.count_group_members();

create function public.on_group_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.groups
    set last_message_at = new.created_at, last_message_preview = left(new.body, 120)
    where id = new.group_id;
  update public.group_members
    set last_read_at = new.created_at
    where group_id = new.group_id and user_id = new.author_id;
  return null;
end;
$$;

create trigger group_messages_after_insert
  after insert on public.group_messages
  for each row execute function public.on_group_message();

-- ---------------------------------------------------------------------------
-- RPCs

-- Create a group or channel; the caller becomes its owner. (An RPC rather than a
-- plain insert so the new row is visible to its creator before the membership exists.)
create function public.create_group(
  p_name text,
  p_description text,
  p_kind text,
  p_visibility text,
  p_university_id text default null
)
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
  insert into public.groups (name, description, kind, visibility, university_id, created_by)
  values (trim(p_name), trim(coalesce(p_description, '')), p_kind, p_visibility, p_university_id, auth.uid())
  returning id into target;
  return target;
end;
$$;

-- Join a private group (or any group) with its invite code.
create function public.join_group_with_code(p_code text)
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
  select id into target from public.groups where invite_code = upper(trim(p_code)) and not hidden;
  if target is null then
    raise exception 'Invalid invite code' using errcode = 'P0002';
  end if;
  insert into public.group_members (group_id, user_id) values (target, auth.uid()) on conflict do nothing;
  return target;
end;
$$;

-- Returns the chat of a club, creating a public group for it on first use.
create function public.club_group(p_club uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
  club record;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  select id into target from public.groups where club_id = p_club;
  if target is null then
    select * into club from public.clubs where id = p_club and not hidden;
    if club is null then
      raise exception 'Unknown club' using errcode = 'P0002';
    end if;
    insert into public.groups (name, description, kind, visibility, university_id, club_id, created_by)
    values (left(club.name, 60), left(club.description, 300), 'group', 'public', club.university_id, club.id, auth.uid())
    returning id into target;
  else
    insert into public.group_members (group_id, user_id) values (target, auth.uid()) on conflict do nothing;
  end if;
  return target;
end;
$$;

create function public.mark_group_read(p_group uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.group_members set last_read_at = now() where group_id = p_group and user_id = auth.uid()
$$;

grant execute on function
  public.create_group(text, text, text, text, text),
  public.join_group_with_code(text),
  public.club_group(uuid),
  public.mark_group_read(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;

-- Admins may rename or describe a group; counters and codes are managed by the database.
revoke update on public.groups from anon, authenticated;
grant update (name, description) on public.groups to authenticated;

create policy "Public groups and my groups are visible" on public.groups
  for select to authenticated using (not hidden and (visibility = 'public' or public.group_role(id) is not null));
-- Groups are created through create_group() / club_group(); no direct inserts.
create policy "Admins edit their groups" on public.groups
  for update to authenticated using (public.group_role(id) in ('owner', 'admin'));
create policy "Owners delete their groups" on public.groups
  for delete to authenticated using (public.group_role(id) = 'owner');

create policy "Members see each other" on public.group_members
  for select to authenticated using (user_id = auth.uid() or public.group_role(group_id) is not null);
create policy "Students join public groups" on public.group_members
  for insert to authenticated with check (
    user_id = auth.uid()
    and role = 'member'
    and exists (select 1 from public.groups g where g.id = group_id and g.visibility = 'public' and not g.hidden)
  );
create policy "Members leave, admins remove" on public.group_members
  for delete to authenticated using (user_id = auth.uid() or public.group_role(group_id) in ('owner', 'admin'));

create policy "Members read messages" on public.group_messages
  for select to authenticated using (not hidden and public.group_role(group_id) is not null);
create policy "Members post where allowed" on public.group_messages
  for insert to authenticated with check (author_id = auth.uid() and public.can_post(group_id));
create policy "Authors and admins delete messages" on public.group_messages
  for delete to authenticated using (author_id = auth.uid() or public.group_role(group_id) in ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- Read models

create view public.group_directory with (security_invoker = on) as
select
  g.id,
  g.name,
  g.description,
  g.kind,
  g.visibility,
  g.university_id,
  g.club_id,
  g.member_count,
  g.last_message_at,
  g.last_message_preview,
  g.created_at,
  m.role as my_role,
  case when m.role is not null then g.invite_code end as invite_code,
  case when m.role is null then 0 else (
    select count(*)::int from public.group_messages x
    where x.group_id = g.id and x.created_at > m.last_read_at and x.author_id <> auth.uid() and not x.hidden
  ) end as unread_count
from public.groups g
left join public.group_members m on m.group_id = g.id and m.user_id = auth.uid();

create view public.group_message_feed with (security_invoker = on) as
select
  x.id,
  x.group_id,
  x.body,
  x.created_at,
  a.id as author_id,
  coalesce(nullif(a.display_name, ''), 'Student') as author_name,
  a.home_university as author_home_university,
  a.field as author_field,
  a.destination_id as author_destination_id,
  a.verified as author_verified
from public.group_messages x
join public.profiles a on a.id = x.author_id
where not exists (
  select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = x.author_id
);

create view public.club_list with (security_invoker = on) as
select c.*, (select g.id from public.groups g where g.club_id = c.id and not g.hidden) as group_id
from public.clubs c;

grant select on public.group_directory, public.group_message_feed, public.club_list to authenticated;

-- Live chat: stream new messages to subscribed members.
alter publication supabase_realtime add table public.group_messages;
