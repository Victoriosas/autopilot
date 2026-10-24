-- Shared administrative reading state; no contact details and no delivery side effects.
-- Apply individually only after review and authorization. No historical read backfill.
begin;
create table if not exists public.consultation_read_states (
  request_id uuid primary key references public.consultation_requests(id) on delete cascade,
  read_by uuid not null,
  read_at timestamptz not null default now()
);
alter table public.consultation_read_states enable row level security;
revoke all on public.consultation_read_states from public, anon, authenticated;
grant select, insert, update, delete on public.consultation_read_states to service_role;
-- Only these non-content columns are needed for the aggregate. Input remains inaccessible.
grant select (id, expires_at) on public.consultation_requests to service_role;
create or replace view public.consultation_read_metrics with (security_invoker = true) as
  select count(*) as unread_requests
  from public.consultation_requests as request
  where request.expires_at > now()
    and not exists (select 1 from public.consultation_read_states as reading where reading.request_id = request.id);
revoke all on public.consultation_read_metrics from public, anon, authenticated;
grant select on public.consultation_read_metrics to service_role;
comment on table public.consultation_read_states is 'Shared read marker set explicitly by verified administrators; deleted with the parent consultation';
commit;
