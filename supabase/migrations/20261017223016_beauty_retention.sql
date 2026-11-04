begin;

-- Prepared operation only: installing this function does not delete records,
-- schedule a job or authorize any execution against real customer data.
create function public.beauty_purge_expired_requests() returns bigint
language plpgsql security definer set search_path='' as $$
declare
 actor uuid := auth.uid();
 deleted_count bigint;
begin
 if actor is null or not exists (
  select 1 from public.profiles where id=actor and role='admin'
 ) then
  raise exception 'BEAUTY_ADMIN_REQUIRED' using errcode='42501';
 end if;
 delete from public.beauty_requests where expires_at<=now();
 get diagnostics deleted_count=row_count;
 return deleted_count;
end $$;

revoke all on function public.beauty_purge_expired_requests() from public,anon,authenticated,service_role;
grant execute on function public.beauty_purge_expired_requests() to authenticated;
comment on function public.beauty_purge_expired_requests() is 'Admin-only expired Beauty request deletion. Returns a count, never customer data. No time override and no schedule. Real-data execution requires separate owner authorization.';

commit;
