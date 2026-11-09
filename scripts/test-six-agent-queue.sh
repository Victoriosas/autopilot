#!/usr/bin/env bash
set -euo pipefail
: "${AUTOPILOT_TEST_DATABASE_URL:?Missing disposable PostgreSQL URL}"
psql "$AUTOPILOT_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
create schema auth;
create function auth.role() returns text language sql stable as 'select current_setting(''request.jwt.claim.role'',true)';
do $guard$ begin
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
end $guard$;
create table public.agent_tasks(
 id text primary key, goal text not null,actor text not null,action text not null,
 status text not null check(status in('queued','running','awaiting_approval','completed','failed','blocked')),
 input jsonb,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.agent_audit_events(id bigint generated always as identity primary key,
task_id text references public.agent_tasks(id),event_type text,details jsonb,created_at timestamptz default now());
SQL
psql "$AUTOPILOT_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/staged/six_agent_queue_20261025.sql
psql "$AUTOPILOT_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/staged/six_agent_mission_checkpoint_20261109.sql
psql "$AUTOPILOT_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
set request.jwt.claim.role='service_role';
insert into public.agent_tasks(id,goal,actor,action,status,agent_id,input) values
('mission-recovery-001','resume a synthetic two-step mission','test-runner','synthetic_task','queued','director',
 '{"mission_schema_version":"1","goal_version":1,"plan_version":1,"plan":[{"id":"step-1","task":"perform the first synthetic step","depends_on":[]},{"id":"step-2","task":"perform the second synthetic step","depends_on":["step-1"]}],"restrictions":["synthetic_only"]}');
create function public.reject_checkpoint_audit() returns trigger language plpgsql as $trigger$
begin
 if new.event_type='mission_checkpoint_saved'
    and current_setting('test.reject_checkpoint_audit',true)='on' then
   raise exception 'synthetic_audit_failure';
 end if;
 return new;
end $trigger$;
create trigger reject_mission_checkpoint_audit before insert on public.agent_audit_events
for each row execute function public.reject_checkpoint_audit();
create table public.mission_recovery_test_state(key text primary key,value text not null);
do $$
declare first_token uuid; got_id text; payload jsonb;
declare first_checkpoint jsonb; result boolean; audit_before integer;
begin
 select task_id,claim_token,task_payload into got_id,first_token,payload
 from public.six_agent_claim('director',5);
 if got_id is distinct from 'mission-recovery-001' or first_token is null then
   raise exception 'mission first claim missing';
 end if;
 if payload->'__autopilot'->>'mission_id' is distinct from got_id
    or payload->'__autopilot'->>'checkpoint_version' is distinct from '0' then
   raise exception 'mission context missing from claim';
 end if;

 first_checkpoint='{"mission_state":"in_progress","current_step_id":"step-1","completed_steps":[],"pending_steps":["step-1","step-2"],"results":[],"artifacts":[],"test_evidence":[],"worktree":{"branch":"test/mission-recovery","sha":"synthetic-base"}}'::jsonb;
 select public.six_agent_checkpoint(got_id,'another-mission',first_token,1,
   'mission-op-0001','worker-old',first_checkpoint) into result;
 if result then raise exception 'checkpoint accepted for wrong mission'; end if;
 select public.six_agent_checkpoint(got_id,got_id,gen_random_uuid(),1,
   'mission-op-0001','worker-old',first_checkpoint) into result;
 if result then raise exception 'checkpoint accepted wrong token'; end if;

 select public.six_agent_checkpoint(got_id,got_id,first_token,1,
   'mission-op-0001','worker-old',first_checkpoint) into result;
 if not result then raise exception 'initial mission checkpoint rejected'; end if;
 select count(*) into audit_before from public.agent_audit_events
 where task_id=got_id and event_type='mission_checkpoint_saved';
 select public.six_agent_checkpoint(got_id,got_id,first_token,1,
   'mission-op-0001','worker-old',first_checkpoint) into result;
 if not result then raise exception 'same checkpoint replay was not idempotent'; end if;
 select public.six_agent_checkpoint(got_id,got_id,first_token,1,
   'mission-op-0001','worker-old',
   jsonb_set(first_checkpoint,'{worktree,sha}','"tampered"'::jsonb)) into result;
 if result then raise exception 'operation id was reused with different checkpoint content'; end if;
 if (select count(*) from public.agent_audit_events
     where task_id=got_id and event_type='mission_checkpoint_saved')<>audit_before then
   raise exception 'idempotent replay duplicated audit';
 end if;
 select public.six_agent_checkpoint(got_id,got_id,first_token,3,
   'mission-op-stale','worker-old',first_checkpoint) into result;
 if result then raise exception 'obsolete checkpoint version accepted'; end if;
 select public.six_agent_checkpoint(got_id,got_id,first_token,2,
   'mission-op-invalid','worker-old',
   jsonb_set(first_checkpoint,'{current_step_id}','"step-2"'::jsonb)) into result;
 if result then raise exception 'invalid step transition accepted'; end if;
 insert into public.mission_recovery_test_state values('old_token',first_token::text);
end $$;
select pg_sleep(5.2);
do $$
declare first_token uuid; recovery_token uuid; got_id text; payload jsonb;
declare first_checkpoint jsonb; second_checkpoint jsonb; final_checkpoint jsonb;
declare result boolean; saved_version integer;
begin
 select value::uuid into first_token from public.mission_recovery_test_state where key='old_token';
 first_checkpoint='{"mission_state":"in_progress","current_step_id":"step-1","completed_steps":[],"pending_steps":["step-1","step-2"],"results":[],"artifacts":[],"test_evidence":[],"worktree":{"branch":"test/mission-recovery","sha":"synthetic-base"}}'::jsonb;
 select public.six_agent_checkpoint('mission-recovery-001','mission-recovery-001',first_token,2,
   'mission-op-expired','worker-old',first_checkpoint) into result;
 if result then raise exception 'expired lease checkpoint accepted'; end if;
 select task_id,claim_token,task_payload into got_id,recovery_token,payload
 from public.six_agent_claim('director',60);
 if got_id is distinct from 'mission-recovery-001' or recovery_token is null then
   raise exception 'mission recovery claim missing';
 end if;
 if payload->'__autopilot'->>'checkpoint_version' is distinct from '1'
    or payload->'__autopilot'->'checkpoint' is distinct from first_checkpoint then
   raise exception 'last confirmed checkpoint not recovered';
 end if;
 select public.six_agent_checkpoint(got_id,got_id,first_token,2,
   'mission-op-stale-token','worker-old',first_checkpoint) into result;
 if result then raise exception 'old fencing token accepted after recovery'; end if;
 select public.six_agent_complete(got_id,first_token,'stale completion') into result;
 if result then raise exception 'old fencing token completed recovered mission'; end if;
 select public.six_agent_fail(got_id,first_token,'stale_worker') into result;
 if result then raise exception 'old fencing token failed recovered mission'; end if;

 second_checkpoint='{"mission_state":"in_progress","current_step_id":"step-2","completed_steps":["step-1"],"pending_steps":["step-2"],"results":[{"step_id":"step-1","status":"passed","summary":"synthetic step passed"}],"artifacts":[],"test_evidence":["step-1:passed"],"worktree":{"branch":"test/mission-recovery","sha":"synthetic-after-step-1"}}'::jsonb;
 perform set_config('test.reject_checkpoint_audit','on',true);
 begin
   perform public.six_agent_checkpoint(got_id,got_id,recovery_token,2,
     'mission-op-0002','worker-new',second_checkpoint);
   raise exception 'checkpoint audit failure was not injected';
 exception when others then
   if sqlerrm='checkpoint audit failure was not injected' then raise; end if;
   if sqlerrm not like '%synthetic_audit_failure%' then raise; end if;
 end;
 perform set_config('test.reject_checkpoint_audit','off',true);
 select mission_checkpoint_version into saved_version from public.agent_tasks where id=got_id;
 if saved_version<>1 or (select count(*) from public.agent_audit_events
   where task_id=got_id and event_type='mission_checkpoint_saved')<>1 then
   raise exception 'checkpoint state committed without audit';
 end if;

 select public.six_agent_checkpoint(got_id,got_id,recovery_token,2,
   'mission-op-0002','worker-new',second_checkpoint) into result;
 if not result then raise exception 'continuation checkpoint rejected'; end if;
 final_checkpoint='{"mission_state":"ready_to_complete","current_step_id":null,"completed_steps":["step-1","step-2"],"pending_steps":[],"results":[{"step_id":"step-1","status":"passed","summary":"synthetic step passed"},{"step_id":"step-2","status":"passed","summary":"synthetic step passed"}],"artifacts":[],"test_evidence":["step-1:passed","step-2:passed"],"worktree":{"branch":"test/mission-recovery","sha":"synthetic-final"}}'::jsonb;
 select public.six_agent_checkpoint(got_id,got_id,recovery_token,3,
   'mission-op-0003','worker-new',final_checkpoint) into result;
 if not result then raise exception 'final mission checkpoint rejected'; end if;
 select public.six_agent_complete(got_id,recovery_token,'synthetic mission verified') into result;
 if not result then raise exception 'complete mission rejected'; end if;
 select mission_checkpoint_version into saved_version from public.agent_tasks where id=got_id;
 if (select status from public.agent_tasks where id=got_id)<>'completed'
    or saved_version<>4
    or (select mission_checkpoint->>'mission_state' from public.agent_tasks where id=got_id)<>'completed' then
   raise exception 'mission did not reach final state';
 end if;
 if (select count(*) from public.agent_audit_events
     where task_id=got_id and event_type='mission_checkpoint_saved')<>3 then
   raise exception 'mission checkpoint audit sequence incomplete';
 end if;
 if (select count(*) from public.agent_audit_events where task_id=got_id and event_type='six_agent_complete')<>1 then
   raise exception 'mission completion was duplicated or unaudited';
 end if;
 if (select array_agg(event_type order by id) from public.agent_audit_events where task_id=got_id)
    is distinct from array['six_agent_claim','mission_checkpoint_saved','six_agent_claim',
      'mission_checkpoint_saved','mission_checkpoint_saved','six_agent_complete']::text[] then
   raise exception 'mission audit sequence is incorrect';
 end if;
end $$;

SQL
concurrent_claim="$(psql -qAt "$AUTOPILOT_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
set request.jwt.claim.role='service_role';
insert into public.agent_tasks(id,goal,actor,action,status,agent_id,input) values
('mission-concurrency-001','concurrent synthetic checkpoint','test-runner','synthetic_task','queued','director',
 '{"mission_schema_version":"1","goal_version":1,"plan_version":1,"plan":[{"id":"step-1","task":"concurrent checkpoint","depends_on":[]}]}');
select task_id||'|'||claim_token from public.six_agent_claim('director',60);
SQL
)"
if [[ "$concurrent_claim" != mission-concurrency-001\|* ]]; then
 echo 'Unable to claim concurrent checkpoint fixture' >&2
 exit 1
fi
concurrent_token="${concurrent_claim#*|}"
concurrent_output_one="$(mktemp)"
concurrent_output_two="$(mktemp)"
trap 'rm -f "$concurrent_output_one" "$concurrent_output_two"' EXIT
psql -qAt "$AUTOPILOT_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 >"$concurrent_output_one" <<SQL &
set request.jwt.claim.role='service_role';
select public.six_agent_checkpoint('mission-concurrency-001','mission-concurrency-001',
 '$concurrent_token',1,'concurrent-op-0001','synthetic-concurrency-worker',
 '{"mission_state":"in_progress","current_step_id":"step-1","completed_steps":[],"pending_steps":["step-1"],"results":[],"artifacts":[],"test_evidence":[],"worktree":{"branch":"test/concurrent","sha":"synthetic-base"}}'::jsonb);
SQL
concurrent_pid_one=$!
psql -qAt "$AUTOPILOT_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 >"$concurrent_output_two" <<SQL &
set request.jwt.claim.role='service_role';
select public.six_agent_checkpoint('mission-concurrency-001','mission-concurrency-001',
 '$concurrent_token',1,'concurrent-op-0001','synthetic-concurrency-worker',
 '{"mission_state":"in_progress","current_step_id":"step-1","completed_steps":[],"pending_steps":["step-1"],"results":[],"artifacts":[],"test_evidence":[],"worktree":{"branch":"test/concurrent","sha":"synthetic-base"}}'::jsonb);
SQL
concurrent_pid_two=$!
wait "$concurrent_pid_one"
wait "$concurrent_pid_two"
if ! grep -qx 't' "$concurrent_output_one" || ! grep -qx 't' "$concurrent_output_two"; then
 echo 'Concurrent idempotent checkpoint writes were not both accepted' >&2
 exit 1
fi
concurrent_state="$(psql -qAt "$AUTOPILOT_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
select mission_checkpoint_version::text||'|'||
 (select count(*) from public.agent_audit_events
  where task_id='mission-concurrency-001' and event_type='mission_checkpoint_saved')
from public.agent_tasks where id='mission-concurrency-001';
SQL
)"
if [[ "$concurrent_state" != '1|1' ]]; then
 echo 'Concurrent checkpoint duplicated version or audit event' >&2
 exit 1
fi
rm -f "$concurrent_output_one" "$concurrent_output_two"
trap - EXIT

psql "$AUTOPILOT_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
set request.jwt.claim.role='service_role';
do $$
begin
 if (select mission_checkpoint_version from public.agent_tasks where id='mission-concurrency-001')<>1
    or (select count(*) from public.agent_audit_events
        where task_id='mission-concurrency-001' and event_type='mission_checkpoint_saved')<>1 then
   raise exception 'concurrent checkpoint result is inconsistent';
 end if;
end $$;
drop trigger reject_mission_checkpoint_audit on public.agent_audit_events;
drop function public.reject_checkpoint_audit();
reset request.jwt.claim.role;
do $$
begin
 begin
   perform public.six_agent_checkpoint('mission-recovery-001','mission-recovery-001',
     gen_random_uuid(),1,'mission-op-denied','unauthorized-worker','{}'::jsonb);
   raise exception 'unauthorized checkpoint caller was accepted';
 exception when others then
   if sqlerrm='unauthorized checkpoint caller was accepted' then raise; end if;
   if sqlerrm not like '%unauthorized%' then raise; end if;
 end;
end $$;
SQL
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
psql "$AUTOPILOT_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/staged/six_agent_public_health_claim_20261025.sql
psql "$AUTOPILOT_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
set request.jwt.claim.role='service_role';
insert into public.agent_tasks(id,goal,actor,action,status,agent_id,input) values
 ('six-health:infrastructure:fixture','synthetic site health','six-agent-safe-worker','read_only_public_health','queued','infrastructure','{"kind":"public_site_health","synthetic":true}'),
 ('other-infrastructure','unrelated task','codex','real_action','queued','infrastructure','{"synthetic":true}');
do $$
declare got_id text; tok uuid; duplicates integer; completed boolean;
begin
 select task_id,claim_token into got_id,tok from public.six_agent_claim_public_health(90);
 if got_id is distinct from 'six-health:infrastructure:fixture' or tok is null then
   raise exception 'specific health claim failed';
 end if;
 select count(*) into duplicates from public.six_agent_claim_public_health(90);
 if duplicates<>0 then raise exception 'duplicate health claim'; end if;
 if (select status from public.agent_tasks where id='other-infrastructure')<>'queued' then
   raise exception 'unsafe claim of unrelated task'; end if;
 select public.six_agent_complete(got_id,gen_random_uuid(),'wrong_token') into completed;
 if completed then raise exception 'fencing failed'; end if;
 select public.six_agent_complete(got_id,tok,'site_http_200_brand_verified') into completed;
 if not completed then raise exception 'safe completion missing'; end if;
 if (select count(*) from public.agent_audit_events where task_id=got_id)<>2 then
   raise exception 'safe audit trail missing'; end if;
end $$;
reset request.jwt.claim.role;
SQL
echo 'six-agent atomic queue and restricted health claim smoke tests passed'
