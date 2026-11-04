-- Additive, inactive until reviewed deployment and capability attestation.
-- Rollback: disable checkout, leave durable records intact. Do not drop paid orders.
create table public.commerce_checkout_sessions (
 order_id uuid primary key references public.orders(id) on delete cascade,
 idempotency_key text not null unique,
 request jsonb not null,
 state text not null default 'held' check (state in ('held','paid','released')),
 expires_at timestamptz not null default (now()+interval '15 minutes'),
 checkout_url text,
 provider_order_id text,
 provider_started boolean not null default false,
 expiry_checked_at timestamptz,
 provider_terminal boolean not null default false
);
create table public.commerce_fulfillment_jobs (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null unique references public.orders(id) on delete cascade,
 state text not null default 'pending' check (state in ('pending','running','done')),
 owner text, generation integer not null default 0, lease_until timestamptz,
 attempts integer not null default 0, last_error text, result jsonb
);
create table public.commerce_payment_capabilities (
 provider text not null, environment text not null, currency text not null,
 verified_at timestamptz not null, valid_until timestamptz not null,
 evidence_reference text not null check (length(evidence_reference)>0),
 fulfillment_verified boolean not null default false,
 primary key(provider,environment,currency)
);
create table public.commerce_manual_fulfillment_tasks (
 order_id uuid primary key references public.orders(id) on delete cascade,
 state text not null default 'awaiting_owner_approval', created_at timestamptz not null default now()
);
alter table public.commerce_checkout_sessions enable row level security;
alter table public.commerce_fulfillment_jobs enable row level security;
alter table public.commerce_payment_capabilities enable row level security;
alter table public.commerce_manual_fulfillment_tasks enable row level security;
revoke all on public.commerce_checkout_sessions,public.commerce_fulfillment_jobs,public.commerce_payment_capabilities from public,anon,authenticated;
grant select,insert,update on public.commerce_checkout_sessions,public.commerce_fulfillment_jobs to service_role;
grant select on public.commerce_payment_capabilities to service_role;
revoke all on public.commerce_manual_fulfillment_tasks from public,anon,authenticated;
grant select,insert on public.commerce_manual_fulfillment_tasks to service_role;

create function public.commerce_checkout_command(command text,args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 s public.commerce_checkout_sessions%rowtype; o public.orders%rowtype;
 p public.products%rowtype; j public.commerce_fulfillment_jobs%rowtype;
 item jsonb; items jsonb='[]'; quantity integer; subtotal numeric=0;
 shipping numeric; total numeric; amount numeric; key text; request jsonb; order_id uuid;
begin
 if command='capabilities' then
  return jsonb_build_object('atomicCheckout',true,'fulfillmentQueue',true,'available',exists(
   select 1 from public.commerce_payment_capabilities c where c.provider=args->>'provider'
    and c.environment=args->>'environment' and c.currency=args->>'currency'
    and c.verified_at<=now() and c.valid_until>now() and c.fulfillment_verified));
 end if;
 if command='expired' then
  with candidates as (
   select cs.order_id from public.commerce_checkout_sessions cs
   where cs.state='held' and cs.expires_at<=now()
   order by cs.expiry_checked_at nulls first,cs.expires_at,cs.order_id
   limit 20 for update skip locked
  ), checked as (
   update public.commerce_checkout_sessions cs set expiry_checked_at=clock_timestamp()
   from candidates c where cs.order_id=c.order_id
   returning cs.order_id,cs.provider_order_id,cs.provider_started
  ) select jsonb_build_object('reservations',coalesce(jsonb_agg(jsonb_build_object('orderId',x.order_id,'providerOrderId',x.provider_order_id,'providerStarted',x.provider_started)),'[]'::jsonb)) into item from checked x;
  return item;
 end if;
 if command='manual_tasks' then
  return jsonb_build_object('tasks',coalesce((select jsonb_agg(to_jsonb(t)) from
   (select mt.order_id,mt.state,mt.created_at from public.commerce_manual_fulfillment_tasks mt order by mt.created_at limit 100) t),'[]'::jsonb));
 end if;
 if command='reserve' then
  key:=args->>'key';
  if key is null or key !~ '^[a-zA-Z0-9_-]{16,128}$' then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  if args->>'provider' is distinct from 'mercadopago' or args->>'currency' is distinct from 'UYU' then raise exception 'CHECKOUT_PROVIDER_NOT_SUPPORTED'; end if;
  if jsonb_typeof(args->'items') is distinct from 'array' or jsonb_array_length(args->'items') not between 1 and 50 then raise exception 'INVALID_CHECKOUT_ITEMS'; end if;
  shipping:=coalesce((args->>'shipping')::numeric,0);
  if shipping<0 or shipping::text in ('NaN','Infinity','-Infinity') then raise exception 'INVALID_SHIPPING'; end if;
  -- Ignore client totals; key binds all server-approved checkout intent/config.
  request:=args-'key'-'total';
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(key,0));
  select * into s from public.commerce_checkout_sessions where idempotency_key=key for update;
  if found then
   if s.request<>request then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
   select * into o from public.orders where id=s.order_id;
   return jsonb_build_object('orderId',o.id,'total',o.total,'currency',o.currency,'items',o.items,'shipping',o.shipping_cost,'state',s.state,'expired',s.expires_at<=now(),'checkoutUrl',s.checkout_url,'providerOrderId',s.provider_order_id);
  end if;
  if (select count(*) from jsonb_array_elements(args->'items'))<>(select count(distinct x->>'productId') from jsonb_array_elements(args->'items') x) then raise exception 'INVALID_CHECKOUT_ITEMS'; end if;
  -- Lock rows in stable ID order so multi-item baskets cannot deadlock each other.
  for item in select x from jsonb_array_elements(args->'items') x order by x->>'productId' loop
   if jsonb_typeof(item->'quantity') is distinct from 'number' or item->>'quantity' !~ '^[0-9]+$' then raise exception 'INVALID_CHECKOUT_ITEM'; end if;
   quantity:=(item->>'quantity')::integer;
   if quantity not between 1 and 20 or coalesce(item->>'selectedVariant','')<>'' then raise exception 'INVALID_CHECKOUT_ITEM'; end if;
   select * into p from public.products where id=(item->>'productId')::uuid for update;
   if not found or p.status is distinct from 'published' then raise exception 'PRODUCT_NOT_AVAILABLE'; end if;
   if p.currency is distinct from args->>'currency' then raise exception 'PRODUCT_CURRENCY_NOT_CONFIGURED'; end if;
   if p.inventory is null or p.inventory<quantity then raise exception 'PRODUCT_OUT_OF_STOCK'; end if;
   if p.price is null or p.price<=0 or p.price::text in ('NaN','Infinity','-Infinity') then raise exception 'INVALID_PRODUCT_PRICE'; end if;
   update public.products set inventory=inventory-quantity where id=p.id;
   items:=items||jsonb_build_array(jsonb_build_object('productId',p.id,'title',p.title,'price',p.price,'quantity',quantity,'sku',p.sku,'image',coalesce(p.images[1],'')));
   subtotal:=subtotal+p.price*quantity;
  end loop;
  subtotal:=round(subtotal,2);
  if coalesce((args->>'freeShippingFrom')::numeric,0)>0 and subtotal>=(args->>'freeShippingFrom')::numeric then shipping:=0; end if;
  total:=round(subtotal+shipping,2); order_id:=gen_random_uuid();
  insert into public.orders(id,order_number,user_id,customer_email,customer_name,customer_phone,customer_address,customer_city,customer_postal_code,customer_country,
   items,subtotal,shipping_cost,discount,total,currency,payment_method,payment_status,status,tracking_number,estimated_delivery)
  values(order_id,'VIC-MP-'||upper(order_id::text),nullif(args->>'userId','')::uuid,args#>>'{customer,email}',coalesce(args#>>'{customer,fullName}',args#>>'{customer,name}'),args#>>'{customer,phone}',args#>>'{customer,address}',args#>>'{customer,city}',args#>>'{customer,postalCode}',args#>>'{customer,country}',
   items,subtotal,shipping,0,total,args->>'currency',args->>'provider','pending','pending_payment','','');
  insert into public.commerce_checkout_sessions(order_id,idempotency_key,request) values(order_id,key,request);
  return jsonb_build_object('orderId',order_id,'total',total,'currency',args->>'currency','items',items,'shipping',shipping,'state','held','checkoutUrl',null);
 end if;
 if command='claim_fulfillment' then
  if coalesce(args->>'owner','')='' then raise exception 'FULFILLMENT_OWNER_REQUIRED'; end if;
  select * into j from public.commerce_fulfillment_jobs where state='pending' or (state='running' and lease_until<now()) order by id for update skip locked limit 1;
  if not found then return jsonb_build_object('job',null); end if;
  update public.commerce_fulfillment_jobs set state='running',owner=args->>'owner',generation=generation+1,attempts=attempts+1,lease_until=now()+interval '2 minutes'
   where id=j.id returning * into j;
  return jsonb_build_object('job',to_jsonb(j));
 end if;
 if command in ('finish_fulfillment','retry_fulfillment','prepare_fulfillment') then
  select * into strict j from public.commerce_fulfillment_jobs where id=(args->>'id')::uuid for update;
  if j.state<>'running' or j.owner is distinct from args->>'owner' or j.generation is distinct from (args->>'generation')::integer or j.lease_until is null or j.lease_until<clock_timestamp() then raise exception 'FULFILLMENT_FENCE_REJECTED'; end if;
  if command='prepare_fulfillment' then
   select * into strict o from public.orders where id=j.order_id;
   if o.payment_status is distinct from 'paid' then raise exception 'PAID_ORDER_REQUIRED'; end if;
   insert into public.commerce_manual_fulfillment_tasks(order_id) values(j.order_id) on conflict do nothing;
   return jsonb_build_object('taskId',j.order_id,'requiresOwnerApproval',true);
  end if;
  update public.commerce_fulfillment_jobs set state=case when command='finish_fulfillment' then 'done' else 'pending' end,
   last_error=case when command='retry_fulfillment' then 'FULFILLMENT_RETRY_REQUIRED' else null end,result=args->'result',lease_until=null where id=j.id;
  return jsonb_build_object('ok',true);
 end if;
 select * into strict s from public.commerce_checkout_sessions where commerce_checkout_sessions.order_id=(args->>'orderId')::uuid for update;
 select * into strict o from public.orders where id=s.order_id for update;
 if command='begin_provider' then
  if s.state<>'held' then raise exception 'RESERVATION_NOT_ACTIVE'; end if;
  if s.expires_at<=now() then raise exception 'RESERVATION_EXPIRED'; end if;
  update public.commerce_checkout_sessions set provider_started=true where commerce_checkout_sessions.order_id=s.order_id;
  return jsonb_build_object('ok',true);
 end if;
 if command='bind' then
  if coalesce(args->>'providerOrderId','')='' or coalesce(args->>'checkoutUrl','')!~ '^https://' then raise exception 'INVALID_PROVIDER_ORDER'; end if;
  if s.provider_order_id is not null and s.provider_order_id<>args->>'providerOrderId' then raise exception 'PAYMENT_PROVIDER_MISMATCH'; end if;
  if s.state<>'held' then raise exception 'RESERVATION_NOT_ACTIVE'; end if;
  update public.commerce_checkout_sessions set provider_order_id=args->>'providerOrderId',checkout_url=args->>'checkoutUrl',provider_started=true where commerce_checkout_sessions.order_id=s.order_id;
  update public.orders set provider_order_id=args->>'providerOrderId',provider_amount=o.total,provider_currency=o.currency where id=s.order_id;
  return jsonb_build_object('ok',true,'expired',s.expires_at<=now());
 end if;
 if command in ('reject','expire') then
  if s.state='held' and (command='reject' or s.expires_at<=now()) then
   if s.provider_started and not s.provider_terminal then raise exception 'PROVIDER_OUTCOME_UNKNOWN'; end if;
   for item in select x from jsonb_array_elements(o.items) x order by x->>'productId' loop
    update public.products set inventory=inventory+(item->>'quantity')::integer where id=(item->>'productId')::uuid;
   end loop;
   update public.commerce_checkout_sessions set state='released' where commerce_checkout_sessions.order_id=s.order_id;
   update public.orders set payment_status='failed',status='cancelled' where id=s.order_id;
  end if;
  return jsonb_build_object('ok',true);
 end if;
 if command='payment' then
  if s.provider_order_id is null or s.provider_order_id is distinct from args->>'providerOrderId' then raise exception 'PAYMENT_PROVIDER_MISMATCH'; end if;
  amount:=(args->>'amount')::numeric;
  if amount is null or amount<=0 or amount::text in ('NaN','Infinity','-Infinity') then raise exception 'INVALID_PAYMENT_AMOUNT'; end if;
  if amount<>o.total then raise exception 'PAYMENT_AMOUNT_MISMATCH'; end if;
  if args->>'currency' is distinct from o.currency then raise exception 'PAYMENT_CURRENCY_MISMATCH'; end if;
  if s.state='released' then raise exception 'RESERVATION_NOT_ACTIVE'; end if;
  if args->>'status' in ('failed','cancelled','expired') then
   update public.commerce_checkout_sessions set provider_terminal=true where commerce_checkout_sessions.order_id=s.order_id;
  end if;
  if args->>'status'='processed' then
   -- A late provider payment is safe while stock is still held. Never release
   -- an uncertain provider operation or regress a paid/shipped order on replay.
   if s.state='held' then
    update public.commerce_checkout_sessions set state='paid' where commerce_checkout_sessions.order_id=s.order_id;
    update public.orders set payment_status='paid',payment_id=s.provider_order_id,payment_gateway=payment_method,status='confirmed' where id=s.order_id;
    insert into public.commerce_fulfillment_jobs(order_id) values(s.order_id) on conflict do nothing;
   end if;
   return jsonb_build_object('orderId',s.order_id,'paymentStatus','paid','total',o.total,'currency',o.currency);
  end if;
  return jsonb_build_object('orderId',s.order_id,'paymentStatus',o.payment_status,'total',o.total,'currency',o.currency);
 end if;
 raise exception 'UNKNOWN_COMMERCE_COMMAND';
end $$;
revoke all on function public.commerce_checkout_command(text,jsonb) from public,anon,authenticated;
grant execute on function public.commerce_checkout_command(text,jsonb) to service_role;
