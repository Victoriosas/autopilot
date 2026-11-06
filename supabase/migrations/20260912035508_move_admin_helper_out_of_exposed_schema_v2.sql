create schema if not exists private;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public, anon;
grant usage on schema private to authenticated, service_role;
grant execute on function private.is_admin() to authenticated, service_role;

alter policy "Admins full access alerts" on public.alerts to authenticated using (private.is_admin()) with check (private.is_admin());
alter policy "Admins read audit_logs" on public.audit_logs to authenticated using (private.is_admin());
alter policy "Admins full access run_logs" on public.autopilot_run_logs to authenticated using (private.is_admin()) with check (private.is_admin());
alter policy "Admins full access autopilot_runs" on public.autopilot_runs to authenticated using (private.is_admin()) with check (private.is_admin());
alter policy "Admins full access discovered_products" on public.discovered_products to authenticated using (private.is_admin()) with check (private.is_admin());
alter policy "Admins full access feature_flags" on public.feature_flags to authenticated using (private.is_admin()) with check (private.is_admin());
alter policy "Admins full access orders" on public.orders to authenticated using (private.is_admin()) with check (private.is_admin());
alter policy "Admins full access product_analysis" on public.product_analysis to authenticated using (private.is_admin()) with check (private.is_admin());
alter policy "Admins full access products" on public.products to authenticated using (private.is_admin()) with check (private.is_admin());
alter policy "Admins can read all profiles" on public.profiles to authenticated using (private.is_admin());
alter policy "Admins can update all profiles" on public.profiles to authenticated using (private.is_admin()) with check (private.is_admin());
alter policy "Admins full access settings" on public.settings to authenticated using (private.is_admin()) with check (private.is_admin());
alter policy "Admins full access sourcing_config" on public.sourcing_config to authenticated using (private.is_admin()) with check (private.is_admin());
alter policy "Admins full access sourcing_runs" on public.sourcing_runs to authenticated using (private.is_admin()) with check (private.is_admin());
alter policy "Admins full access supplier_orders" on public.supplier_orders to authenticated using (private.is_admin()) with check (private.is_admin());
alter policy "Admins full access suppliers" on public.suppliers to authenticated using (private.is_admin()) with check (private.is_admin());

alter policy "Admin delete product images" on storage.objects to authenticated using ((bucket_id = 'product-images'::text) and private.is_admin());
alter policy "Admin update product images" on storage.objects to authenticated using ((bucket_id = 'product-images'::text) and private.is_admin()) with check ((bucket_id = 'product-images'::text) and private.is_admin());
alter policy "Admin upload product images" on storage.objects to authenticated with check ((bucket_id = 'product-images'::text) and private.is_admin());

drop function if exists public.is_admin();