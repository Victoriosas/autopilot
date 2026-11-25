-- A worker may fail a task only while its claim lease is still current.
-- Keep the agent ledger unavailable to browser roles even if policies are
-- introduced later; service_role remains the only application API caller.
revoke all on table public.agent_tasks, public.agent_audit_events
  from public, anon, authenticated;

create or replace function public.six_agent_fail(
  p_task_id text,
  p_token uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'unauthorized';
  end if;
  if length(btrim(coalesce(p_reason, ''))) = 0 then
    raise exception 'reason_required';
  end if;

  update public.agent_tasks t set
    status = case when t.attempt_count >= t.max_attempts then 'blocked' else 'failed' end,
    available_at = now() + make_interval(secs => least(3600, 30 * power(2, least(t.attempt_count, 7) - 1)::int)),
    lease_until = null,
    execution_token = null,
    updated_at = now()
  where t.id = p_task_id
    and t.execution_token = p_token
    and t.status = 'running'
    and t.lease_until > clock_timestamp();

  get diagnostics v_changed = row_count;
  if v_changed = 1 then
    insert into public.agent_audit_events(task_id, event_type, details)
    values (p_task_id, 'six_agent_failure', jsonb_build_object('reason_code', left(p_reason, 100)));
  end if;
  return v_changed = 1;
end;
$$;

revoke all on function public.six_agent_fail(text, uuid, text) from public, anon, authenticated;
grant execute on function public.six_agent_fail(text, uuid, text) to service_role;

-- Aggregate privately in Postgres; never transfer completion evidence text to
-- the Edge Function merely to count rows with evidence.
create or replace function public.six_agent_report_metrics()
returns table(
  agent_id text,
  queued bigint,
  running bigint,
  failed bigint,
  blocked bigint,
  completed_with_evidence bigint,
  last_activity timestamptz,
  observed_rows bigint,
  unassigned bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'unauthorized';
  end if;

  return query
  with allowed_agents(agent_id) as (
    values ('director'::text), ('software'), ('infrastructure'),
      ('consultations'), ('followup'), ('reports')
  ), totals as (
    select count(*)::bigint as observed_rows,
      count(*) filter (where t.agent_id is null or t.agent_id <> all(array[
        'director','software','infrastructure','consultations','followup','reports'
      ]::text[]))::bigint as unassigned
    from public.agent_tasks t
  ), per_agent as (
    select t.agent_id,
      count(*) filter (where t.status='queued')::bigint as queued,
      count(*) filter (where t.status='running')::bigint as running,
      count(*) filter (where t.status='failed')::bigint as failed,
      count(*) filter (where t.status='blocked')::bigint as blocked,
      count(*) filter (
        where t.status='completed' and nullif(btrim(t.completed_evidence), '') is not null
      )::bigint as completed_with_evidence,
      max(t.updated_at) as last_activity
    from public.agent_tasks t
    group by t.agent_id
  )
  select a.agent_id,
    coalesce(p.queued, 0), coalesce(p.running, 0),
    coalesce(p.failed, 0), coalesce(p.blocked, 0),
    coalesce(p.completed_with_evidence, 0), p.last_activity,
    totals.observed_rows, totals.unassigned
  from allowed_agents a
  left join per_agent p using (agent_id)
  cross join totals
  order by a.agent_id;
end;
$$;

revoke all on function public.six_agent_report_metrics() from public, anon, authenticated;
grant execute on function public.six_agent_report_metrics() to service_role;
