-- Synthetic inbox prerequisite for the first isolated hosted test only.
-- Not a production migration. No customer data, delivery or new work queue.
begin;
do $$ begin
 if current_setting('autopilot.isolated_project_ref',true) is distinct from 'juyowvmtluxfetgkckjd' then
  raise exception 'explicit_isolated_ledger_required';
 end if;
 if to_regclass('public.consultation_requests') is not null then
  raise exception 'existing_inbox_must_be_preserved';
 end if;
end $$;
create table public.consultation_requests(
 id uuid primary key,
 expires_at timestamptz not null,
 input jsonb not null default '{}'::jsonb
);
comment on table public.consultation_requests is 'cloud_v3_synthetic_fixture_only_no_customer_data';
alter table public.consultation_requests enable row level security;
revoke all on public.consultation_requests from public,anon,authenticated;
insert into public.consultation_requests(id,expires_at)
 values('00000000-0000-4000-8000-000000000003',clock_timestamp()+interval '1 hour');
commit;
-- Do not populate this relation with real inquiries. Counts in this isolated
-- project are synthetic and must be labeled as such in the hosted receipt.
