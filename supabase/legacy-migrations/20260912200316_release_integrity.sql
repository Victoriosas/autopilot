-- Additive rollout: existing catalog currency remains unknown until verified.
alter table public.products add column if not exists currency text;
alter table public.orders
  add column if not exists provider_order_id text,
  add column if not exists provider_amount numeric,
  add column if not exists provider_currency text;
create unique index if not exists orders_provider_order_uidx
  on public.orders(payment_method, provider_order_id) where provider_order_id is not null;

-- A single transaction owns approval, product insertion and publication marking.
-- Invoker security plus explicit service-role-only EXECUTE keeps browser users out.
create or replace function public.publish_autopilot_draft(draft_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare d public.autopilot_product_drafts%rowtype; p uuid; price_value numeric;
begin
  select * into strict d from public.autopilot_product_drafts where id=draft_id for update;
  if d.status='published' and d.published_product_id is not null then return to_jsonb(d); end if;
  if d.status<>'ai_approved' or d.reviewed_by not like 'autopilot-council:%' then
    raise exception 'COUNCIL_APPROVAL_REQUIRED';
  end if;
  if coalesce(d.draft #>> '{provenance,supplierCost}','') not in ('observed','verified') then
    raise exception 'SUPPLIER_EVIDENCE_REQUIRED';
  end if;
  if coalesce(d.draft->>'currency','') !~ '^[A-Z]{3}$' then raise exception 'CURRENCY_REQUIRED'; end if;
  price_value := (d.draft->>'price')::numeric;
  if price_value is null or price_value<=0 or price_value::text in ('NaN','Infinity','-Infinity') then raise exception 'INVALID_PRICE'; end if;
  if coalesce(btrim(d.draft->>'title'),'')='' then raise exception 'TITLE_REQUIRED'; end if;
  p := gen_random_uuid();
  insert into public.products(id,title,slug,sku,description,subtitle,category,price,currency,
    inventory,rating,review_count,status,tags,features,specs,images,brand,traceability,source_url,created_by)
  values(p,d.draft->>'title','victoriosa-'||p::text,'VIC-'||p::text,
    d.draft->>'description',d.draft->>'subtitle',d.draft->>'category',price_value,d.draft->>'currency',
    0,null,0,'published',coalesce(d.draft->'tags','[]'::jsonb),coalesce(d.draft->'features','[]'::jsonb),
    coalesce(d.draft->'specs','{}'::jsonb),array(select jsonb_array_elements_text(coalesce(d.draft->'images','[]'::jsonb))),
    'Victoriosa',jsonb_build_object('draftId',d.id,'provenance',d.draft->'provenance','commercial',d.draft->'commercial'),
    d.draft #>> '{provenance,sourceUrl}','Autopilot Council');
  update public.autopilot_product_drafts set status='published',published_product_id=p,published_at=now(),updated_at=now()
    where id=draft_id returning * into d;
  return to_jsonb(d);
end $$;
revoke all on function public.publish_autopilot_draft(uuid) from public,anon,authenticated;
grant execute on function public.publish_autopilot_draft(uuid) to service_role;

create or replace function public.apply_autopilot_repricing(proposal_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.autopilot_repricing_proposals%rowtype; p public.products%rowtype; new_price numeric;
begin
  select * into strict r from public.autopilot_repricing_proposals where id=proposal_id for update;
  if r.status='applied' then return to_jsonb(r); end if;
  if r.status<>'ai_approved' or coalesce(r.council->>'decision','')<>'approve' or
     coalesce((r.proposal #>> '{policy,ownerApprovalRequired}')::boolean,true) then
    raise exception 'REPRICING_APPROVAL_REQUIRED';
  end if;
  select * into strict p from public.products where id=r.product_id for update;
  if p.status<>'published' or p.price<>(r.proposal->>'currentPrice')::numeric or
     p.currency is distinct from r.proposal->>'currency' then raise exception 'STALE_PRICE_OR_CURRENCY'; end if;
  new_price := (r.proposal->>'proposedPrice')::numeric;
  if new_price is null or new_price<=0 or new_price::text in ('NaN','Infinity','-Infinity') then raise exception 'INVALID_PRICE'; end if;
  update public.products set price=new_price where id=p.id;
  update public.autopilot_repricing_proposals set status='applied',applied_at=now(),updated_at=now()
    where id=proposal_id returning * into r;
  return to_jsonb(r);
end $$;
revoke all on function public.apply_autopilot_repricing(uuid) from public,anon,authenticated;
grant execute on function public.apply_autopilot_repricing(uuid) to service_role;
