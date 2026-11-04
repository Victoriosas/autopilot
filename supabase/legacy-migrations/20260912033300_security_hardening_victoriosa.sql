-- Victoriosa production security hardening applied to Supabase.
-- Keeps the public storefront readable while making operational/admin data private.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

alter function public.update_updated_at_column() set search_path = public;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

alter view public.published_products set (security_invoker = true);
alter view public.recent_orders set (security_invoker = true);
alter view public.autopilot_stats set (security_invoker = true);

drop policy if exists service_all_discovered_products on public.discovered_products;
drop policy if exists service_all_sourcing_config on public.sourcing_config;
drop policy if exists service_all_sourcing_runs on public.sourcing_runs;

alter table public.discovered_products enable row level security;
alter table public.sourcing_config enable row level security;
alter table public.sourcing_runs enable row level security;

create policy "Admins full access discovered_products"
on public.discovered_products for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Admins full access sourcing_config"
on public.sourcing_config for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Admins full access sourcing_runs"
on public.sourcing_runs for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins full access products" on public.products;
create policy "Admins full access products" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public read published products" on public.products;
create policy "Public read published products" on public.products for select to anon, authenticated using (status = 'published');

drop policy if exists "Admins full access product_analysis" on public.product_analysis;
create policy "Admins full access product_analysis" on public.product_analysis for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public read analysis for published products" on public.product_analysis;
create policy "Public read analysis for published products" on public.product_analysis for select to anon, authenticated
using (exists (select 1 from public.products where products.id = product_analysis.product_id and products.status = 'published'));

drop policy if exists "Admins full access feature_flags" on public.feature_flags;
create policy "Admins full access feature_flags" on public.feature_flags for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Public read feature_flags" on public.feature_flags;
create policy "Public read feature_flags" on public.feature_flags for select to anon, authenticated using (true);

drop policy if exists "Admins full access settings" on public.settings;
create policy "Admins full access settings" on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Public read settings" on public.settings;
create policy "Public read settings" on public.settings for select to anon, authenticated using (true);

drop policy if exists "Admins full access orders" on public.orders;
create policy "Admins full access orders" on public.orders for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Users insert own orders" on public.orders;
drop policy if exists "Users read own orders" on public.orders;
create policy "Users read own orders" on public.orders for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles" on public.profiles for select to authenticated using (public.is_admin());
drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Admins can update all profiles" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id and role = 'customer');

do $$
declare t text;
begin
  foreach t in array array['alerts','autopilot_run_logs','autopilot_runs','supplier_orders','suppliers'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create index if not exists idx_alerts_product_id on public.alerts(product_id);
create index if not exists idx_alerts_supplier_order_id on public.alerts(supplier_order_id);
create index if not exists idx_discovered_products_sourcing_run_id on public.discovered_products(sourcing_run_id);
create index if not exists idx_settings_updated_by on public.settings(updated_by);
