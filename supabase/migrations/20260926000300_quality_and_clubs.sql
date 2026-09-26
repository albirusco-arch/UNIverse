-- University quality (ESG + teaching insights researched by Claude, ratings
-- from verified students, combined UNIVERSE score) and student clubs.

create table public.university_insights (
  university_id text primary key references public.universities (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'error')),
  summary text not null default '',
  esg_score integer check (esg_score between 0 and 100),
  teaching_score integer check (teaching_score between 0 and 100),
  indicators jsonb not null default '[]',
  sources jsonb not null default '[]',
  model text,
  error text,
  requested_by uuid references public.profiles (id) on delete set null,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

-- One rating per student per university, on four 1–5 dimensions.
create table public.university_ratings (
  university_id text not null references public.universities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  teaching smallint not null check (teaching between 1 and 5),
  professors smallint not null check (professors between 1 and 5),
  environment smallint not null check (environment between 1 and 5),
  sustainability smallint not null check (sustainability between 1 and 5),
  relation text not null check (relation in ('exchange', 'degree', 'researcher')),
  academic_year text not null check (char_length(academic_year) between 4 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (university_id, user_id)
);

alter table public.university_insights enable row level security;
alter table public.university_ratings enable row level security;

create policy "Insights are public" on public.university_insights
  for select to anon, authenticated using (true);

-- Individual ratings are private; only aggregates are exposed (university_scores).
create policy "Users see their own ratings" on public.university_ratings
  for select to authenticated using (user_id = auth.uid());
create policy "Users rate as themselves" on public.university_ratings
  for insert to authenticated with check (user_id = auth.uid());
create policy "Users update their own ratings" on public.university_ratings
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users delete their own ratings" on public.university_ratings
  for delete to authenticated using (user_id = auth.uid());

-- Combined UNIVERSE score (mirrors src/lib/scores.ts):
--   student score = average of the four dimensions scaled to 0–100, shown from 3 ratings;
--   score = weighted mean of the available parts: ESG 35%, teaching 25%, students 40%.
-- Runs with the owner's rights (no security_invoker) so it can aggregate ratings
-- without exposing who rated what.
create view public.university_scores as
with ratings as (
  select
    university_id,
    count(*)::int as rating_count,
    avg(teaching)::float8 as teaching_avg,
    avg(professors)::float8 as professors_avg,
    avg(environment)::float8 as environment_avg,
    avg(sustainability)::float8 as sustainability_avg
  from public.university_ratings
  group by university_id
),
parts as (
  select
    u.id as university_id,
    i.esg_score,
    i.teaching_score,
    coalesce(r.rating_count, 0) as rating_count,
    r.teaching_avg,
    r.professors_avg,
    r.environment_avg,
    r.sustainability_avg,
    case when r.rating_count >= 3 then
      round(((r.teaching_avg + r.professors_avg + r.environment_avg + r.sustainability_avg) / 4 - 1) / 4 * 100)::int
    end as student_score
  from public.universities u
  left join public.university_insights i on i.university_id = u.id
  left join ratings r on r.university_id = u.id
  where i.university_id is not null or r.university_id is not null
)
select
  parts.*,
  parts.rating_count < 3 as provisional,
  round(
    (coalesce(0.35 * esg_score, 0) + coalesce(0.25 * teaching_score, 0) + coalesce(0.40 * student_score, 0))
    / nullif(
      (case when esg_score is not null then 0.35 else 0 end)
      + (case when teaching_score is not null then 0.25 else 0 end)
      + (case when student_score is not null then 0.40 else 0 end),
      0
    )
  )::int as score
from parts;

grant select on public.university_scores to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Student clubs: found by the insights research (with a source) or added by students

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  university_id text not null references public.universities (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  name_key text generated always as (lower(name)) stored,
  category text not null default 'other' check (category in (
    'international', 'academic', 'culture', 'sports', 'tech', 'volunteering', 'arts', 'other'
  )),
  description text not null default '' check (char_length(description) <= 300),
  website text not null default '' check (char_length(website) <= 300),
  instagram text not null default '' check (char_length(instagram) <= 100),
  source text not null default 'community' check (source in ('ai', 'community')),
  source_url text not null default '',
  verified boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  report_count integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (university_id, name_key)
);

alter table public.clubs enable row level security;

create policy "Students read visible clubs" on public.clubs
  for select to authenticated using (not hidden);
create policy "Students suggest clubs" on public.clubs
  for insert to authenticated with check (
    created_by = auth.uid() and source = 'community' and not verified and report_count = 0 and not hidden
  );
