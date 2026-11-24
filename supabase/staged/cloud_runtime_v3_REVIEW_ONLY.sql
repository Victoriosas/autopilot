-- REVIEW ONLY. No migration discovery, scheduler, secret or activation occurs here.
-- Requires PR272 fencing and the existing six-agent queue. No new table/queue.
begin;
do $$ begin
 if not exists(select from pg_roles where rolname='autopilot_cloud_runtime') then
  create role autopilot_cloud_runtime nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
 end if;
 if not exists(select from pg_roles where rolname='autopilot_cloud_reader') then
  create role autopilot_cloud_reader nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
 end if;
end $$;
grant usage on schema public to autopilot_cloud_runtime,autopilot_cloud_reader;
revoke all on public.agent_tasks,public.agent_audit_events from autopilot_cloud_runtime,autopilot_cloud_reader;
-- The separate, expiring JWTs must carry these roles; never service_role.
-- Role membership for PostgREST authenticator is an explicit activation step.

create or replace function public.cloud_v3_authorized(p_sha text) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_input jsonb;v_claims jsonb;
begin
 -- Lock authorization until this transaction completes: revocation cannot race
 -- between the decision and the fenced mutation in the same RPC.
 select t.input into v_input from public.agent_tasks t where t.id='cloud-v3:control'
  and t.actor='cloud-v3-policy' and t.status='awaiting_approval' for share;
 if not found then return false;end if;
 v_claims=nullif(current_setting('request.jwt.claims',true),'')::jsonb;
 return coalesce(p_sha ~ '^[0-9a-f]{40}$'
   and v_input->>'enabled'='true' and v_input->>'scheduler'='supabase_cron'
   and v_input->>'github_disabled'='true' and v_input->>'no_send'='true'
   and v_input->>'reviewed_sha'=p_sha and v_input->>'subject'=v_claims->>'sub'
   and v_input->>'environment' in ('isolated','production')
   and (v_input->>'not_before')::timestamptz<=clock_timestamp()
   and (v_input->>'expires_at')::timestamptz>clock_timestamp()
   and v_claims->>'role'='autopilot_cloud_runtime',false);
end $$;

create or replace function public.cloud_v3_start(p_sha text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id text; v_token uuid; v_row public.agent_tasks;
begin
 if public.cloud_v3_authorized(p_sha) is not true then raise exception 'cloud_authorization_denied';end if;
 -- One owner globally, even across a slot boundary. Same lock for all starters.
 perform pg_advisory_xact_lock(724003,3);
 if exists(select 1 from public.agent_tasks where actor='cloud-v3-runtime' and agent_id='director'
   and status='running' and lease_until>clock_timestamp()) then return null;end if;
 v_id='cloud-v3:'||floor(extract(epoch from clock_timestamp())/1800)::bigint||':director';
 insert into public.agent_tasks(id,goal,actor,action,status,agent_id,max_attempts,input)
 values(v_id,'Coordinar observaciones sin envíos','cloud-v3-runtime','read','queued','director',3,
  jsonb_build_object('version',3,'reviewed_sha',p_sha,'no_send',true)) on conflict(id) do nothing;
 select * into v_row from public.agent_tasks where id=v_id for update;
 if v_row.actor<>'cloud-v3-runtime' or v_row.input->>'reviewed_sha' is distinct from p_sha
  or v_row.status not in ('queued','failed','running') or v_row.attempt_count>=v_row.max_attempts
  or v_row.available_at>clock_timestamp() then return null;end if;
 v_token=gen_random_uuid();
 update public.agent_tasks set status='running',execution_token=v_token,lease_until=clock_timestamp()+interval '180 seconds',
  attempt_count=attempt_count+1,updated_at=clock_timestamp() where id=v_id;
 insert into public.agent_audit_events(task_id,event_type,details) values(v_id,'cloud_v3_claim',jsonb_build_object('agent','director','sha',p_sha));
 return jsonb_build_object('task_id',v_id,'claim_token',v_token,'agent','director');
end $$;

create or replace function public.cloud_v3_claim(p_parent text,p_token uuid,p_agent text,p_sha text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id text;v_row public.agent_tasks;v_token uuid;
begin
 if public.cloud_v3_authorized(p_sha) is not true then raise exception 'cloud_authorization_denied';end if;
 if p_agent is null or p_agent<>all(array['software','infrastructure','consultations','followup','reports']) then raise exception 'agent_denied';end if;
 perform 1 from public.agent_tasks where id=p_parent and actor='cloud-v3-runtime' and agent_id='director'
  and status='running' and execution_token=p_token and lease_until>clock_timestamp()
  and input->>'reviewed_sha'=p_sha for update;
 if not found then raise exception 'parent_fenced';end if;
 v_id=regexp_replace(p_parent,':director$',':'||p_agent);
 insert into public.agent_tasks(id,goal,actor,action,status,agent_id,max_attempts,input)
 values(v_id,'Observación operativa sin envíos','cloud-v3-runtime','read','queued',p_agent,3,
  jsonb_build_object('version',3,'parent',p_parent,'parent_token',p_token,'reviewed_sha',p_sha,'no_send',true)) on conflict(id) do nothing;
 select * into v_row from public.agent_tasks where id=v_id for update;
 if v_row.actor<>'cloud-v3-runtime' or v_row.input->>'parent' is distinct from p_parent
  or v_row.input->>'reviewed_sha' is distinct from p_sha or v_row.status not in ('queued','failed','running')
  or v_row.attempt_count>=v_row.max_attempts or v_row.available_at>clock_timestamp()
  or (v_row.status='running' and v_row.lease_until>clock_timestamp()) then return null;end if;
 v_token=gen_random_uuid();
 update public.agent_tasks set status='running',execution_token=v_token,lease_until=clock_timestamp()+interval '45 seconds',
 attempt_count=attempt_count+1,input=jsonb_set(input,'{parent_token}',to_jsonb(p_token)),updated_at=clock_timestamp() where id=v_id;
 insert into public.agent_audit_events(task_id,event_type,details) values(v_id,'cloud_v3_claim',jsonb_build_object('agent',p_agent,'sha',p_sha));
 return jsonb_build_object('task_id',v_id,'claim_token',v_token,'agent',p_agent);
end $$;

-- Real, bounded DB executors. No customer input/identifiers leave Postgres.
-- Consultations only counts live inbox entries; it does NOT lift the policy pause
-- on classification, drafting or delivery. Follow-up reviews operational tasks.
create or replace function public.cloud_v3_measure(p_id text,p_token uuid,p_sha text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_agent text;v_count bigint;
begin
 if public.cloud_v3_authorized(p_sha) is not true then raise exception 'cloud_authorization_denied';end if;
 select t.agent_id into v_agent from public.agent_tasks t where t.id=p_id and t.actor='cloud-v3-runtime'
  and t.status='running' and t.execution_token=p_token and t.lease_until>clock_timestamp() and t.input->>'reviewed_sha'=p_sha
  and exists(select 1 from public.agent_tasks parent where parent.id=t.input->>'parent'
    and parent.actor='cloud-v3-runtime' and parent.agent_id='director' and parent.status='running'
    and parent.lease_until>clock_timestamp() and parent.execution_token::text=t.input->>'parent_token');
 if not found then raise exception 'claim_fenced';end if;
 if v_agent='consultations' then
  select count(*) into v_count from public.consultation_requests where expires_at>clock_timestamp();
 elsif v_agent='followup' then
  select count(*) into v_count from public.agent_tasks where status in ('blocked','awaiting_approval') and actor<>'cloud-v3-policy';
 elsif v_agent='reports' then
  select count(*) into v_count from public.agent_audit_events;
 else raise exception 'executor_denied';end if;
 return jsonb_build_object('kind',v_agent||'_aggregate','count',v_count);
end $$;

create or replace function public.cloud_v3_finish(p_id text,p_token uuid,p_sha text,p_result jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_row public.agent_tasks;v_parent public.agent_tasks;v_good boolean;v_result jsonb;
begin
 if public.cloud_v3_authorized(p_sha) is not true then raise exception 'cloud_authorization_denied';end if;
 select * into v_row from public.agent_tasks where id=p_id and actor='cloud-v3-runtime'
  and status='running' and execution_token=p_token and lease_until>clock_timestamp()
  and input->>'reviewed_sha'=p_sha for update;
 if not found then return false;end if;
 if v_row.agent_id<>'director' then
  select * into v_parent from public.agent_tasks where id=v_row.input->>'parent' and status='running'
    and actor='cloud-v3-runtime' and agent_id='director' and lease_until>clock_timestamp()
    and execution_token::text=v_row.input->>'parent_token' for update;
  if not found then return false;end if;
 end if;
 if v_row.agent_id in ('consultations','followup','reports') then
  v_result=public.cloud_v3_measure(p_id,p_token,p_sha);v_good=true;
 elsif v_row.agent_id='software' then
  -- Only the reviewed build artifact can complete this executor; not arbitrary code.
  if p_result->>'kind' is distinct from 'artifact_verified' or p_result->>'sha' is distinct from p_sha then return false;end if;
  v_result=jsonb_build_object('kind','artifact_verified','sha',p_sha);v_good=true;
 elsif v_row.agent_id='infrastructure' then
  if p_result->>'code' is null or p_result->>'code'<>all(array['ok','dns','tls','timeout','http','unexpected_content','network']) then return false;end if;
  v_result=jsonb_build_object('kind','public_health','code',p_result->>'code');v_good=p_result->>'code'='ok';
 elsif v_row.agent_id='director' then
  select count(*)=5 into v_good from public.agent_tasks where input->>'parent'=p_id
   and actor='cloud-v3-runtime' and input->>'reviewed_sha'=p_sha and status='completed'
   and agent_id in ('software','infrastructure','consultations','followup','reports');
  v_result=jsonb_build_object('kind','office_cycle','children_completed',v_good);
 else return false;end if;
 -- Heartbeat and result are atomic with completion and fencing.
 if v_row.lease_until<=clock_timestamp() or (v_parent.id is not null and v_parent.lease_until<=clock_timestamp()) then return false;end if;
 insert into public.agent_audit_events(task_id,event_type,details) values(p_id,'cloud_v3_heartbeat',jsonb_build_object('agent',v_row.agent_id,'sha',p_sha));
 update public.agent_tasks set status=case when v_good then 'completed' when attempt_count>=max_attempts then 'blocked' else 'failed' end,
  completed_evidence=case when v_good then 'cloud_v3:'||v_row.agent_id||':'||p_sha else null end,
  lease_until=null,execution_token=null,available_at=clock_timestamp()+interval '30 seconds',updated_at=clock_timestamp() where id=p_id;
 insert into public.agent_audit_events(task_id,event_type,details) values(p_id,'cloud_v3_result',jsonb_build_object('agent',v_row.agent_id,'sha',p_sha,'ok',v_good,'result',v_result));
 return true;
end $$;

create or replace function public.cloud_v3_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_rows jsonb;
begin
 -- ACL alone is insufficient when called through a different definer.
 if coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','') not in ('autopilot_cloud_reader','autopilot_cloud_runtime') then raise exception 'reader_denied';end if;
 select jsonb_agg(jsonb_build_object('id',a.agent,'pending',(select count(*) from public.agent_tasks t where t.agent_id=a.agent and t.status in ('queued','failed')),
  'running',(select count(*) from public.agent_tasks t where t.agent_id=a.agent and t.status='running' and t.lease_until>now()),
  'blocked',(select count(*) from public.agent_tasks t where t.agent_id=a.agent and t.status='blocked'),
  'completed',(select count(*) from public.agent_tasks t where t.agent_id=a.agent and t.actor='cloud-v3-runtime' and t.status='completed'
    and t.completed_evidence='cloud_v3:'||a.agent||':'||(t.input->>'reviewed_sha')
    and exists(select 1 from public.agent_audit_events e where e.task_id=t.id and e.event_type='cloud_v3_result' and e.details->>'ok'='true' and e.details->>'sha'=t.input->>'reviewed_sha')),
  'lastHeartbeat',(select max(e.created_at) from public.agent_audit_events e join public.agent_tasks t on t.id=e.task_id
     where t.agent_id=a.agent and t.actor='cloud-v3-runtime' and e.event_type='cloud_v3_heartbeat'),
  'lastResult',(select jsonb_build_object('kind',e.details->'result'->>'kind','count',e.details->'result'->'count','code',e.details->'result'->>'code','sha',e.details->>'sha','ok',e.details->'ok')
    from public.agent_audit_events e join public.agent_tasks t on t.id=e.task_id where t.agent_id=a.agent and t.actor='cloud-v3-runtime' and e.event_type='cloud_v3_result' order by e.created_at desc,e.id desc limit 1),
  'results',(select count(*) from public.agent_audit_events e join public.agent_tasks t on t.id=e.task_id where t.agent_id=a.agent and t.actor='cloud-v3-runtime' and e.event_type='cloud_v3_result')
 )) into v_rows from unnest(array['director','software','infrastructure','consultations','followup','reports']) a(agent);
 return jsonb_build_object('source','supabase','scope','cloud_v3_read_only',
  'environment',coalesce((select case when input->>'environment' in ('isolated','production') then input->>'environment' else 'unconfigured' end from public.agent_tasks where id='cloud-v3:control'),'unconfigured'),
  'generatedAt',now(),'partial',false,'agents',v_rows);
end $$;

revoke all on function public.cloud_v3_authorized(text),public.cloud_v3_start(text),public.cloud_v3_claim(text,uuid,text,text),
 public.cloud_v3_measure(text,uuid,text),public.cloud_v3_finish(text,uuid,text,jsonb),public.cloud_v3_status() from public,anon,authenticated,service_role;
grant execute on function public.cloud_v3_start(text),public.cloud_v3_claim(text,uuid,text,text),
 public.cloud_v3_measure(text,uuid,text),public.cloud_v3_finish(text,uuid,text,jsonb),public.cloud_v3_status() to autopilot_cloud_runtime;
grant execute on function public.cloud_v3_status() to autopilot_cloud_reader;
commit;
