-- The hosted ACL exposed this catalog-wide destructive RPC to public API roles.
-- Keep the operation for controlled maintenance and make service_role the only caller.
create or replace function public.archive_and_clear_products(p_operation_id text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  removed integer;
begin
  if p_operation_id is null or length(trim(p_operation_id)) < 8 then
    raise exception 'operation_id_required';
  end if;

  if exists (
    select 1 from public.product_catalog_archive
    where operation_id = p_operation_id
  ) then
    return 0;
  end if;

  insert into public.product_catalog_archive(operation_id, product_id, product)
  select p_operation_id, p.id, to_jsonb(p)
  from public.products p;

  -- Supabase safe-update rejects catalog-wide DELETE without an explicit predicate.
  delete from public.products p where p.id is not null;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.archive_and_clear_products(text)
  from public, anon, authenticated;
grant execute on function public.archive_and_clear_products(text)
  to service_role;
