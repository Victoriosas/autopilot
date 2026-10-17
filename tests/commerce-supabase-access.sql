-- Supabase-only synthetic fixture matching observed customer/admin RLS contracts.
-- Minimal profile schema; does not validate all hosted tables or API admin routes.
alter table public.orders add constraint orders_user_id_fkey foreign key(user_id) references auth.users(id) on delete set null;
revoke all on public.products,public.orders from anon,authenticated;
-- Data API grants must come from a canonical migration, not this policy fixture.
create policy "Fixture public read published products" on public.products
 for select to anon,authenticated using (status='published');
create policy "Fixture users read own orders" on public.orders
 for select to authenticated using ((select auth.uid())=user_id);
-- Minimal synthetic replica of the observed profiles/admin authorization contract.
-- This is not the full hosted profiles schema or a production migration.
create schema if not exists private;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 role varchar not null default 'customer' check(role in ('customer','admin','operator'))
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon,authenticated;
grant select,insert,update on public.profiles to service_role;
grant usage on schema private to authenticated,service_role;
-- Same existing production helper: private definer lookup avoids RLS recursion.
create function private.is_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin');
$$;
revoke all on function private.is_admin() from public,anon;
grant execute on function private.is_admin() to authenticated,service_role;
create policy "Fixture users read own profile" on public.profiles
 for select to authenticated using ((select auth.uid())=id);
create policy "Fixture admins read profiles" on public.profiles
 for select to authenticated using (private.is_admin());
create policy "Fixture users update own customer profile" on public.profiles
 for update to authenticated using ((select auth.uid())=id)
 with check ((select auth.uid())=id and role='customer');
create policy "Fixture admins update profiles" on public.profiles
 for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "Fixture admins full products" on public.products
 for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "Fixture admins full orders" on public.orders
 for all to authenticated using (private.is_admin()) with check (private.is_admin());
