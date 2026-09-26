-- AI research requests (exchange course matching, entry requirements,
-- scholarships, visas), written only by the `research` edge function.

create table public.research_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('exchange', 'admission', 'scholarships', 'visa')),
  request jsonb not null,
  request_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'error')),
  report jsonb,
  error text,
  model text,
  cached_from uuid references public.research_requests (id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index research_requests_user_idx on public.research_requests (user_id, created_at desc);
create index research_requests_cache_idx on public.research_requests (request_hash, completed_at desc)
  where status = 'done';

alter table public.research_requests enable row level security;

create policy "Users see their own research" on public.research_requests
  for select to authenticated using (user_id = auth.uid());
