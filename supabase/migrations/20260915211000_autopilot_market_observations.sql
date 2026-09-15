create table if not exists public.autopilot_market_observations (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  title text not null,
  url text not null,
  price_uyu numeric(12,2) not null check (price_uyu >= 100 and price_uyu <= 1000000),
  source text not null default 'curated_web_research',
  observed_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_by text not null default 'autopilot_owner_research',
  created_at timestamptz not null default now(),
  constraint autopilot_market_observations_url_nonempty check (length(trim(url)) > 0),
  constraint autopilot_market_observations_title_nonempty check (length(trim(title)) > 0),
  constraint autopilot_market_observations_expiry check (expires_at > observed_at)
);

create index if not exists autopilot_market_observations_fresh_idx
  on public.autopilot_market_observations (expires_at desc, observed_at desc);
create index if not exists autopilot_market_observations_query_idx
  on public.autopilot_market_observations (query);

create unique index if not exists autopilot_market_observations_url_observed_uidx
  on public.autopilot_market_observations (url, observed_at);

alter table public.autopilot_market_observations enable row level security;
revoke all on table public.autopilot_market_observations from anon, authenticated;
grant select, insert, update, delete on table public.autopilot_market_observations to service_role;

comment on table public.autopilot_market_observations is
  'Durable, source-linked Uruguay market price observations used as evidence. Never treated as supplier inventory or audited sales.';
comment on column public.autopilot_market_observations.price_uyu is
  'Observed retail asking price in Uruguayan pesos from the linked source at observed_at.';
