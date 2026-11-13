-- STAGED ONLY. Template assembled by scripts/hosted-ledger-sql.mjs, never db push.
-- One transaction; no auth replacement, password, role creation, admission or scheduler.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
select pg_advisory_xact_lock(204206);
do $$ begin
 if current_database()<>'postgres' or session_user<>'postgres'
   or current_setting('autopilot.provision_project',true) is distinct from 'juyowvmtluxfetgkckjd'
   or coalesce(current_setting('autopilot.provision_binding',true),'') !~ '^[a-f0-9]{64}$'
   or to_regprocedure('auth.role()') is null
   or exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public')
   or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public')
   or exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public')
   or not exists(select 1 from pg_roles where rolname='autopilot_cloud_runner' and rolcanlogin
     and not (rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls))
   or exists(select 1 from pg_auth_members where member=(select oid from pg_roles where rolname='autopilot_cloud_runner'))
 then raise exception 'fresh_isolated_hosted_ledger_required'; end if;
end $$;
revoke create on schema public from anon,authenticated,service_role,autopilot_cloud_runner;
-- LEDGER_SOURCES
create table public.autopilot_hosted_lab (
 singleton boolean primary key default true check(singleton),
 project_ref text not null check(project_ref='juyowvmtluxfetgkckjd')
);
alter table public.autopilot_hosted_lab enable row level security;
insert into public.autopilot_hosted_lab(project_ref) values('juyowvmtluxfetgkckjd');
insert into public.autopilot_local_lab(binding) values(current_setting('autopilot.provision_binding'));
-- CLOUD_GRANTS
-- Supabase may assign API grants through owner default privileges. Remove those too.
revoke all on all tables in schema public from public,anon,authenticated,service_role;
revoke all on all sequences in schema public from public,anon,authenticated,service_role;
revoke all on all functions in schema public from public,anon,authenticated,service_role;
grant select on public.autopilot_hosted_lab to autopilot_cloud_runner;
create policy cloud_hosted_identity_read on public.autopilot_hosted_lab
 for select to autopilot_cloud_runner using(true);
-- No runtime admission, direct DML, sequence access, generic queue claims or DDL.
commit;
