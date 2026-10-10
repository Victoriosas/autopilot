-- Synthetic pre-existing schema only; never import customer or production data.
create role anon;
create role authenticated;
create role service_role bypassrls;
create table public.products (
 id uuid primary key, title text, price numeric, currency text, status text, inventory integer, sku text, images text[]
);
create table public.orders (
 id uuid primary key, order_number text, customer_email text, customer_name text, customer_phone text,
 customer_address text, customer_city text, customer_postal_code text, customer_country text,
 items jsonb, subtotal numeric, shipping_cost numeric, discount numeric default 0, total numeric, currency text,
 payment_method text, payment_status text, payment_id text, payment_gateway text, status text,
 provider_order_id text, provider_amount numeric, provider_currency text,
 tracking_number text, estimated_delivery text, created_at timestamptz default now()
);
grant usage on schema public to service_role;
grant select, insert, update on public.products, public.orders to service_role;
