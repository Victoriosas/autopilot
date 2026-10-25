#!/usr/bin/env bash
set -euo pipefail
: "${AUTOPILOT_TEST_DATABASE_URL:?Missing disposable PostgreSQL URL}"
psql "$AUTOPILOT_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
create schema auth;
create function auth.role() returns text language sql stable as 'select current_setting(''request.jwt.claim.role'',true)';
do $ begin
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
end $;
create table public.agent_tasks(
 id text primary key, goal text not null,actor text not null,action text not null,
 status text not null check(status in('queued','running','awaiting_approval','completed','failed','blocked')),
 input jsonb,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.agent_audit_events(id bigint generated always as identity primary key,
task_id text references public.agent_tasks(id),event_type text,details jsonb,created_at timestamptz default now());
SQL
psql "$AUTOPILOT_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/staged/six_agent_queue_20261025.sql
psql "$AUTOPILOT_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
set request.jwt.claim.role='service_role';
insert into public.agent_tasks(id,goal,actor,action,status,agent_id,input) values
('test-agent-001','test','codex','analyze','queued','director','{"synthetic":true}'::jsonb);
do $$
declare first_token uuid; second_claim integer; completed boolean;
begin
 select claim_token into first_token from public.six_agent_claim('director',60);
 if first_token is null then raise exception 'first claim missing'; end if;
 select count(*) into second_claim from public.six_agent_claim('director',60);
 if second_claim <> 0 then raise exception 'duplicate claim'; end if;
 select public.six_agent_complete('test-agent-001',gen_random_uuid(),'fake') into completed;
 if completed then raise exception 'stale token accepted'; end if;
 select public.six_agent_complete('test-agent-001',first_token,'verified:synthetic') into completed;
 if not completed then raise exception 'valid completion rejected'; end if;
 if (select count(*) from public.agent_audit_events where task_id='test-agent-001')<>2 then raise exception 'audit events missing'; end if;
end $$;
reset request.jwt.claim.role;
SQL
echo 'six-agent atomic queue smoke test passed'
