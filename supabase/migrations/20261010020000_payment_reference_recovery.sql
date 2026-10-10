-- Additive recovery only. No payment creation and no stock release.
create unique index commerce_provider_order_unique on public.commerce_checkout_sessions(provider_order_id)
 where provider_order_id is not null;

create function public.commerce_recover_provider_order(args jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 s public.commerce_checkout_sessions%rowtype;
 o public.orders%rowtype;
 amount numeric;
begin
 select * into strict s from public.commerce_checkout_sessions cs where cs.order_id=(args->>'orderId')::uuid for update;
 select * into strict o from public.orders where id=s.order_id for update;
 if o.payment_method is distinct from 'mercadopago' or not s.provider_started then raise exception 'PROVIDER_OPERATION_NOT_STARTED'; end if;
 if args->>'reference' is distinct from s.order_id::text then raise exception 'PAYMENT_REFERENCE_MISMATCH'; end if;
 if coalesce(args->>'providerOrderId','') !~ '^[A-Za-z0-9_-]{1,128}$' then raise exception 'INVALID_PROVIDER_ORDER'; end if;
 if jsonb_typeof(args->'amount') is distinct from 'number' then raise exception 'INVALID_PAYMENT_AMOUNT'; end if;
 amount:=(args->>'amount')::numeric;
 if amount<=0 or amount::text in ('NaN','Infinity','-Infinity') or amount<>o.total then raise exception 'PAYMENT_AMOUNT_MISMATCH'; end if;
 if args->>'currency' is distinct from o.currency then raise exception 'PAYMENT_CURRENCY_MISMATCH'; end if;
 if s.provider_order_id is not null and s.provider_order_id<>args->>'providerOrderId' then raise exception 'PAYMENT_PROVIDER_MISMATCH'; end if;
 if o.provider_order_id is not null and o.provider_order_id<>args->>'providerOrderId' then raise exception 'PAYMENT_PROVIDER_MISMATCH'; end if;
 if s.state='released' then raise exception 'RESERVATION_NOT_ACTIVE'; end if;
 update public.commerce_checkout_sessions set provider_order_id=args->>'providerOrderId' where order_id=s.order_id;
 update public.orders set provider_order_id=args->>'providerOrderId',provider_amount=o.total,provider_currency=o.currency where id=s.order_id;
 return jsonb_build_object('orderId',s.order_id,'providerOrderId',args->>'providerOrderId','state',s.state);
end $$;
revoke all on function public.commerce_recover_provider_order(jsonb) from public,anon,authenticated;
grant execute on function public.commerce_recover_provider_order(jsonb) to service_role;
