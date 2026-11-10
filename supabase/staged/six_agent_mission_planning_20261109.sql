-- ORD-204D: opt-in LOCAL/CI only. Same tasks, checkpoints, leases and audit.
create unique index if not exists agent_audit_plan_operation_uidx
 on public.agent_audit_events(task_id,(details->>'operation_id')) where event_type='mission_plan_saved';

create or replace function public.six_agent_save_plan(
 p_task_id text,p_token uuid,p_checkpoint_version integer,p_operation_id text,p_planner_id text,p_proposal jsonb
) returns boolean language plpgsql security definer set search_path=''
as $$
declare t public.agent_tasks%rowtype; objective jsonb; history jsonb; steps jsonb; completed jsonb;
declare step jsonb; previous_id text; seen text[]='{}'; pending_actions text[]='{}';
declare plan_version integer; previous_version integer; max_replans integer; max_steps integer; position integer=0;
declare action_order integer; last_order integer=0; checkpoint jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'unauthorized'; end if;
 if p_checkpoint_version is null or p_checkpoint_version<1 or p_operation_id is null
  or p_operation_id !~ '^[a-zA-Z0-9:_-]{8,128}$' or p_planner_id is null
  or p_planner_id !~ '^[a-zA-Z0-9._:-]{1,80}$'
  or jsonb_typeof(p_proposal) is distinct from 'object' or pg_column_size(p_proposal)>32768 then return false; end if;
 select * into t from public.agent_tasks where id=p_task_id for update;
 if not found or t.status<>'running' or t.execution_token is distinct from p_token
  or t.lease_until is null or t.lease_until<=clock_timestamp()
  or t.input->>'mission_schema_version' is distinct from '1'
  or t.goal<>'Verify synthetic mission recovery' or t.input->>'goal_version' is distinct from '1'
  or t.mission_checkpoint->>'mission_state' in ('completed','ready_to_complete','blocked') then return false; end if;
 objective=t.input->'objective'; history=coalesce(t.input->'plan_history','[]'::jsonb);
 if jsonb_typeof(objective) is distinct from 'object' or jsonb_typeof(history) is distinct from 'array'
  or objective->>'kind' is distinct from 'synthetic.ensure_verified_artifact'
  or objective->>'version' is distinct from '1' or objective->>'expected' is distinct from 'canonical_synthetic_result'
  or objective->'restrictions' is distinct from '["local_synthetic_only","no_network","no_send"]'::jsonb
  or objective->'resources' is distinct from '["synthetic_worktree","result_artifact","verification_fixture"]'::jsonb
  or objective->'acceptance' is distinct from '["artifact_matches","synthetic_test_passed"]'::jsonb
  or coalesce(objective->'limits'->>'maxReplans','') !~ '^[0-2]$'
  or coalesce(objective->'limits'->>'maxSteps','') !~ '^[1-8]$'
  or p_proposal->'objective' is distinct from objective
  or p_proposal->'resources' is distinct from objective->'resources'
  or p_proposal->'restrictions' is distinct from objective->'restrictions'
  or coalesce(p_proposal->>'version','') !~ '^[1-3]$'
  or coalesce(p_proposal->>'evidence','') !~ '^[a-f0-9]{64}$' then return false; end if;
 plan_version=(p_proposal->>'version')::integer;
 max_replans=(objective->'limits'->>'maxReplans')::integer; max_steps=(objective->'limits'->>'maxSteps')::integer;
 previous_version=jsonb_array_length(history);
 if t.mission_checkpoint_version=p_checkpoint_version and t.last_checkpoint_operation_id=p_operation_id
  and t.last_checkpoint_executor_id=p_planner_id
  and history->-1=p_proposal then return true; end if;
 if t.mission_checkpoint_version+1<>p_checkpoint_version or previous_version>max_replans
  or previous_version+1<>plan_version
  or coalesce(t.input->>'plan_version','0')<>previous_version::text
  or p_proposal->>'reason' is distinct from (case when previous_version=0 then 'initial_state' else 'artifacts_missing' end)
  or jsonb_typeof(p_proposal->'observation') is distinct from 'object'
  or coalesce(p_proposal->'observation'->>'worktree','') not in ('missing','ready')
  or coalesce(p_proposal->'observation'->>'result','') not in ('missing','valid')
  or coalesce(p_proposal->'observation'->>'test','') not in ('missing','valid') then return false; end if;
 if previous_version>0 and history->0->'objective' is distinct from objective then return false; end if;
 if previous_version>0 and p_proposal->'observation'->>'worktree'='ready'
  and p_proposal->'observation'->>'result'='valid' and p_proposal->'observation'->>'test'='valid' then return false; end if;
 steps=p_proposal->'steps'; completed=t.mission_checkpoint->'completed_steps';
 if jsonb_typeof(steps) is distinct from 'array' or jsonb_array_length(steps)<1 or jsonb_array_length(steps)>max_steps
  or jsonb_typeof(completed) is distinct from 'array' then return false; end if;
 for step in select value from jsonb_array_elements(steps) loop
  position=position+1;
  if jsonb_typeof(step) is distinct from 'object' or coalesce(step->>'id','') !~ '^(prepare|modify|verify)-v[1-3]$'
   or step->>'task' is distinct from 'synthetic.'||split_part(step->>'id','-v',1)
   or step->>'id'=any(seen) or jsonb_typeof(step->'depends_on') is distinct from 'array' then return false; end if;
  if position<=jsonb_array_length(completed) then
   if step->>'id' is distinct from completed->>(position-1) or not exists(
     select 1 from jsonb_array_elements(t.input->'plan') old(value) where old.value=step
   ) then return false; end if;
  else
   if step->>'id' not like '%-v'||plan_version::text
    or step->'depends_on' is distinct from (case when previous_id is null then '[]'::jsonb else jsonb_build_array(previous_id) end)
    then return false; end if;
   action_order=array_position(array['synthetic.prepare','synthetic.modify','synthetic.verify'],step->>'task');
   if action_order is null or action_order<=last_order then return false; end if;
   last_order=action_order; pending_actions=array_append(pending_actions,step->>'task');
  end if;
  previous_id=step->>'id'; seen=array_append(seen,previous_id);
 end loop;
 if coalesce(array_length(pending_actions,1),0)=0 or pending_actions[array_length(pending_actions,1)]<>'synthetic.verify'
  or jsonb_array_length(completed)>=jsonb_array_length(steps)
  or (p_proposal->'observation'->>'worktree'='missing' and pending_actions[1]<>'synthetic.prepare')
  or ((p_proposal->'observation'->>'result'='missing' or p_proposal->'observation'->>'test'='missing')
      and not ('synthetic.modify'=any(pending_actions))) then return false; end if;
 checkpoint=t.mission_checkpoint||jsonb_build_object('mission_state','in_progress','plan_version',plan_version,
  'pending_steps',(select jsonb_agg(s.value->>'id' order by s.ordinality) from jsonb_array_elements(steps) with ordinality s(value,ordinality)
    where s.ordinality>jsonb_array_length(completed)), 'current_step_id',steps->jsonb_array_length(completed)->>'id');
 update public.agent_tasks set input=t.input||jsonb_build_object('plan',steps,'plan_version',plan_version,
   'restrictions',objective->'restrictions','completion_criteria',objective->'acceptance','plan_history',history||jsonb_build_array(p_proposal)),
  mission_checkpoint=checkpoint,mission_checkpoint_version=p_checkpoint_version,
  last_checkpoint_operation_id=p_operation_id,last_checkpoint_executor_id=p_planner_id,
  last_checkpoint_hash=md5(p_proposal::text),updated_at=clock_timestamp()
 where id=p_task_id and execution_token=p_token and status='running' and lease_until>clock_timestamp()
  and mission_checkpoint_version=p_checkpoint_version-1;
 if not found then return false; end if;
 insert into public.agent_audit_events(task_id,event_type,details) values(p_task_id,'mission_plan_saved',jsonb_build_object(
  'operation_id',p_operation_id,'plan_version',plan_version,'checkpoint_version',p_checkpoint_version,
  'reason',p_proposal->>'reason','evidence',p_proposal->>'evidence','observation',p_proposal->'observation',
  'planner_id',p_planner_id,'proposal_hash',md5(p_proposal::text)));
 return true;
end $$;

create or replace function public.six_agent_block_mission(p_task_id text,p_token uuid,p_checkpoint_version integer,p_reason text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare changed integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'unauthorized'; end if;
 if coalesce(p_reason,'') !~ '^[a-z][a-z0-9_]{2,63}$' then raise exception 'reason_code_required'; end if;
 update public.agent_tasks set status='blocked',lease_until=null,execution_token=null,
  mission_checkpoint=mission_checkpoint||jsonb_build_object('mission_state','blocked','last_error',p_reason),
  mission_checkpoint_version=mission_checkpoint_version+1,updated_at=clock_timestamp()
 where id=p_task_id and status='running' and execution_token=p_token and lease_until>clock_timestamp()
  and mission_checkpoint_version=p_checkpoint_version and input ? 'objective';
 get diagnostics changed=row_count;
 if changed=1 then
  insert into public.agent_audit_events(task_id,event_type,details) values(p_task_id,'mission_blocked',jsonb_build_object('reason',p_reason));
 end if;
 return changed=1;
end $$;
revoke all on function public.six_agent_save_plan(text,uuid,integer,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.six_agent_block_mission(text,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.six_agent_save_plan(text,uuid,integer,text,text,jsonb) to service_role;
grant execute on function public.six_agent_block_mission(text,uuid,integer,text) to service_role;
