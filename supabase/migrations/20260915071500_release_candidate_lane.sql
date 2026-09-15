-- Owner release-candidate lane.
-- Production validation may finish with an approved, publishable draft without
-- mutating the public catalog. Manual publication remains a separate admin act.

alter table public.products
  add column if not exists publication_eligible boolean not null default false;

alter table public.autopilot_sourcing_items
  drop constraint if exists autopilot_sourcing_items_status_check;
alter table public.autopilot_sourcing_items
  add constraint autopilot_sourcing_items_status_check check (status in (
    'discovered','normalized','needs_evidence','evidence_validated','evidence_rejected',
    'opportunity_scored','pricing_completed','pricing_rejected','draft_created',
    'council_pending','council_approved','council_rejected','shadow_completed',
    'production_ready','published','failed_retryable','failed_terminal'
  ));

-- Preserve the proven durable command implementation and wrap only release so
-- production_ready is considered terminal. The wrapper is intentionally thin:
-- all fencing, leases, retries and idempotency stay in the original function.
alter function public.autopilot_sourcing_command(text,jsonb)
  rename to autopilot_sourcing_command_v1;

create function public.autopilot_sourcing_command(command text, args jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb; run_id uuid;
begin
  result := public.autopilot_sourcing_command_v1(command,args);
  if command<>'release' then return result; end if;

  run_id := nullif(result->>'id','')::uuid;
  if run_id is null or result->>'status'<>'queued' then return result; end if;

  if exists(select 1 from public.autopilot_sourcing_runs r where r.id=run_id and r.discovery_done)
     and not exists(
       select 1 from public.autopilot_sourcing_items i
       where i.run_id=run_id and i.status not in (
         'needs_evidence','evidence_rejected','pricing_rejected','council_rejected',
         'shadow_completed','production_ready','published','failed_terminal'
       )
     ) then
    update public.autopilot_sourcing_runs
      set status=case when exists(select 1 from public.autopilot_sourcing_items i where i.run_id=run_id and i.draft_id is not null)
                      then 'completed' else 'completed_no_candidates' end,
          completed_at=coalesce(completed_at,now()),updated_at=now()
      where id=run_id;
    select to_jsonb(r) into result from public.autopilot_sourcing_runs r where r.id=run_id;
  end if;
  return result;
end $$;
revoke all on function public.autopilot_sourcing_command(text,jsonb) from public,anon,authenticated;
grant execute on function public.autopilot_sourcing_command(text,jsonb) to service_role;
revoke all on function public.autopilot_sourcing_command_v1(text,jsonb) from public,anon,authenticated;
grant execute on function public.autopilot_sourcing_command_v1(text,jsonb) to service_role;

-- Product insertion remains fenced during an active production run. A separate
-- manual-release context is accepted only for a completed production run whose
-- evidence is still fresh and whose draft is explicitly production-eligible.
create or replace function public.autopilot_product_barrier() returns trigger
language plpgsql security invoker set search_path='' as $$
declare d public.autopilot_product_drafts%rowtype; r public.autopilot_sourcing_runs%rowtype;
begin
 if new.traceability->>'draftId' is not null then
  select * into strict d from public.autopilot_product_drafts where id=(new.traceability->>'draftId')::uuid;
  if d.created_in_shadow_mode or not d.publication_eligible then raise exception 'SHADOW_PUBLICATION_DENIED'; end if;
  if d.sourcing_run_id is not null then
   select * into strict r from public.autopilot_sourcing_runs where id=d.sourcing_run_id for update;
   if current_setting('autopilot.manual_release',true)='true' then
    if r.mode<>'production' or r.status<>'completed' or r.completed_at is null
       or r.completed_at < clock_timestamp()-interval '24 hours' then
      raise exception 'MANUAL_RELEASE_EVIDENCE_STALE_OR_INVALID';
    end if;
   elsif r.mode<>'production' or r.id::text is distinct from current_setting('autopilot.run',true)
      or r.lease_generation::text is distinct from current_setting('autopilot.generation',true)
      or r.lease_owner::text is distinct from current_setting('autopilot.owner',true)
      or r.lease_expires_at<=clock_timestamp() then
    raise exception 'FENCE_REJECTED';
   end if;
  end if;
  new.commercial_identity := d.commercial_identity;
  new.publication_eligible := true;
 end if;
 return new;
end $$;

-- Manual publication is service-role only, idempotent, and requires a durable
-- production_ready item backed by Council approval and fresh production evidence.
create or replace function public.publish_autopilot_draft_manual(draft_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare d public.autopilot_product_drafts%rowtype; r public.autopilot_sourcing_runs%rowtype;
        i public.autopilot_sourcing_items%rowtype; result jsonb;
begin
  select * into strict d from public.autopilot_product_drafts where id=draft_id for update;
  if d.status='published' and d.published_product_id is not null then return to_jsonb(d); end if;
  if d.created_in_shadow_mode or not d.publication_eligible then raise exception 'SHADOW_PUBLICATION_DENIED'; end if;
  if d.status<>'ai_approved' or d.reviewed_by not like 'autopilot-council:%' then raise exception 'COUNCIL_APPROVAL_REQUIRED'; end if;
  if d.sourcing_run_id is null then raise exception 'PRODUCTION_SOURCING_RUN_REQUIRED'; end if;

  select * into strict r from public.autopilot_sourcing_runs where id=d.sourcing_run_id for update;
  if r.mode<>'production' or r.status<>'completed' or r.completed_at is null
     or r.completed_at < clock_timestamp()-interval '24 hours' then
    raise exception 'MANUAL_RELEASE_EVIDENCE_STALE_OR_INVALID';
  end if;

  select * into strict i from public.autopilot_sourcing_items
   where run_id=r.id and draft_id=d.id for update;
  if i.status not in ('production_ready','published')
     or coalesce(i.council->>'decision','')<>'approve'
     or coalesce((i.council->>'ownerEscalationRequired')::boolean,true) then
    raise exception 'PRODUCTION_READY_COUNCIL_REQUIRED';
  end if;

  perform set_config('autopilot.manual_release','true',true);
  result := public.publish_autopilot_draft(d.id);
  update public.autopilot_sourcing_items
    set status='published',checkpoint=checkpoint || jsonb_build_object('published',true,'manualPublishedAt',now()),updated_at=now()
    where id=i.id and status<>'published';
  return result;
end $$;
revoke all on function public.publish_autopilot_draft_manual(uuid) from public,anon,authenticated;
grant execute on function public.publish_autopilot_draft_manual(uuid) to service_role;
