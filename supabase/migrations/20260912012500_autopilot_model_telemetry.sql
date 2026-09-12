-- Autopilot Core v4 model telemetry

create table if not exists public.model_calls (
  id bigint generated always as identity primary key,
  task_type text not null,
  provider text not null,
  model text not null,
  status text not null,
  latency_ms integer not null check (latency_ms >= 0),
  input_tokens integer,
  output_tokens integer,
  estimated_cost_usd numeric(12, 6),
  error_code text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint model_calls_status_check check (status in ('success', 'error'))
);

create index if not exists model_calls_created_at_idx on public.model_calls(created_at desc);
create index if not exists model_calls_provider_model_idx on public.model_calls(provider, model);
create index if not exists model_calls_task_type_idx on public.model_calls(task_type);

alter table public.model_calls enable row level security;

-- Deliberately no anonymous/client policy. Server-side telemetry uses the service role.
