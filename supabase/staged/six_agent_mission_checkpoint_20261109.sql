-- Versioned mission state on the existing six-agent queue.
-- Staged for local/CI validation only; do not apply to hosted Supabase without review.
alter table public.agent_tasks
 add column if not exists mission_id text,
 add column if not exists mission_checkpoint jsonb not null
   default '{"mission_state":"queued","completed_steps":[],"pending_steps":[],"results":[],"artifacts":[],"test_evidence":[]}'::jsonb,
 add column if not exists mission_checkpoint_version integer not null default 0,
 add column if not exists last_checkpoint_operation_id text,
 add column if not exists last_checkpoint_hash text,
 add column if not exists last_checkpoint_executor_id text;

update public.agent_tasks set mission_id=id where mission_id is null;
alter table public.agent_tasks alter column mission_id set not null;
create or replace function public.autopilot_set_mission_id()
returns trigger language plpgsql set search_path = ''
as $$
begin
 if new.mission_id is null then new.mission_id:=new.id; end if;
 return new;
end $$;
drop trigger if exists autopilot_set_mission_id on public.agent_tasks;
create trigger autopilot_set_mission_id before insert on public.agent_tasks
for each row execute function public.autopilot_set_mission_id();
alter table public.agent_tasks
 add constraint agent_tasks_mission_checkpoint_version_check
 check (mission_checkpoint_version>=0);
create unique index if not exists agent_tasks_mission_id_uidx
 on public.agent_tasks(mission_id);
create unique index if not exists agent_audit_mission_checkpoint_operation_uidx
 on public.agent_audit_events(task_id,(details->>'operation_id'))
 where event_type='mission_checkpoint_saved';

create or replace function public.six_agent_claim(p_agent text,p_lease_seconds integer default 60)
returns table(task_id text, claim_token uuid, task_payload jsonb)
language plpgsql security definer set search_path = ''
as $$
declare v_id text; v_token uuid;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'unauthorized'; end if;
 if p_agent not in ('director','software','infrastructure','consultations','followup','reports')
    or p_lease_seconds not between 5 and 300 then raise exception 'invalid_parameters'; end if;
 if p_agent='consultations' then return; end if;
 select t.id into v_id from public.agent_tasks t
 where t.agent_id=p_agent and t.attempt_count<t.max_attempts and
 ((t.status in ('queued','failed') and t.available_at<=now())
  or (t.status='running' and t.lease_until<now() and t.execution_token is not null))
 order by t.created_at asc limit 1 for update skip locked;
 if v_id is null then return; end if;
 v_token:=gen_random_uuid();
 update public.agent_tasks t set status='running',attempt_count=t.attempt_count+1,
 lease_until=now()+make_interval(secs=>p_lease_seconds),execution_token=v_token,updated_at=now()
 where t.id=v_id;
 insert into public.agent_audit_events(task_id,event_type,details)
 values(v_id,'six_agent_claim',jsonb_build_object('agent',p_agent,'attempt','claimed'));
 return query
 select t.id,t.execution_token,
   (case when jsonb_typeof(t.input)='object' then t.input else '{}'::jsonb end)
   || jsonb_build_object('__autopilot',jsonb_build_object(
     'mission_id',t.mission_id,
     'checkpoint_version',t.mission_checkpoint_version,
     'checkpoint',t.mission_checkpoint,
     'spec_version',t.input->>'mission_schema_version'))
 from public.agent_tasks t where t.id=v_id;
end $$;

create or replace function public.six_agent_checkpoint(
 p_task_id text,p_mission_id text,p_token uuid,p_checkpoint_version integer,
 p_operation_id text,p_executor_id text,p_checkpoint jsonb
)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_task public.agent_tasks%rowtype;
declare v_plan_count integer; v_completed_count integer; v_pending_count integer;
declare v_union_count integer; v_distinct_count integer; v_member_count integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'unauthorized'; end if;
 if p_checkpoint_version is null or p_checkpoint_version<1
    or p_operation_id is null or p_executor_id is null
    or p_operation_id !~ '^[a-zA-Z0-9:_-]{8,128}$'
    or p_executor_id !~ '^[a-zA-Z0-9._:-]{1,80}$'
    or p_checkpoint is null or pg_column_size(p_checkpoint)>65536 then
   raise exception 'invalid_checkpoint_parameters';
 end if;

 select * into v_task from public.agent_tasks where id=p_task_id for update;
 if not found or v_task.mission_id is distinct from p_mission_id
    or v_task.status is distinct from 'running'
    or v_task.execution_token is distinct from p_token
    or v_task.lease_until is null or v_task.lease_until<=clock_timestamp()
    or v_task.input->>'mission_schema_version' is distinct from '1'
    or nullif(btrim(v_task.goal),'') is null
    or v_task.input->>'goal_version' is null
    or v_task.input->>'goal_version' !~ '^[1-9][0-9]{0,8}$'
    or v_task.input->>'plan_version' is null
    or v_task.input->>'plan_version' !~ '^[1-9][0-9]{0,8}$' then
   return false;
 end if;

 if jsonb_typeof(p_checkpoint) is distinct from 'object'
    or not (p_checkpoint ? 'mission_state')
    or p_checkpoint->>'mission_state' not in ('in_progress','ready_to_complete')
    or jsonb_typeof(p_checkpoint->'completed_steps') is distinct from 'array'
    or jsonb_typeof(p_checkpoint->'pending_steps') is distinct from 'array'
    or jsonb_typeof(p_checkpoint->'results') is distinct from 'array'
    or jsonb_typeof(p_checkpoint->'artifacts') is distinct from 'array'
    or jsonb_typeof(p_checkpoint->'test_evidence') is distinct from 'array'
    or jsonb_typeof(p_checkpoint->'worktree'->'branch') is distinct from 'string'
    or jsonb_typeof(p_checkpoint->'worktree'->'sha') is distinct from 'string'
    or not (p_checkpoint ? 'current_step_id')
    or jsonb_typeof(p_checkpoint->'current_step_id') not in ('string','null')
    or jsonb_typeof(p_checkpoint->'worktree') is distinct from 'object'
    or jsonb_typeof(v_task.input->'plan') is distinct from 'array' then
   return false;
 end if;

 if exists (
   select 1 from jsonb_array_elements(p_checkpoint->'completed_steps') s(value)
   where jsonb_typeof(s.value) is distinct from 'string'
 ) or exists (
   select 1 from jsonb_array_elements(p_checkpoint->'pending_steps') s(value)
   where jsonb_typeof(s.value) is distinct from 'string'
 ) or exists (
   select 1 from jsonb_array_elements(v_task.input->'plan') step(value)
   where jsonb_typeof(step.value) is distinct from 'object'
      or jsonb_typeof(step.value->'id') is distinct from 'string'
      or step.value->>'id' !~ '^[a-zA-Z0-9._:-]{1,80}$'
      or jsonb_typeof(step.value->'task') is distinct from 'string'
      or (step.value ? 'depends_on' and jsonb_typeof(step.value->'depends_on') is distinct from 'array')
 ) then
   return false;
 end if;
 if exists (
   select 1 from jsonb_array_elements(p_checkpoint->'results') result(value)
   where jsonb_typeof(result.value) is distinct from 'object'
      or jsonb_typeof(result.value->'step_id') is distinct from 'string'
      or jsonb_typeof(result.value->'status') is distinct from 'string'
      or result.value->>'status' not in ('passed','failed','blocked')
      or jsonb_typeof(result.value->'summary') is distinct from 'string'
 ) or exists (
   select 1 from jsonb_array_elements(p_checkpoint->'artifacts') artifact(value)
   where jsonb_typeof(artifact.value) is distinct from 'string'
 ) or exists (
   select 1 from jsonb_array_elements(p_checkpoint->'test_evidence') evidence(value)
   where jsonb_typeof(evidence.value) is distinct from 'string'
      or btrim(evidence.value #>> '{}')=''
 ) then
   return false;
 end if;

 select count(*) into v_plan_count from jsonb_array_elements(v_task.input->'plan');
 if v_plan_count=0 then return false; end if;
 if (
   select count(*)<>count(distinct step.value->>'id')
   from jsonb_array_elements(v_task.input->'plan') step(value)
 ) then return false; end if;
 if exists (
   with recursive dependency_paths(root_id,node_id,path,cycle) as (
     select step.value->>'id',dep.id,array[step.value->>'id',dep.id],
       step.value->>'id'=dep.id
     from jsonb_array_elements(v_task.input->'plan') step(value)
     cross join lateral jsonb_array_elements_text(coalesce(step.value->'depends_on','[]'::jsonb)) dep(id)
     union all
     select paths.root_id,dep.id,paths.path||dep.id,dep.id=any(paths.path)
     from dependency_paths paths
     join jsonb_array_elements(v_task.input->'plan') step(value)
       on step.value->>'id'=paths.node_id
     cross join lateral jsonb_array_elements_text(coalesce(step.value->'depends_on','[]'::jsonb)) dep(id)
     where not paths.cycle
   )
   select 1 from dependency_paths where cycle
 ) then return false; end if;
 select count(*) into v_completed_count from jsonb_array_elements(p_checkpoint->'completed_steps');
 select count(*) into v_pending_count from jsonb_array_elements(p_checkpoint->'pending_steps');
 select count(*),count(distinct value) into v_union_count,v_distinct_count
   from jsonb_array_elements_text((p_checkpoint->'completed_steps') || (p_checkpoint->'pending_steps')) s(value);
 if v_union_count<>v_distinct_count or v_union_count<>v_plan_count then return false; end if;

 select count(*) into v_member_count
 from jsonb_array_elements_text((p_checkpoint->'completed_steps') || (p_checkpoint->'pending_steps')) s(id)
 where exists(select 1 from jsonb_array_elements(v_task.input->'plan') step(value) where step.value->>'id'=s.id);
 if v_member_count<>v_plan_count then return false; end if;

 if p_checkpoint->'current_step_id'<>'null'::jsonb
    and not (p_checkpoint->'pending_steps' @> jsonb_build_array(p_checkpoint->>'current_step_id')) then
   return false;
 end if;
 if exists (
   select 1
   from jsonb_array_elements(v_task.input->'plan') step(value)
   cross join lateral jsonb_array_elements_text(coalesce(step.value->'depends_on','[]'::jsonb)) dep(id)
   where (
      p_checkpoint->'completed_steps' @> jsonb_build_array(step.value->>'id')
      or p_checkpoint->>'current_step_id'=step.value->>'id'
   )
   and not (p_checkpoint->'completed_steps' @> jsonb_build_array(dep.id))
 ) then return false; end if;
 if exists (
   select 1
   from jsonb_array_elements(v_task.input->'plan') step(value)
   cross join lateral jsonb_array_elements_text(coalesce(step.value->'depends_on','[]'::jsonb)) dep(id)
   where not exists(
     select 1 from jsonb_array_elements(v_task.input->'plan') dependency(value)
     where dependency.value->>'id'=dep.id
   )
 ) then return false; end if;

 if p_checkpoint->>'mission_state'='ready_to_complete' then
   if v_pending_count<>0 or v_completed_count<>v_plan_count
       or p_checkpoint->'current_step_id'<>'null'::jsonb
       or jsonb_array_length(p_checkpoint->'results')<v_plan_count
       or jsonb_array_length(p_checkpoint->'test_evidence')<v_plan_count then return false; end if;
    if exists (
      select 1 from jsonb_array_elements(v_task.input->'plan') step(value)
      where not exists(
        select 1 from jsonb_array_elements(p_checkpoint->'results') result(value)
        where result.value->>'step_id'=step.value->>'id'
          and result.value->>'status'='passed'
      )
    ) then return false; end if;
  elsif v_pending_count=0 or p_checkpoint->'current_step_id'='null'::jsonb then
   return false;
 end if;

 if v_task.mission_checkpoint_version=p_checkpoint_version
    and v_task.last_checkpoint_operation_id=p_operation_id
    and v_task.last_checkpoint_executor_id=p_executor_id
    and v_task.mission_checkpoint=p_checkpoint then
   return true;
 end if;
 if v_task.mission_checkpoint_version+1<>p_checkpoint_version
    or v_task.mission_checkpoint->>'mission_state'='ready_to_complete'
    or exists (
      select 1 from jsonb_array_elements_text(v_task.mission_checkpoint->'completed_steps') old_step(id)
      where not (p_checkpoint->'completed_steps' @> jsonb_build_array(old_step.id))
    ) then
   return false;
 end if;

 update public.agent_tasks set
   mission_checkpoint=p_checkpoint,
   mission_checkpoint_version=p_checkpoint_version,
   last_checkpoint_operation_id=p_operation_id,
   last_checkpoint_hash=md5(p_checkpoint::text),
   last_checkpoint_executor_id=p_executor_id,
   updated_at=clock_timestamp()
 where id=p_task_id and mission_id=p_mission_id and status='running'
   and execution_token=p_token and lease_until>clock_timestamp()
   and mission_checkpoint_version=p_checkpoint_version-1;
 if not found then return false; end if;

 insert into public.agent_audit_events(task_id,event_type,details)
 values(p_task_id,'mission_checkpoint_saved',jsonb_build_object(
   'mission_id',p_mission_id,'checkpoint_version',p_checkpoint_version,
   'operation_id',p_operation_id,'checkpoint_hash',md5(p_checkpoint::text),
   'executor_id',p_executor_id
 ));
 return true;
end $$;

create or replace function public.six_agent_complete(p_task_id text,p_token uuid,p_evidence text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_changed integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'unauthorized'; end if;
 if length(btrim(coalesce(p_evidence,'')))<3 or length(p_evidence)>500 then raise exception 'evidence_required'; end if;
 update public.agent_tasks t set
   status='completed',completed_evidence=p_evidence,lease_until=null,execution_token=null,
   mission_checkpoint=case when t.input->>'mission_schema_version'='1'
     then jsonb_set(t.mission_checkpoint,'{mission_state}','"completed"'::jsonb) else t.mission_checkpoint end,
   mission_checkpoint_version=t.mission_checkpoint_version+
     case when t.input->>'mission_schema_version'='1' then 1 else 0 end,
   updated_at=clock_timestamp()
 where t.id=p_task_id and t.execution_token=p_token and t.status='running'
   and t.lease_until>clock_timestamp()
   and (
     t.input->>'mission_schema_version' is distinct from '1'
     or (
       t.mission_checkpoint->>'mission_state'='ready_to_complete'
       and jsonb_typeof(t.mission_checkpoint->'pending_steps')='array'
       and jsonb_array_length(t.mission_checkpoint->'pending_steps')=0
       and jsonb_array_length(t.mission_checkpoint->'completed_steps')=jsonb_array_length(t.input->'plan')
     )
   );
 get diagnostics v_changed=row_count;
 if v_changed=1 then
   insert into public.agent_audit_events(task_id,event_type,details)
   select p_task_id,'six_agent_complete',jsonb_build_object(
     'evidence',p_evidence,'mission_id',t.mission_id,'checkpoint_version',t.mission_checkpoint_version
   ) from public.agent_tasks t where t.id=p_task_id;
 end if;
 return v_changed=1;
end $$;

create or replace function public.six_agent_fail(p_task_id text,p_token uuid,p_reason text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_changed integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'unauthorized'; end if;
 if coalesce(p_reason,'') !~ '^[a-z][a-z0-9_]{2,63}$' then raise exception 'reason_code_required'; end if;
 update public.agent_tasks t set
   status=case when t.attempt_count>=t.max_attempts then 'blocked' else 'failed' end,
   available_at=now()+make_interval(secs=>least(3600,30*power(2,least(t.attempt_count,7)-1)::int)),
   lease_until=null,execution_token=null,
   mission_checkpoint=case when t.input->>'mission_schema_version'='1' then
     jsonb_set(jsonb_set(t.mission_checkpoint,'{mission_state}',
       to_jsonb(case when t.attempt_count>=t.max_attempts then 'blocked' else 'retry_wait' end)),
       '{last_error}',to_jsonb(p_reason))
     else t.mission_checkpoint end,
   mission_checkpoint_version=t.mission_checkpoint_version+
     case when t.input->>'mission_schema_version'='1' then 1 else 0 end,
   updated_at=clock_timestamp()
 where t.id=p_task_id and t.execution_token=p_token and t.status='running'
   and t.lease_until>clock_timestamp();
 get diagnostics v_changed=row_count;
 if v_changed=1 then
   insert into public.agent_audit_events(task_id,event_type,details)
   select p_task_id,'six_agent_failure',jsonb_build_object(
     'reason_code',p_reason,'mission_id',t.mission_id,'checkpoint_version',t.mission_checkpoint_version
   ) from public.agent_tasks t where t.id=p_task_id;
 end if;
 return v_changed=1;
end $$;

revoke all on function public.six_agent_claim(text,integer) from public,anon,authenticated;
revoke all on function public.six_agent_checkpoint(text,text,uuid,integer,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.six_agent_complete(text,uuid,text) from public,anon,authenticated;
revoke all on function public.six_agent_fail(text,uuid,text) from public,anon,authenticated;
grant execute on function public.six_agent_claim(text,integer) to service_role;
grant execute on function public.six_agent_checkpoint(text,text,uuid,integer,text,text,jsonb) to service_role;
grant execute on function public.six_agent_complete(text,uuid,text) to service_role;
grant execute on function public.six_agent_fail(text,uuid,text) to service_role;
