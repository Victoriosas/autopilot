-- Preserve publication fencing while allowing stock reservation/restoration on
-- already published products. RLS/table privileges still authorize the writer.
create or replace function public.autopilot_product_barrier() returns trigger
language plpgsql security invoker set search_path='' as $$
declare d public.autopilot_product_drafts%rowtype; r public.autopilot_sourcing_runs%rowtype;
begin
 if TG_OP='UPDATE' then
  if old.traceability->>'draftId' is not null
     and (new.traceability->>'draftId') is distinct from (old.traceability->>'draftId') then
   raise exception 'PRODUCT_ORIGIN_IMMUTABLE';
  end if;
  -- Compare the entire row so new commercial columns remain protected by default.
  if old.status='published' and old.publication_eligible
     and (to_jsonb(new)-'inventory'-'updated_at')=(to_jsonb(old)-'inventory'-'updated_at') then
   return new;
  end if;
 end if;
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
