-- Preserve past spend while reserving once for each server-issued generation lease.
begin;
create or replace function public.consultation_ai_reserve_budget(p_run uuid,p_amount bigint,p_daily bigint,p_monthly bigint) returns boolean
language plpgsql security definer set search_path='' as $$
declare today date:=(now() at time zone 'UTC')::date; used_day bigint;used_month bigint; token uuid;generation integer;
begin
 if p_amount is null or p_amount not between 1 and 100000 or p_daily is null or p_daily not between 1 and 1000000 or p_monthly is null or p_monthly not between 1 and 10000000 then return false;end if;
 perform pg_advisory_xact_lock(726,1);
 select lease,attempts into token,generation from public.consultation_intelligence_runs where id=p_run and state='processing' and lease_until>now() for update;
 if token is null then return false;end if;
 if exists(select 1 from private.consultation_ai_budget where reservation_id=token or (generation=1 and reservation_id=p_run)) then return false;end if;
 select coalesce(sum(reserved_microusd) filter(where period_day=today),0),coalesce(sum(reserved_microusd),0) into used_day,used_month
 from private.consultation_ai_budget where period_day>=date_trunc('month',today)::date;
 if used_day+p_amount>p_daily or used_month+p_amount>p_monthly then return false;end if;
 insert into private.consultation_ai_budget(reservation_id,period_day,reserved_microusd) values(token,today,p_amount);
 return true;
end$$;
revoke all on function public.consultation_ai_reserve_budget(uuid,bigint,bigint,bigint) from public,anon,authenticated;
grant execute on function public.consultation_ai_reserve_budget(uuid,bigint,bigint,bigint) to service_role;
commit;
