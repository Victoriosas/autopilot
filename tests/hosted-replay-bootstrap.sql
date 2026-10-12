-- Minimal Supabase-managed objects for replaying Victoriosa migrations in disposable PostgreSQL only.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create function public.rls_auto_enable() returns event_trigger
language plpgsql security definer set search_path = 'pg_catalog'
as $$ begin return; end $$;

create schema auth;
create table auth.users (
  id uuid primary key,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create function auth.uid() returns uuid
language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null
);
alter table storage.objects enable row level security;
