-- Isolated reproduction of the hosted supplier-aware publication function.
-- This fixture is applied only to the disposable PostgreSQL integration database.
create or replace function public.publish_autopilot_draft(draft_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare d public.autopilot_product_drafts%rowtype; p uuid; price_value numeric; supplier_uuid uuid;
begin
  select * into strict d from public.autopilot_product_drafts where id=draft_id for update;
  if d.status='published' and d.published_product_id is not null then return to_jsonb(d); end if;
  if d.status<>'ai_approved' or d.reviewed_by not like 'autopilot-council:%' then raise exception 'COUNCIL_APPROVAL_REQUIRED'; end if;
  if coalesce(d.draft #>> '{provenance,supplierCost}','') not in ('observed','verified') then raise exception 'SUPPLIER_EVIDENCE_REQUIRED'; end if;
  if coalesce(d.draft->>'currency','') !~ '^[A-Z]{3}$' then raise exception 'CURRENCY_REQUIRED'; end if;
  price_value := (d.draft->>'price')::numeric;
  if price_value is null or price_value<=0 or price_value::text in ('NaN','Infinity','-Infinity') then raise exception 'INVALID_PRICE'; end if;
  if coalesce(btrim(d.draft->>'title'),'')='' then raise exception 'TITLE_REQUIRED'; end if;
  select s.id into supplier_uuid from public.suppliers s
    where s.code = nullif(d.draft #>> '{provenance,supplierCode}','') limit 1;
  p := gen_random_uuid();
  insert into public.products(id,title,slug,sku,description,subtitle,category,price,currency,
    inventory,rating,review_count,status,tags,features,specs,images,brand,supplier_id,traceability,source_url,created_by)
  values(p,d.draft->>'title','victoriosa-'||p::text,
    coalesce(nullif(d.draft #>> '{provenance,sourceSku}',''),'VIC-'||p::text),
    d.draft->>'description',d.draft->>'subtitle',d.draft->>'category',price_value,d.draft->>'currency',
    0,null,0,'published',coalesce(d.draft->'tags','[]'::jsonb),coalesce(d.draft->'features','[]'::jsonb),
    coalesce(d.draft->'specs','{}'::jsonb),array(select jsonb_array_elements_text(coalesce(d.draft->'images','[]'::jsonb))),
    'Victoriosa',supplier_uuid,
    jsonb_build_object(
      'draftId',d.id,'provenance',d.draft->'provenance','commercial',d.draft->'commercial',
      'supplier',jsonb_build_object(
        'name',d.draft #>> '{provenance,supplierName}',
        'code',d.draft #>> '{provenance,supplierCode}',
        'shopId',d.draft #>> '{provenance,supplierShopId}',
        'externalId',d.draft #>> '{provenance,supplierExternalId}'
      )
    ),d.draft #>> '{provenance,sourceUrl}','Autopilot Council');
  update public.autopilot_product_drafts set status='published',published_product_id=p,published_at=now(),updated_at=now()
    where id=draft_id returning * into d;
  return to_jsonb(d);
end $function$;
