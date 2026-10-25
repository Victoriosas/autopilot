-- Fixed-purpose claim for public-site health, reusing the six-agent queue.
-- Restricted to service_role and exact safe task prefix/action.
create or replace function public.six_agent_claim_public_health(p_lease_seconds integer default 90)
returns table(task_id text, claim_token uuid)
language plpgsql security definer set search_path = ''
as $$
declare v_id text; v_token uuid;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'unauthorized'; end if;
 if p_lease_seconds not between 15 and 180 then raise exception 'invalid_lease'; end if;
 select t.id into v_id from public.agent_tasks t
 where t.agent_id='infrastructure'
   and t.actor='six-agent-safe-worker'
   and t.action='read_only_public_health'
   and t.id like 'six-health:infrastructure:%'
   and t.input->>'kind'='public_site_health'
   and t.attempt_count<t.max_attempts
   and ((t.status in ('queued','failed') and t.available_at<=now())
     or (t.status='running' and t.lease_until<now() and t.execution_token is not null))
 order by t.created_at asc limit 1 for update skip locked;
 if v_id is null then return; end if;
 v_token:=gen_random_uuid();
 update public.agent_tasks t set status='running',
  attempt_count=t.attempt_count+1,
  execution_token=v_token,lease_until=now()+make_interval(secs=>p_lease_seconds),
  updated_at=now() where t.id=v_id;
 insert into public.agent_audit_events(task_id,event_type,details)
 values(v_id,'six_agent_claim',jsonb_build_object('agent','infrastructure','operation','public_site_health'));
 return query select v_id,v_token;
end $$;
revoke all on function public.six_agent_claim_public_health(integer) from public,anon,authenticated;
grant execute on function public.six_agent_claim_public_health(integer) to service_role;
