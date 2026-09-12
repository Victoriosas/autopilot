create table if not exists public.autopilot_repricing_proposals (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  status text not null check (status in ('pending','ai_approved','rejected','applied')) default 'pending',
  proposal jsonb not null,
  council jsonb,
  reviewed_by text,
  reviewed_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists autopilot_repricing_proposals_product_id_idx
  on public.autopilot_repricing_proposals(product_id);

create index if not exists autopilot_repricing_proposals_status_idx
  on public.autopilot_repricing_proposals(status);

alter table public.autopilot_repricing_proposals enable row level security;

-- Intentionally no frontend policies. This table is server/service-role only.
