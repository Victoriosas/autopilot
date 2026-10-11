-- Supabase-only synthetic fixture, matching ordinary-user read policies observed
-- in production metadata. This does not emulate or validate private.is_admin().
alter table public.orders add column user_id uuid references auth.users(id) on delete set null;
grant select,insert,update,delete on public.products,public.orders to anon,authenticated;
create policy "Fixture public read published products" on public.products
 for select to anon,authenticated using (status='published');
create policy "Fixture users read own orders" on public.orders
 for select to authenticated using ((select auth.uid())=user_id);
