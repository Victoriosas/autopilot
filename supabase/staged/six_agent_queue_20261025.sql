-- Six-agent opt-in queue extension. NOT deployed automatically.
-- Reuses public.agent_tasks and public.agent_audit_events, preserving legacy rows.
alter table public.agent_tasks
 add column if not exists agent_id text,
 add column if not exists attempt_count integer not null default 0,
 add column if not exists max_attempts integer not null default 3,
 add column if not exists available_at timestamptz not null default now(),
 add column if not exists lease_until timestamptz,
 add column if not exists execution_token uuid,
 add column if not exists completed_evidence text;
create index if not exists agent_tasks_six_queue_idx
 on public.agent_tasks(available_at,created_at)
 where status in ('queued','failed') and agent_id is not null;
create or replace function public.six_agent_claim(p_agent text,p_lease_seconds integer default 60)
returns table(task_id text, claim_token uuid, task_payload jsonb)
language plpgsql security definer set search_path = ''
as $$
declare v_id text; v_token uuid;
begin
 if auth.role() <> 'service_role' then raise exception 'unauthorized'; end if;
 if p_agent not in ('director','software','infrastructure','consultations','followup','reports')
    or p_lease_seconds not between 5 and 300 then raise exception 'invalid_parameters'; end if;
 -- Consultations remain paused until explicitly approved through policy.
 if p_agent = 'consultations' then return; end if;
 select t.id into v_id from public.agent_tasks t
 where t.agent_id=p_agent and t.attempt_count<t.max_attempts and
 ((t.status in ('queued','failed') and t.available_at<=now())
  or (t.status='running' and t.lease_until<now() and t.execution_token is not null))
 order by t.created_at asc limit 1 for update skip locked;
 if v_id is null then return; end if;
 v_token:=gen_random_uuid();
 update public.agent_tasks t set status='running',attempt_count=t.attempt_count+1,
 lease_until=now()+make_interval(secs=>p_lease_seconds), execution_token=v_token, updated_at=now()
 where t.id=v_id;
 insert into public.agent_audit_events(task_id,event_type,details)
 values(v_id,'six_agent_claim',jsonb_build_object('agent',p_agent,'attempt','claimed'));
 return query select t.id,t.execution_token,coalesce(t.input,'{}'::jsonb) from public.agent_tasks t where t.id=v_id;
end $$;
create or replace function public.six_agent_complete(p_task_id text,p_token uuid,p_evidence text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_changed integer;
begin
 if auth.role() <> 'service_role' then raise exception 'unauthorized'; end if;
 if length(btrim(coalesce(p_evidence,'')))<3 or length(p_evidence)>500 then raise exception 'evidence_required'; end if;
 update public.agent_tasks t set status='completed',completed_evidence=p_evidence,
 lease_until=null, execution_token=null,updated_at=now()
 where t.id=p_task_id and t.execution_token=p_token and t.status='running' and t.lease_until>now();
 get diagnostics v_changed=row_count;
 if v_changed=1 then
 insert into public.agent_audit_events(task_id,event_type,details) values(p_task_id,'six_agent_complete',jsonb_build_object('evidence',p_evidence));
 end if;
 return v_changed=1;
end $$;
create or replace function public.six_agent_fail(p_task_id text,p_token uuid,p_reason text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_changed integer;
begin
 if auth.role()<>'service_role' then raise exception 'unauthorized'; end if;
 if length(btrim(coalesce(p_reason,'')))=0 then raise exception 'reason_required'; end if;
 update public.agent_tasks t set
 status=case when t.attempt_count>=t.max_attempts then 'blocked' else 'failed' end,
 available_at=now()+make_interval(secs=>least(3600,30*power(2,least(t.attempt_count,7)-1)::int)),
 lease_until=null,execution_token=null,updated_at=now()
 where t.id=p_task_id and t.execution_token=p_token and t.status='running';
 get diagnostics v_changed=row_count;
 if v_changed=1 then
 insert into public.agent_audit_events(task_id,event_type,details)
 values(p_task_id,'six_agent_failure',jsonb_build_object('reason_code',left(p_reason,100)));
 end if;
 return v_changed=1;
end $$;
revoke all on function public.six_agent_claim(text,integer) from public,anon,authenticated;
revoke all on function public.six_agent_complete(text,uuid,text) from public,anon,authenticated;
revoke all on function public.six_agent_fail(text,uuid,text) from public,anon,authenticated;
grant execute on function public.six_agent_claim(text,integer) to service_role;
grant execute on function public.six_agent_complete(text,uuid,text) to service_role;
grant execute on function public.six_agent_fail(text,uuid,text) to service_role;
