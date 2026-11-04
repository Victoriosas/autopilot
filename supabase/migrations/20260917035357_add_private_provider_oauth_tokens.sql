create table if not exists public.provider_oauth_tokens (
  provider text primary key,
  access_token text not null,
  refresh_token text,
  token_type text,
  expires_at timestamptz,
  scope text,
  external_user_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.provider_oauth_tokens enable row level security;
revoke all on table public.provider_oauth_tokens from anon, authenticated;
comment on table public.provider_oauth_tokens is 'Server-only OAuth credentials. Access only through service role; no client RLS policies.';