-- Isolated test baseline for the pre-existing tables used by the production RPC.
-- No customer or production rows are imported.
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role service_role bypassrls; exception when duplicate_object then null; end $$;
create table products (id uuid primary key,title text,slug text,sku text,description text,subtitle text,category text,price numeric,
 inventory integer,rating numeric,review_count integer,status text,tags jsonb,features jsonb,specs jsonb,images text[],brand text,
 traceability jsonb,source_url text,created_by text);
create table orders(id uuid primary key,payment_method text);
create table autopilot_repricing_proposals(id uuid primary key,product_id uuid,status text,council jsonb,proposal jsonb,applied_at timestamptz,updated_at timestamptz);
alter table products enable row level security;
