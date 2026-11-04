begin;
-- Keep the existing RPC contract while removing owner privileges from the
-- exposed public entry point. The original administrator check is preserved.
create schema if not exists private;
revoke create on schema private from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;
alter function public.beauty_purge_expired_requests() set schema private;
revoke all on function private.beauty_purge_expired_requests() from public, anon, authenticated, service_role;
grant execute on function private.beauty_purge_expired_requests() to authenticated;

create function public.beauty_purge_expired_requests() returns bigint
language sql security invoker set search_path='' as $$
  select private.beauty_purge_expired_requests();
$$;
revoke all on function public.beauty_purge_expired_requests() from public, anon, authenticated, service_role;
grant execute on function public.beauty_purge_expired_requests() to authenticated;
comment on function public.beauty_purge_expired_requests() is 'Invoker-only compatibility entry point; private implementation requires an authenticated administrator. No schedule or execution is authorized by installation.';

-- No API role has direct table grants. RLS adds defense in depth; only the
-- owner-executed, approval/version-gated functions may access knowledge.
alter table private.consultation_service_knowledge enable row level security;
commit;
