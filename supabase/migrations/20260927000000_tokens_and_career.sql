-- Tokens bought with in-app purchases, and the AI career tools they pay for:
-- CV review and opportunity matching (jobs, internships, programmes).
-- Balances live in an append-only ledger that only the backend writes.

-- ---------------------------------------------------------------------------
-- Career links on the profile (visible to other students, for networking)

alter table public.profiles
  add column linkedin_url text not null default ''
    check (linkedin_url = '' or linkedin_url ~ '^https://([a-z]{2,3}\.)?linkedin\.com/in/[A-Za-z0-9%_-]+/?$'),
  add column handshake_url text not null default ''
    check (handshake_url = '' or handshake_url ~ '^https://([a-z0-9-]+\.)*joinhandshake\.com(/\S*)?$'),
  add column jobteaser_url text not null default ''
    check (jobteaser_url = '' or jobteaser_url ~ '^https://([a-z0-9-]+\.)*jobteaser\.com(/\S*)?$'),
  add column open_to_opportunities boolean not null default false;

grant update (linkedin_url, handshake_url, jobteaser_url, open_to_opportunities) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Token catalogue: store products and what each AI feature costs

create table public.token_products (
  product_id text primary key,
  tokens integer not null check (tokens > 0),
  sort_order integer not null default 0,
  active boolean not null default true
);

create table public.ai_features (
  feature text primary key,
  cost integer not null check (cost >= 0),
  -- Uses per day before the feature starts costing tokens.
  free_per_day integer not null default 0 check (free_per_day >= 0)
);

insert into public.token_products (product_id, tokens, sort_order) values
  ('universe_tokens_10', 10, 1),
  ('universe_tokens_30', 30, 2),
  ('universe_tokens_100', 100, 3);

insert into public.ai_features (feature, cost, free_per_day) values
  ('cv_review', 2, 0),
  ('opportunity_match', 3, 0),
  ('research', 1, 3);

alter table public.token_products enable row level security;
alter table public.ai_features enable row level security;

create policy "Students see active products" on public.token_products
  for select to authenticated using (active);
create policy "Students see feature prices" on public.ai_features
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Ledger

create table public.token_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('welcome', 'purchase', 'refund', 'refund_reversed', 'spend', 'spend_refund', 'grant')),
  feature text,
  product_id text,
  -- Store transaction id (purchases, refunds): makes store notifications idempotent.
  transaction_id text,
  -- AI job paid for (spends and their refunds when the job fails).
  job_id uuid,
  environment text,
  created_at timestamptz not null default now()
);
create unique index token_ledger_transaction_idx on public.token_ledger (reason, transaction_id)
  where transaction_id is not null;
create unique index token_ledger_job_idx on public.token_ledger (reason, job_id)
  where job_id is not null;
create index token_ledger_user_idx on public.token_ledger (user_id, created_at desc);

alter table public.token_ledger enable row level security;

-- Students read their own history; every write goes through the functions below.
create policy "Students see their own ledger" on public.token_ledger
  for select to authenticated using (user_id = auth.uid());

create function public.token_balance(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(delta), 0)::integer from public.token_ledger where user_id = p_user;
$$;

create function public.my_token_balance()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(delta), 0)::integer from public.token_ledger where user_id = auth.uid();
$$;

-- Charges a feature for one AI job. Raises 'insufficient_tokens' when the
-- balance is too low; returns the new balance.
create function public.spend_tokens(p_user uuid, p_feature text, p_job uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cost integer;
  v_balance integer;
begin
  select cost into v_cost from public.ai_features where feature = p_feature;
  if v_cost is null then
    raise exception 'unknown_feature';
  end if;
  -- One spend at a time per student, so two requests cannot both pass the check.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  v_balance := public.token_balance(p_user);
  if v_cost = 0 then
    return v_balance;
  end if;
  if v_balance < v_cost then
    raise exception 'insufficient_tokens' using detail = format('balance %s, cost %s', v_balance, v_cost);
  end if;
  insert into public.token_ledger (user_id, delta, reason, feature, job_id)
  values (p_user, -v_cost, 'spend', p_feature, p_job);
  return v_balance - v_cost;
end;
$$;

-- Gives the tokens back when a paid AI job fails (once per job).
create function public.refund_spend(p_job uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.token_ledger (user_id, delta, reason, feature, job_id)
  select user_id, -delta, 'spend_refund', feature, job_id
  from public.token_ledger
  where reason = 'spend' and job_id = p_job
  on conflict (reason, job_id) where job_id is not null do nothing;
$$;

-- Credits a store purchase once per transaction. Returns the tokens granted
-- (0 for an unknown product or user, or a transaction already credited).
create function public.grant_purchase(p_user uuid, p_product text, p_transaction text, p_environment text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tokens integer;
  v_rows integer;
begin
  select tokens into v_tokens from public.token_products where product_id = p_product;
  if v_tokens is null or not exists (select 1 from public.profiles where id = p_user) then
    return 0;
  end if;
  insert into public.token_ledger (user_id, delta, reason, product_id, transaction_id, environment)
  values (p_user, v_tokens, 'purchase', p_product, p_transaction, p_environment)
  on conflict (reason, transaction_id) where transaction_id is not null do nothing;
  get diagnostics v_rows = row_count;
  return case when v_rows > 0 then v_tokens else 0 end;
end;
$$;

-- Removes the tokens of a refunded purchase (the balance may go negative,
-- which blocks spending until more tokens are bought).
create function public.refund_purchase(p_transaction text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  insert into public.token_ledger (user_id, delta, reason, product_id, transaction_id, environment)
  select user_id, -delta, 'refund', product_id, transaction_id, environment
  from public.token_ledger
  where reason = 'purchase' and transaction_id = p_transaction
  on conflict (reason, transaction_id) where transaction_id is not null do nothing;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

-- Restores the tokens when the store reverses a refund.
create function public.reverse_refund(p_transaction text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  insert into public.token_ledger (user_id, delta, reason, product_id, transaction_id, environment)
  select user_id, -delta, 'refund_reversed', product_id, transaction_id, environment
  from public.token_ledger
  where reason = 'refund' and transaction_id = p_transaction
  on conflict (reason, transaction_id) where transaction_id is not null do nothing;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

revoke execute on function public.token_balance(uuid) from public, anon, authenticated;
revoke execute on function public.spend_tokens(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.refund_spend(uuid) from public, anon, authenticated;
revoke execute on function public.grant_purchase(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.refund_purchase(text) from public, anon, authenticated;
revoke execute on function public.reverse_refund(text) from public, anon, authenticated;
grant execute on function public.token_balance(uuid) to service_role;
grant execute on function public.spend_tokens(uuid, text, uuid) to service_role;
grant execute on function public.refund_spend(uuid) to service_role;
grant execute on function public.grant_purchase(uuid, text, text, text) to service_role;
grant execute on function public.refund_purchase(text) to service_role;
grant execute on function public.reverse_refund(text) to service_role;
revoke execute on function public.my_token_balance() from public, anon;
grant execute on function public.my_token_balance() to authenticated;

-- Welcome tokens so every new student can try a CV review.
create function public.grant_welcome_tokens()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.token_ledger (user_id, delta, reason) values (new.id, 3, 'welcome');
  return new;
end;
$$;

create trigger on_profile_created_grant_tokens
  after insert on public.profiles
  for each row execute function public.grant_welcome_tokens();

-- ---------------------------------------------------------------------------
-- CV: one PDF per student in the private "cvs" bucket, under <user id>/

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cvs', 'cvs', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy "Students manage their own CV files" on storage.objects
  for all to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);

create table public.cv_files (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  path text not null check (path like user_id::text || '/%'),
  file_name text not null check (char_length(file_name) between 1 and 200),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  uploaded_at timestamptz not null default now()
);

alter table public.cv_files enable row level security;

create policy "Students see their CV" on public.cv_files
  for select to authenticated using (user_id = auth.uid());
create policy "Students add their CV" on public.cv_files
  for insert to authenticated with check (user_id = auth.uid());
create policy "Students replace their CV" on public.cv_files
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Students remove their CV" on public.cv_files
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- AI jobs, written only by the edge functions (service role)

create table public.cv_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  request jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'error')),
  report jsonb,
  error text,
  model text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index cv_reviews_user_idx on public.cv_reviews (user_id, created_at desc);

create table public.opportunity_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  request jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'error')),
  report jsonb,
  error text,
  model text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index opportunity_searches_user_idx on public.opportunity_searches (user_id, created_at desc);

alter table public.cv_reviews enable row level security;
alter table public.opportunity_searches enable row level security;

create policy "Students see their CV reviews" on public.cv_reviews
  for select to authenticated using (user_id = auth.uid());
create policy "Students see their opportunity searches" on public.opportunity_searches
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Saved opportunities (a snapshot, so they survive new searches)

create table public.saved_opportunities (
  user_id uuid not null references public.profiles (id) on delete cascade,
  url text not null check (url ~ '^https?://' and char_length(url) <= 1000),
  opportunity jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, url)
);

alter table public.saved_opportunities enable row level security;

create policy "Students see their saved opportunities" on public.saved_opportunities
  for select to authenticated using (user_id = auth.uid());
create policy "Students save opportunities" on public.saved_opportunities
  for insert to authenticated with check (user_id = auth.uid());
create policy "Students remove saved opportunities" on public.saved_opportunities
  for delete to authenticated using (user_id = auth.uid());
