-- The hosted ACL exposed this catalog-wide destructive RPC to public API roles.
-- Keep the function for controlled maintenance, but make service_role the only caller.
revoke all on function public.archive_and_clear_products(text)
  from public, anon, authenticated;
grant execute on function public.archive_and_clear_products(text)
  to service_role;

-- Every referenced relation is schema-qualified; built-ins resolve through pg_catalog.
alter function public.archive_and_clear_products(text)
  set search_path = '';
