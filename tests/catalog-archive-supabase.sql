-- Synthetic copy of the observed hosted catalog archive migration.
-- It intentionally preserves its original grants so the isolated test can detect effective exposure.
create table if not exists public.product_catalog_archive (
  archive_id uuid primary key default gen_random_uuid(),
  operation_id text not null,
  archived_at timestamptz not null default now(),
  product_id uuid not null,
  product jsonb not null,
  unique (operation_id, product_id)
);

alter table public.product_catalog_archive enable row level security;
revoke all on table public.product_catalog_archive from anon, authenticated;
grant select, insert, update, delete on table public.product_catalog_archive to service_role;

create or replace function public.archive_and_clear_products(p_operation_id text)
returns integer
language plpgsql
security invoker
set search_path = public
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

  delete from public.products;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.archive_and_clear_products(text) from public;
grant execute on function public.archive_and_clear_products(text) to service_role;
-- Reproduce the effective hosted ACL observed after the historical migration.
grant execute on function public.archive_and_clear_products(text) to anon, authenticated;
