-- Partner-first search: the departments (faculties, schools) of each
-- university, the exchange agreements between universities, and course
-- catalogues linked to departments.
--
-- Nothing here is invented. Every row says where it comes from (source and
-- source_url, an official page) and is unverified until an admin confirms it:
--   admin   imported by an admin from an official list (verified)
--   ai      read from the official partner list by the partner-lists function
--   student suggested by a student with a link to the official page
-- last_verified is the date the official source was last checked.
--
-- Subject areas use ISCED-F 2013 codes, as Erasmus+ agreements do: '04' broad
-- field, '041' narrow field, '0413' detailed field. Languages use ISO 639-1.

create function public.is_isced_list(codes text[])
returns boolean
language sql
immutable
as $$
  select coalesce(bool_and(c ~ '^[0-9]{2}([0-9]{1,2})?$'), true) from unnest(codes) as c
$$;

create function public.is_language_list(codes text[])
returns boolean
language sql
immutable
as $$
  select coalesce(bool_and(c ~ '^[a-z]{2}$'), true) from unnest(codes) as c
$$;

-- ---------------------------------------------------------------------------
-- Departments, faculties and schools

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  university_id text not null references public.universities (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 200),
  name_key text generated always as (lower(name)) stored,
  kind text not null default 'department' check (kind in ('faculty', 'school', 'department', 'institute')),
  isced_codes text[] not null default '{}' check (public.is_isced_list(isced_codes)),
  website text not null default '' check (char_length(website) <= 300),
  source text not null check (source in ('admin', 'ai')),
  source_url text not null check (source_url ~ '^https?://' and char_length(source_url) <= 500),
  verified boolean not null default false,
  last_verified date,
  created_at timestamptz not null default now(),
  unique (university_id, name_key),
  unique (id, university_id)
);

-- ---------------------------------------------------------------------------
-- Exchange agreements between a home university and a partner

create table public.partnerships (
  id uuid primary key default gen_random_uuid(),
  home_university_id text not null references public.universities (id) on delete cascade,
  partner_university_id text not null references public.universities (id) on delete cascade,
  agreement_type text not null check (agreement_type in ('erasmus', 'bilateral', 'other')),
  -- The home department or faculty that owns the agreement; null = university-wide.
  home_department_id uuid,
  -- Subject areas covered; empty = all subjects or not stated.
  isced_codes text[] not null default '{}' check (public.is_isced_list(isced_codes)),
  levels text[] not null default '{}' check (levels <@ array['bachelor', 'master', 'phd']),
  -- Languages of instruction at the partner, and the level required, as the agreement states them.
  languages text[] not null default '{}' check (public.is_language_list(languages)),
  language_level text not null default '' check (char_length(language_level) <= 20),
  places integer check (places between 1 and 500),
  academic_year text not null default '' check (char_length(academic_year) <= 20),
  source text not null check (source in ('admin', 'ai', 'student')),
  source_url text not null check (source_url ~ '^https?://' and char_length(source_url) <= 500),
  verified boolean not null default false,
  last_verified date,
  created_by uuid references public.profiles (id) on delete set null,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (home_university_id <> partner_university_id),
  -- The department must belong to the home university.
  foreign key (home_department_id, home_university_id)
    references public.departments (id, university_id) on delete set null (home_department_id)
);

create unique index partnerships_agreement_idx on public.partnerships
  (home_university_id, partner_university_id, agreement_type, coalesce(home_department_id::text, ''));
create index partnerships_partner_idx on public.partnerships (partner_university_id);

-- ---------------------------------------------------------------------------
-- Course catalogues, linked to the department that teaches them

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  university_id text not null references public.universities (id) on delete cascade,
  department_id uuid,
  code text not null default '' check (char_length(code) <= 40),
  title text not null check (char_length(title) between 2 and 300),
  ects numeric(4, 1) check (ects between 0 and 60),
  level text check (level in ('bachelor', 'master', 'phd')),
  language text check (language ~ '^[a-z]{2}$'),
  term text check (term in ('fall', 'spring', 'year')),
  isced_code text check (isced_code ~ '^[0-9]{2}([0-9]{1,2})?$'),
  url text not null default '' check (char_length(url) <= 500),
  source text not null check (source in ('admin', 'ai')),
  source_url text not null check (source_url ~ '^https?://' and char_length(source_url) <= 500),
  verified boolean not null default false,
  last_verified date,
  created_at timestamptz not null default now(),
  foreign key (department_id, university_id)
    references public.departments (id, university_id) on delete set null (department_id)
);
create index courses_university_idx on public.courses (university_id, department_id);

-- ---------------------------------------------------------------------------
-- Partner-list extraction jobs (one per home university)

create table public.partner_extractions (
  university_id text primary key references public.universities (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'error')),
  found integer not null default 0,
  matched integer not null default 0,
  -- Partners on the official list that could not be matched to the catalogue (for admins).
  unmatched jsonb not null default '[]',
  sources jsonb not null default '[]',
  model text,
  error text,
  requested_by uuid references public.profiles (id) on delete set null,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security

alter table public.departments enable row level security;
alter table public.partnerships enable row level security;
alter table public.courses enable row level security;
alter table public.partner_extractions enable row level security;

-- Departments and course catalogues are general university information.
create policy "Departments are public" on public.departments
  for select to anon, authenticated using (true);
create policy "Courses are public" on public.courses
  for select to anon, authenticated using (true);

-- Agreements from official lists are public; student suggestions are for students.
create policy "Guests read agreements from official lists" on public.partnerships
  for select to anon using (not hidden and source <> 'student');
create policy "Students read agreements" on public.partnerships
  for select to authenticated using (not hidden);

-- Students suggest agreements of their own home university, with the official link.
create policy "Students suggest agreements of their university" on public.partnerships
  for insert to authenticated with check (
    created_by = auth.uid()
    and source = 'student'
    and not verified
    and last_verified is null
    and not hidden
    and home_university_id = (select p.home_university_id from public.profiles p where p.id = auth.uid())
  );

create policy "Students see extraction status" on public.partner_extractions
  for select to authenticated using (true);

-- Everything else (imports, AI extraction, review) is written by the backend.

-- Read model with the home department's name.
create view public.partner_list with (security_invoker = on) as
select p.*, d.name as home_department_name
from public.partnerships p
left join public.departments d on d.id = p.home_department_id;

grant select on public.partner_list to anon, authenticated;
