-- Administrative case progression. Customer data remains only in consultation_requests.
create table if not exists public.consultation_case_states (
  request_id uuid primary key references public.consultation_requests(id) on delete cascade,
  status text not null check(status in ('new','in_review','awaiting_contact','answered','closed')),
  updated_by uuid not null,
  updated_at timestamptz not null default now()
);
alter table public.consultation_case_states enable row level security;
revoke all on public.consultation_case_states from public, anon, authenticated;
grant select, insert, update on public.consultation_case_states to service_role;
comment on table public.consultation_case_states is 'Administrator-controlled case workflow; no PII; expires with parent consultation';
create index if not exists consultation_case_states_updated_at_idx on public.consultation_case_states(updated_at);
