create table if not exists public.autopilot_product_drafts (
  id uuid primary key default gen_random_uuid(),
  source_candidate_id text not null,
  status text not null default 'draft' check (status in ('draft')),
  draft jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists autopilot_product_drafts_created_at_idx
  on public.autopilot_product_drafts (created_at desc);

create index if not exists autopilot_product_drafts_source_candidate_idx
  on public.autopilot_product_drafts (source_candidate_id);

alter table public.autopilot_product_drafts enable row level security;

comment on table public.autopilot_product_drafts is
  'Server-only Autopilot commercial drafts. No frontend RLS policies by design; service role access only.';
