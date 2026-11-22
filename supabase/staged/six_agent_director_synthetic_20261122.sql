-- Staged synthetic Director lane only. Never apply to hosted Supabase without a separate review.
-- Reuses agent_tasks and agent_audit_events; creates no queue, scheduler, role or ledger.
begin;
create unique index if not exists agent_audit_director_slot_uidx
 on public.agent_audit_events(task_id,(details->>'slot'))
 where event_type='director_slot_claimed';

create function public.director_current_slot(p_slot text) returns boolean
language sql volatile set search_path='' as $$
 select p_slot ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):(00|30):00Z$'
 and p_slot::timestamptz =
   date_trunc('hour',clock_timestamp()) +
     case when extract(minute from clock_timestamp())<30 then interval '0 minutes' else interval '30 minutes' end;
$$;

create function public.director_host_safe() returns boolean
language sql stable set search_path='' as $$
 select session_user='autopilot_cloud_runner'
 and exists(select 1 from pg_stat_ssl where pid=pg_backend_pid() and ssl)
 and not exists(select 1 from pg_roles where rolname=session_user
   and (rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls))
 and not exists(select 1 from pg_auth_members where member=(select oid from pg_roles where rolname=session_user));
$$;

create function public.director_authorization_valid(
 p_task public.agent_tasks,p_mission_id text,p_binding text,p_reviewed_sha text,p_slot text,p_authorization_id text
) returns boolean language sql volatile set search_path='' as $$
 select public.director_host_safe()
 and p_task.id=p_mission_id and p_task.mission_id=p_mission_id
 and p_task.id='synthetic-director-supervision' and p_task.agent_id='director'
 and p_task.actor='synthetic-director-lab'
 and p_task.input->>'director_fixture_version'='1'
 and p_task.input->>'host_binding'=p_binding
 and p_task.input->'restrictions'='["synthetic_only","no_send","no_dispatch"]'::jsonb
 and p_task.input->>'no_send'='true' and p_task.input->>'no_dispatch'='true'
 and p_task.input->'director_authorization'->>'active'='true'
 and p_task.input->'director_authorization'->'grant'->>'missionId'=p_mission_id
 and p_task.input->'director_authorization'->'grant'->>'id'=p_authorization_id
 and p_task.input->'director_authorization'->'grant'->>'agentRole'='director'
 and p_task.input->'director_authorization'->'grant'->>'binding'=p_binding
 and p_task.input->'director_authorization'->'grant'->>'reviewedSha'=p_reviewed_sha
 and p_task.input->'director_authorization'->'grant'->>'hostRole'='autopilot_cloud_runner'
 and p_task.input->'director_authorization'->'grant'->>'slot'=p_slot
 and public.director_current_slot(p_slot)
 and clock_timestamp()>=(p_task.input->'director_authorization'->'grant'->>'notBefore')::timestamptz
 and clock_timestamp()<(p_task.input->'director_authorization'->'grant'->>'expiresAt')::timestamptz
 and (p_task.input->'director_authorization'->'grant'->>'expiresAt')::timestamptz<=
   p_slot::timestamptz+interval '30 minutes';
$$;

create function public.director_authorize(
 p_task_id text,p_binding text,p_reviewed_sha text,p_slot text,p_authorization_id text,p_expires_at timestamptz,p_expected_revision integer
) returns boolean language plpgsql security definer set search_path='' as $$
declare t public.agent_tasks%rowtype; old_revision integer; slot_start timestamptz;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'unauthorized'; end if;
 if p_task_id is distinct from 'synthetic-director-supervision'
   or p_binding !~ '^[a-f0-9]{64}$' or p_reviewed_sha !~ '^[a-f0-9]{40}$'
   or p_authorization_id !~ '^director-auth-[a-z0-9-]{8,64}$' or p_expected_revision is null or p_expected_revision<0
   or not public.director_current_slot(p_slot) then raise exception 'invalid_director_authorization'; end if;
 slot_start=p_slot::timestamptz;
 select * into t from public.agent_tasks where id=p_task_id for update;
 if not found or t.mission_id<>p_task_id or t.agent_id<>'director' or t.actor<>'synthetic-director-lab'
   or t.input->>'director_fixture_version'<>'1' or t.input->>'host_binding'<>p_binding
   or t.input->>'no_send'<>'true' or t.input->>'no_dispatch'<>'true'
   or t.input->'restrictions'<>'["synthetic_only","no_send","no_dispatch"]'::jsonb
   or t.status not in ('queued','running')
   or (t.status='running' and coalesce(t.lease_until,clock_timestamp())>=clock_timestamp())
   then raise exception 'director_authorization_scope_denied'; end if;
 old_revision=coalesce((t.input->'director_authorization'->>'revision')::integer,0);
 if old_revision<>p_expected_revision then return false; end if;
 if p_expires_at<=clock_timestamp() or p_expires_at>slot_start+interval '30 minutes'
   or p_expires_at<=slot_start then raise exception 'director_authorization_window_denied'; end if;
 update public.agent_tasks set input=jsonb_set(input,'{director_authorization}',jsonb_build_object(
   'active',true,'revision',old_revision+1,'grant',jsonb_build_object('id',p_authorization_id,
   'missionId',p_task_id,'agentRole','director','binding',p_binding,'reviewedSha',p_reviewed_sha,
   'hostRole','autopilot_cloud_runner','slot',p_slot,'notBefore',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
   'expiresAt',to_char(p_expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
   'no_send',true,'no_dispatch',true))) where id=p_task_id;
 insert into public.agent_audit_events(task_id,event_type,details) values(p_task_id,'director_authorized',
   jsonb_build_object('authorization_id',p_authorization_id,'revision',old_revision+1,'slot',p_slot,'reviewed_sha',p_reviewed_sha));
 return true;
end $$;

create function public.director_revoke(p_task_id text,p_expected_revision integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare t public.agent_tasks%rowtype; revision integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'unauthorized'; end if;
 select * into t from public.agent_tasks where id=p_task_id and id='synthetic-director-supervision' for update;
 if not found then raise exception 'director_authorization_scope_denied'; end if;
 revision=(t.input->'director_authorization'->>'revision')::integer;
 if revision is distinct from p_expected_revision or t.input->'director_authorization'->>'active'<>'true' then return false; end if;
 update public.agent_tasks set input=jsonb_set(jsonb_set(input,'{director_authorization,active}','false'::jsonb),
   '{director_authorization,revision}',to_jsonb(revision+1)) where id=p_task_id;
 insert into public.agent_audit_events(task_id,event_type,details) values(p_task_id,'director_authorization_revoked',
   jsonb_build_object('revision',revision+1));
 return true;
end $$;

create function public.six_agent_director_claim(
 p_task_id text,p_binding text,p_reviewed_sha text,p_slot text,p_authorization_id text,p_lease_seconds integer
) returns table(task_id text,claim_token uuid,task_payload jsonb)
language plpgsql security definer set search_path='' as $$
declare t public.agent_tasks%rowtype; token uuid; existing_slot boolean;
begin
 if not public.director_host_safe() then raise exception 'unauthorized_director_host'; end if;
 if p_lease_seconds is null or p_lease_seconds not between 5 and 30 then raise exception 'invalid_parameters'; end if;
 select * into t from public.agent_tasks where id=p_task_id for update skip locked;
 if not found or not public.director_authorization_valid(t,p_task_id,p_binding,p_reviewed_sha,p_slot,p_authorization_id)
   or t.attempt_count>=t.max_attempts or (t.status='queued' and t.available_at>clock_timestamp())
   or not (t.status='queued' or (t.status='running' and t.lease_until<clock_timestamp() and t.execution_token is not null))
   then return; end if;
 -- RETURNS TABLE declares an output variable named task_id; qualify the table
 -- column here to avoid PL/pgSQL's column/variable ambiguity at runtime.
 select exists(select 1 from public.agent_audit_events a where a.task_id=p_task_id
   and a.event_type='director_slot_claimed' and a.details->>'slot'=p_slot) into existing_slot;
 if existing_slot and not (t.status='running' and t.lease_until<clock_timestamp()) then return; end if;
 token=gen_random_uuid();
 update public.agent_tasks set status='running',attempt_count=attempt_count+1,
   lease_until=clock_timestamp()+make_interval(secs=>p_lease_seconds),execution_token=token,updated_at=clock_timestamp()
 where id=p_task_id;
 if not existing_slot then insert into public.agent_audit_events(task_id,event_type,details)
   values(p_task_id,'director_slot_claimed',jsonb_build_object('slot',p_slot,'authorization_id',
     t.input->'director_authorization'->'grant'->>'id','reviewed_sha',p_reviewed_sha));
 else insert into public.agent_audit_events(task_id,event_type,details)
   values(p_task_id,'director_slot_recovered',jsonb_build_object('slot',p_slot,'attempt',t.attempt_count+1)); end if;
 return query select t.id,token,(case when jsonb_typeof(t.input)='object' then t.input else '{}'::jsonb end)
   ||jsonb_build_object('goal',t.goal,'goal_version',(t.input->>'goal_version')::integer,
    'plan_version',(t.input->>'plan_version')::integer,'__autopilot',jsonb_build_object(
      'mission_id',t.mission_id,'checkpoint_version',t.mission_checkpoint_version,
      'checkpoint',t.mission_checkpoint,'spec_version',t.input->>'mission_schema_version'));
end $$;

create function public.director_guarded_write(p_task_id text,p_token uuid,p_binding text,p_reviewed_sha text,p_slot text,p_authorization_id text)
returns boolean language plpgsql security definer set search_path='' as $$
declare t public.agent_tasks%rowtype;
begin
 if not public.director_host_safe() then raise exception 'unauthorized_director_host'; end if;
 select * into t from public.agent_tasks where id=p_task_id for update;
 return found and t.status='running' and t.execution_token=p_token and t.lease_until>clock_timestamp()
   and public.director_authorization_valid(t,p_task_id,p_binding,p_reviewed_sha,p_slot,p_authorization_id);
end $$;

create function public.six_agent_director_checkpoint(
 p_task_id text,p_mission_id text,p_token uuid,p_checkpoint_version integer,p_operation_id text,p_executor_id text,p_checkpoint jsonb,
 p_binding text,p_reviewed_sha text,p_slot text,p_authorization_id text
) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not public.director_guarded_write(p_task_id,p_token,p_binding,p_reviewed_sha,p_slot,p_authorization_id) then return false; end if;
 if p_mission_id is distinct from p_task_id or p_executor_id is distinct from 'director-cloud-synthetic'
   or (select id from public.agent_tasks where id=p_task_id) is distinct from 'synthetic-director-supervision'
   or jsonb_typeof(p_checkpoint) is distinct from 'object' then return false; end if;
 perform set_config('request.jwt.claim.role','service_role',true);
 return public.six_agent_checkpoint(p_task_id,p_mission_id,p_token,p_checkpoint_version,p_operation_id,p_executor_id,p_checkpoint);
end $$;

create function public.six_agent_director_complete(
 p_task_id text,p_token uuid,p_evidence text,p_binding text,p_reviewed_sha text,p_slot text,p_authorization_id text
) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not public.director_guarded_write(p_task_id,p_token,p_binding,p_reviewed_sha,p_slot,p_authorization_id)
   or p_evidence !~ '^director_verified:[a-f0-9]{40}:[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):(00|30):00Z$'
   then return false; end if;
 perform set_config('request.jwt.claim.role','service_role',true);
 return public.six_agent_complete(p_task_id,p_token,p_evidence);
end $$;

create function public.six_agent_director_fail(
 p_task_id text,p_token uuid,p_reason text,p_binding text,p_reviewed_sha text,p_slot text,p_authorization_id text
) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not public.director_guarded_write(p_task_id,p_token,p_binding,p_reviewed_sha,p_slot,p_authorization_id) then return false; end if;
 perform set_config('request.jwt.claim.role','service_role',true);
 return public.six_agent_fail(p_task_id,p_token,p_reason);
end $$;

create function public.director_observe_synthetic_agents(
 p_task_id text,p_binding text,p_reviewed_sha text,p_slot text,p_authorization_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.agent_tasks%rowtype; result jsonb;
begin
 select * into t from public.agent_tasks where id=p_task_id;
 if not found or not public.director_authorization_valid(t,p_task_id,p_binding,p_reviewed_sha,p_slot,p_authorization_id) then
   raise exception 'director_authorization_denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',id,'agent_id',agent_id,'status',status,'attempt_count',attempt_count,
   'updated_at',updated_at,'lease_until',lease_until,
   'completed_evidence',case when nullif(btrim(completed_evidence),'') is null then null else 'declared' end
 ) order by agent_id,id),'[]'::jsonb) into result from public.agent_tasks
 where actor='synthetic-director-lab' and id like 'synthetic-director-%'
   and id<>p_task_id
   and input->>'director_fixture_version'='1' and input->>'no_send'='true' and input->>'no_dispatch'='true'
   and agent_id in ('director','software','infrastructure','consultations','followup','reports');
 return result;
end $$;

create function public.director_read_mission(
 p_task_id text,p_binding text,p_reviewed_sha text,p_slot text,p_authorization_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.agent_tasks%rowtype;
begin
 select * into t from public.agent_tasks where id=p_task_id;
 if not found or not public.director_authorization_valid(t,p_task_id,p_binding,p_reviewed_sha,p_slot,p_authorization_id) then
   raise exception 'director_authorization_denied'; end if;
 return jsonb_build_object('id',t.id,'status',t.status,'lease_active',t.lease_until>clock_timestamp(),
   'attempts',t.attempt_count,'checkpoint_version',t.mission_checkpoint_version,
   'checkpoint',t.mission_checkpoint,'no_send',t.input->>'no_send','no_dispatch',t.input->>'no_dispatch',
   'authorization_revision',t.input->'director_authorization'->>'revision');
end $$;

revoke all on function public.director_current_slot(text),public.director_host_safe(),
 public.director_authorization_valid(public.agent_tasks,text,text,text,text,text),
 public.director_guarded_write(text,uuid,text,text,text,text),
 public.director_authorize(text,text,text,text,text,timestamptz,integer),public.director_revoke(text,integer),
 public.six_agent_director_claim(text,text,text,text,text,integer),
 public.six_agent_director_checkpoint(text,text,uuid,integer,text,text,jsonb,text,text,text,text),
 public.six_agent_director_complete(text,uuid,text,text,text,text,text),public.six_agent_director_fail(text,uuid,text,text,text,text,text),
 public.director_observe_synthetic_agents(text,text,text,text,text),public.director_read_mission(text,text,text,text,text)
 from public,anon,authenticated,service_role,autopilot_cloud_runner;
grant execute on function public.director_authorize(text,text,text,text,text,timestamptz,integer),public.director_revoke(text,integer) to service_role;
grant execute on function public.six_agent_director_claim(text,text,text,text,text,integer),
 public.six_agent_director_checkpoint(text,text,uuid,integer,text,text,jsonb,text,text,text,text),
 public.six_agent_director_complete(text,uuid,text,text,text,text,text),public.six_agent_director_fail(text,uuid,text,text,text,text,text),
 public.director_observe_synthetic_agents(text,text,text,text,text),public.director_read_mission(text,text,text,text,text)
 to autopilot_cloud_runner;
commit;
