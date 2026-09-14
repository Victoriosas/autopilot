-- One-time operator authorization for a bounded production shadow run.
-- Tokens are stored only as SHA-256 hashes and can be consumed once.
create table public.autopilot_shadow_run_authorizations (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  purpose text not null default 'production_shadow_once' check (purpose = 'production_shadow_once'),
  limits jsonb not null default '{"maxCandidates":3,"maxAiCalls":2,"durationMs":15000}'::jsonb,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

alter table public.autopilot_shadow_run_authorizations enable row level security;
revoke all on public.autopilot_shadow_run_authorizations from public, anon, authenticated;
grant select, insert, update on public.autopilot_shadow_run_authorizations to service_role;

create function public.consume_autopilot_shadow_run_authorization(requested_token_hash text)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  authorization_id uuid;
  authorization_limits jsonb;
begin
  if requested_token_hash is null or requested_token_hash !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  update public.autopilot_shadow_run_authorizations
     set consumed_at = clock_timestamp()
   where token_hash = requested_token_hash
     and consumed_at is null
     and expires_at > clock_timestamp()
  returning id, limits into authorization_id, authorization_limits;

  if not found then return null; end if;
  return jsonb_build_object('id', authorization_id, 'limits', authorization_limits);
end $$;

revoke all on function public.consume_autopilot_shadow_run_authorization(text) from public, anon, authenticated;
grant execute on function public.consume_autopilot_shadow_run_authorization(text) to service_role;
