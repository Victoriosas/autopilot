-- Dedicated synthetic lab grants; hosted use only inside the reviewed P0C bootstrap transaction.
-- The operator creates a LOGIN role separately; no password, role creation or automatic migration here.
begin;
do $$ begin
 if current_database()='postgres' then
   if not exists(select 1 from public.autopilot_hosted_lab where project_ref='juyowvmtluxfetgkckjd')
   then raise exception 'isolated_hosted_lab_required'; end if;
 end if;
 if current_database() not in ('victoriosa_mission_operator_lab','postgres')
   or not exists(select 1 from public.autopilot_local_lab)
   or not exists(select 1 from pg_roles where rolname='autopilot_cloud_runner'
     and not (rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls))
   or exists(select 1 from pg_auth_members where member=(select oid from pg_roles where rolname='autopilot_cloud_runner'))
 then raise exception 'isolated_cloud_lab_required';end if;
end $$;
revoke create on schema public from public;
do $$ begin execute format('grant connect on database %I to autopilot_cloud_runner',current_database()); end $$;
grant usage on schema public to autopilot_cloud_runner;
grant select on public.autopilot_local_lab,public.agent_tasks,public.agent_audit_events to autopilot_cloud_runner;
create policy cloud_synthetic_binding_read on public.autopilot_local_lab for select to autopilot_cloud_runner using(true);
create policy cloud_synthetic_tasks_read on public.agent_tasks for select to autopilot_cloud_runner
 using(actor='autopilot-local-cli' and id ~ '^synthetic-[a-z0-9-]{1,60}$');
create policy cloud_synthetic_audit_read on public.agent_audit_events for select to autopilot_cloud_runner
 using(exists(select 1 from public.agent_tasks t where t.id=task_id));
grant execute on function public.local_mission_claim(text,text,uuid,integer),
 public.local_mission_cancel(text,text),public.six_agent_checkpoint(text,text,uuid,integer,text,text,jsonb),
 public.six_agent_complete(text,uuid,text),public.six_agent_fail(text,uuid,text),
 public.six_agent_save_plan(text,uuid,integer,text,text,jsonb),public.six_agent_block_mission(text,uuid,integer,text)
 to autopilot_cloud_runner;
commit;
