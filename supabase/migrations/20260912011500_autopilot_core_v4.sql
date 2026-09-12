-- Autopilot Core v4 governance persistence

create table if not exists public.agent_tasks (
  id text primary key,
  goal text not null,
  actor text not null,
  action text not null,
  status text not null,
  input jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_tasks_status_check check (status in (
    'queued', 'running', 'awaiting_approval', 'completed', 'failed', 'blocked'
  ))
);

create index if not exists agent_tasks_status_idx on public.agent_tasks(status);
create index if not exists agent_tasks_created_at_idx on public.agent_tasks(created_at desc);

create table if not exists public.agent_audit_events (
  id bigint generated always as identity primary key,
  task_id text not null references public.agent_tasks(id) on delete cascade,
  event_type text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_audit_events_task_id_idx on public.agent_audit_events(task_id);
create index if not exists agent_audit_events_created_at_idx on public.agent_audit_events(created_at desc);

alter table public.agent_tasks enable row level security;
alter table public.agent_audit_events enable row level security;

-- Deliberately no public policies. Server-side governance writes use the service role.
-- This keeps task execution and audit history unavailable to anonymous clients.
