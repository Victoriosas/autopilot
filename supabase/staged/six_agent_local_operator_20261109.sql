-- Local disposable lab only. No hosted application or scheduler activation.
create table public.autopilot_local_lab (
 singleton boolean primary key default true check(singleton), binding text not null check(binding ~ '^[a-f0-9]{64}$')
);
alter table public.autopilot_local_lab enable row level security;
revoke all on public.autopilot_local_lab from public,anon,authenticated;
alter table public.agent_tasks add column local_run_id uuid;

create function public.local_mission_admit(p_id text,p_objective jsonb,p_binding text) returns text
language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'unauthorized'; end if;
 if not exists(select 1 from public.autopilot_local_lab where binding=p_binding)
  or coalesce(p_id,'') !~ '^synthetic-[a-z0-9-]{1,60}$' then raise exception 'admission_denied'; end if;
 -- Independent database gate: admission never accepts a supplied plan, command or credential.
 if jsonb_typeof(p_objective) is distinct from 'object'
  or p_objective->>'version' is distinct from '1' or p_objective->>'kind' is distinct from 'synthetic.ensure_verified_artifact'
  or p_objective->>'expected' is distinct from 'canonical_synthetic_result'
  or p_objective->'resources' is distinct from '["synthetic_worktree","result_artifact","verification_fixture"]'::jsonb
  or p_objective->'restrictions' is distinct from '["local_synthetic_only","no_network","no_send"]'::jsonb
  or p_objective->'acceptance' is distinct from '["artifact_matches","synthetic_test_passed"]'::jsonb
  or coalesce(p_objective->'limits'->>'maxReplans','') !~ '^[0-2]$'
  or coalesce(p_objective->'limits'->>'maxSteps','') !~ '^[1-8]$' then raise exception 'objective_not_admitted'; end if;
 insert into public.agent_tasks(id,goal,actor,action,status,agent_id,input) values
  (p_id,'Verify synthetic mission recovery','autopilot-local-cli','synthetic_task','queued','software',
   jsonb_build_object('mission_schema_version','1','goal_version',1,'objective',p_objective,'host_binding',p_binding))
 on conflict do nothing;
 get diagnostics changed=row_count;
 if changed=0 then
  if exists(select 1 from public.agent_tasks where id=p_id and actor='autopilot-local-cli'
    and input->'objective'=p_objective and input->>'host_binding'=p_binding) then return 'duplicate'; end if;
  return 'admission_conflict';
 end if;
 insert into public.agent_audit_events(task_id,event_type,details) values(p_id,'mission_admitted',jsonb_build_object('domain','synthetic.ensure_verified_artifact'));
 return 'queued';
end $$;

create function public.local_mission_claim(p_id text,p_binding text,p_run_id uuid,p_lease_seconds integer)
returns table(task_id text,claim_token uuid,task_payload jsonb)
language plpgsql security definer set search_path='' as $$
declare selected_id text; token uuid;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'unauthorized'; end if;
 if not exists(select 1 from public.autopilot_local_lab where binding=p_binding)
  or p_lease_seconds is null or p_lease_seconds not between 5 and 60 or p_run_id is null then raise exception 'claim_denied'; end if;
 update public.agent_tasks set status='blocked',execution_token=null,lease_until=null,
  mission_checkpoint_version=mission_checkpoint_version+1,
  mission_checkpoint=mission_checkpoint||'{"mission_state":"blocked","last_error":"attempt_budget_exhausted"}'::jsonb
 where id=p_id and actor='autopilot-local-cli' and input->>'host_binding'=p_binding
  and status='running' and lease_until<clock_timestamp() and attempt_count>=max_attempts;
 if found then insert into public.agent_audit_events(task_id,event_type,details) values(p_id,'mission_blocked','{"reason":"attempt_budget_exhausted"}'); return; end if;
 select t.id into selected_id from public.agent_tasks t where t.id=p_id and t.actor='autopilot-local-cli'
  and t.agent_id='software' and t.input->>'host_binding'=p_binding and t.attempt_count<t.max_attempts
  and ((t.status in ('queued','failed') and t.available_at<=clock_timestamp())
   or (t.status='running' and t.lease_until<clock_timestamp() and t.execution_token is not null))
 for update skip locked;
 if selected_id is null then return; end if;
 token=gen_random_uuid();
 update public.agent_tasks set status='running',attempt_count=attempt_count+1,local_run_id=p_run_id,
  execution_token=token,lease_until=clock_timestamp()+make_interval(secs=>p_lease_seconds),updated_at=clock_timestamp() where id=selected_id;
 insert into public.agent_audit_events(task_id,event_type,details) values(selected_id,'six_agent_claim',jsonb_build_object('agent','software','run_id',p_run_id));
 return query select t.id,t.execution_token,t.input||jsonb_build_object('goal',t.goal,'__autopilot',jsonb_build_object(
  'mission_id',t.mission_id,'checkpoint_version',t.mission_checkpoint_version,'checkpoint',t.mission_checkpoint,'spec_version',t.input->>'mission_schema_version'))
 from public.agent_tasks t where t.id=selected_id;
end $$;

create function public.local_mission_cancel(p_id text,p_binding text) returns boolean
language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'unauthorized'; end if;
 if not exists(select 1 from public.autopilot_local_lab where binding=p_binding) then raise exception 'cancel_denied'; end if;
 update public.agent_tasks set status='blocked',execution_token=null,lease_until=null,updated_at=clock_timestamp(),
  mission_checkpoint_version=mission_checkpoint_version+1,
  mission_checkpoint=mission_checkpoint||'{"mission_state":"cancelled","last_error":"cancelled_by_operator"}'::jsonb
 where id=p_id and actor='autopilot-local-cli' and input->>'host_binding'=p_binding and status in ('queued','running','failed');
 get diagnostics changed=row_count;
 if changed=1 then insert into public.agent_audit_events(task_id,event_type,details) values(p_id,'mission_cancelled','{"reason":"cancelled_by_operator"}'); end if;
 return changed=1;
end $$;
revoke all on function public.local_mission_admit(text,jsonb,text) from public,anon,authenticated;
revoke all on function public.local_mission_claim(text,text,uuid,integer) from public,anon,authenticated;
revoke all on function public.local_mission_cancel(text,text) from public,anon,authenticated;
grant execute on function public.local_mission_admit(text,jsonb,text) to service_role;
grant execute on function public.local_mission_claim(text,text,uuid,integer) to service_role;
grant execute on function public.local_mission_cancel(text,text) to service_role;
