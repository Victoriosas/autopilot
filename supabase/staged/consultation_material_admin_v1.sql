-- STAGED ONLY. Cycle D extends C; no hosted installation or delivery capability.
begin;
create function public.consultation_material_admin_snapshot(p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'ADMIN_REQUIRED';end if;
 return coalesce((select jsonb_agg(item order by created_at desc) from (
  select m.created_at,jsonb_build_object('id',m.id,'review_state',m.review_state,'consent_state',m.consent_state,
   'delivery_decision',m.delivery_decision,'created_at',m.created_at,'updated_at',m.updated_at,'expires_at',m.expires_at,
   'available',public.consultation_material_visible(m.request_id,m.payload,m.consent_state,m.review_state,m.expires_at),
   'metadata',case when public.consultation_material_visible(m.request_id,m.payload,m.consent_state,m.review_state,m.expires_at)
    then jsonb_build_object('intent',m.payload->'intent','channel',m.payload->'channel','sources',m.payload->'sources','consent_version',m.payload->'consent_version') else null end,
   'events',coalesce((select jsonb_agg(e order by e.id) from (
    select id,event,occurred_at from public.consultation_material_events where material_id=m.id order by id desc limit 50
   ) e),'[]'::jsonb)) item
  from public.consultation_material_requests m where request_id=p_request order by created_at desc limit 100
 ) rows),'[]'::jsonb);
end $$;

-- Compare the exact server timestamp, then reuse C's transactional validation/audit.
create function public.consultation_material_admin_review(p_request uuid,p_id uuid,p_updated text,p_state text) returns boolean
language plpgsql security definer set search_path='' as $$
declare saved public.consultation_material_requests;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'ADMIN_REQUIRED';end if;
 select * into saved from public.consultation_material_requests where id=p_id and request_id=p_request for update;
 if not found or p_updated is null or saved.updated_at is distinct from p_updated::timestamptz then return false;end if;
 return public.consultation_material_review(p_id,p_state);
end $$;

-- Scoped deletion, rechecked under row lock; operation tombstones remain until parent retention.
create function public.consultation_material_admin_purge(p_request uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare saved public.consultation_material_requests; erased integer:=0;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'ADMIN_REQUIRED';end if;
 for saved in select * from public.consultation_material_requests where request_id=p_request order by id for update loop
  if not public.consultation_material_visible(saved.request_id,saved.payload,saved.consent_state,saved.review_state,saved.expires_at) then
   update private.consultation_material_keys set retired_at=coalesce(retired_at,now()) where record_id=saved.id;
   delete from public.consultation_material_requests where id=saved.id;
   erased:=erased+1;
  end if;
 end loop;
 return erased;
end $$;
revoke all on function public.consultation_material_admin_snapshot(uuid),public.consultation_material_admin_review(uuid,uuid,text,text),public.consultation_material_admin_purge(uuid) from public,anon,service_role;
grant execute on function public.consultation_material_admin_snapshot(uuid),public.consultation_material_admin_review(uuid,uuid,text,text),public.consultation_material_admin_purge(uuid) to authenticated;
commit;
