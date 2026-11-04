create table if not exists public.autopilot_catalog_observations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  observed_at timestamptz not null default now(),
  source text not null,
  severity text not null check (severity in ('info','warning','critical')),
  current_price numeric not null,
  observed_supplier_cost numeric,
  observed_stock integer,
  signals jsonb not null default '[]'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists autopilot_catalog_observations_product_id_idx
  on public.autopilot_catalog_observations(product_id, observed_at desc);

alter table public.autopilot_catalog_observations enable row level security;

comment on table public.autopilot_catalog_observations is
  'Server-only immutable snapshots of catalog observations used by Autopilot governance.';
