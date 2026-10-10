-- Synthetic pre-existing schema only; never import customer or production data.
-- Roles are cluster-wide; other disposable suites may already have created them.
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role service_role bypassrls; exception when duplicate_object then null; end $$;
create table public.products (
 id uuid primary key, title varchar(255) not null,
 price decimal(10,2) not null check (price >= 0), currency text,
 status varchar(50) default 'discovered' check (status in ('discovered','analyzing','validated','ready_for_review','approved','draft_ready','published','rejected')),
 inventory integer default 0 check (inventory >= 0), sku varchar(100) unique, images text[] default '{}',
 updated_at timestamptz default now()
);
create table public.orders (
 id uuid primary key, order_number varchar(50) unique not null,
 customer_email varchar(255), customer_name varchar(255), customer_phone varchar(50),
 customer_address text, customer_city varchar(100), customer_postal_code varchar(20), customer_country varchar(100),
 items jsonb not null default '[]'::jsonb,
 subtotal decimal(10,2) default 0 check (subtotal >= 0),
 shipping_cost decimal(10,2) default 0 check (shipping_cost >= 0),
 discount decimal(10,2) default 0 check (discount >= 0),
 total decimal(10,2) default 0 check (total >= 0), currency varchar(10) default 'USD',
 payment_method varchar(50) default 'paypal',
 payment_status varchar(50) default 'pending' check (payment_status in ('pending','paid','failed','refunded','cancelled','expired')),
 payment_id varchar(255), payment_gateway varchar(50) default 'paypal',
 status varchar(50) default 'pending_payment' check (status in ('pending_payment','confirmed','preparing','shipped','delivered','cancelled','refunded')),
 provider_order_id text, provider_amount numeric, provider_currency text,
 tracking_number varchar(255), estimated_delivery varchar(100), created_at timestamptz default now(), updated_at timestamptz default now()
);
-- Reproduce the provider-binding guarantee of release_integrity migration.
create unique index orders_provider_order_uidx on public.orders(payment_method,provider_order_id) where provider_order_id is not null;
alter table public.products enable row level security;
alter table public.orders enable row level security;
create function public.update_updated_at_column() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end $$;
create trigger update_products_updated_at before update on public.products for each row execute function public.update_updated_at_column();
create trigger update_orders_updated_at before update on public.orders for each row execute function public.update_updated_at_column();
grant usage on schema public to service_role;
grant select, insert, update on public.products, public.orders to service_role;
