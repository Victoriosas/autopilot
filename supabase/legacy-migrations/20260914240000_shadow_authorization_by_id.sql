-- Allows a random UUID capability to trigger the same single-use authorization.
-- The UUID is generated server-side with 122 bits of randomness and remains
-- bound to the existing expiry/consumed_at controls.
create function public.consume_autopilot_shadow_run_authorization_id(requested_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  authorization_id uuid;
  authorization_limits jsonb;
begin
  if requested_id is null then return null; end if;

  update public.autopilot_shadow_run_authorizations
     set consumed_at = clock_timestamp()
   where id = requested_id
     and consumed_at is null
     and expires_at > clock_timestamp()
  returning id, limits into authorization_id, authorization_limits;

  if not found then return null; end if;
  return jsonb_build_object('id', authorization_id, 'limits', authorization_limits);
end $$;

revoke all on function public.consume_autopilot_shadow_run_authorization_id(uuid) from public, anon, authenticated;
grant execute on function public.consume_autopilot_shadow_run_authorization_id(uuid) to service_role;
