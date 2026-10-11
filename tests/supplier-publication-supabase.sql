-- Synthetic hosted publication baseline for isolated Supabase tests.
-- Reproduces migration 20260917040051 without applying it to a remote project.
alter table public.products
  add column if not exists slug text,
  add column if not exists description text,
  add column if not exists subtitle text,
  add column if not exists category text,
  add column if not exists rating numeric,
  add column if not exists review_count integer not null default 0,
  add column if not exists tags jsonb not null default '[]'::jsonb,
  add column if not exists features jsonb not null default '[]'::jsonb,
  add column if not exists specs jsonb not null default '{}'::jsonb,
  add column if not exists brand text,
  add column if not exists supplier_id uuid,
  add column if not exists traceability jsonb not null default '{}'::jsonb,
  add column if not exists source_url text,
  add column if not exists created_by text;

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique
);
create table public.autopilot_product_drafts (
  id uuid primary key default gen_random_uuid(),
  source_candidate_id text not null,
  status text not null,
  reviewed_by text,
  draft jsonb not null,
  published_product_id uuid,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.suppliers enable row level security;
alter table public.autopilot_product_drafts enable row level security;
revoke all on public.suppliers, public.autopilot_product_drafts from public, anon, authenticated;
grant select, insert, update, delete on public.suppliers, public.autopilot_product_drafts to service_role;

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
revoke all on function public.publish_autopilot_draft(uuid) from public, anon, authenticated;
grant execute on function public.publish_autopilot_draft(uuid) to service_role;