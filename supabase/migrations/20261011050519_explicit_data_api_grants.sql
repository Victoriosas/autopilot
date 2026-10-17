-- Make Data API access explicit; row-level security remains authoritative.
-- This avoids depending on historical auto-grants for tables in the public schema.

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.profiles enable row level security;

revoke all on table public.products, public.orders, public.profiles
  from anon, authenticated;

grant select on table public.products
  to anon, authenticated;
grant insert, update, delete on table public.products
  to authenticated;

grant select, insert, update, delete on table public.orders
  to authenticated;

grant select, update on table public.profiles
  to authenticated;

grant all on table public.products, public.orders, public.profiles
  to service_role;
