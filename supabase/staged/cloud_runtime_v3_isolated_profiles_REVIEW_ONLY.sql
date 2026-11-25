-- Only the approved isolated ledger. Synthetic admin login for the Preview.
begin;
do $$ begin
 if current_setting('autopilot.isolated_project_ref',true) is distinct from 'juyowvmtluxfetgkckjd' then raise exception 'isolated_project_required';end if;
 if to_regclass('public.profiles') is not null then raise exception 'existing_profiles_must_be_preserved';end if;
end $$;
create table public.profiles(id uuid primary key references auth.users(id),role text not null check(role in ('admin','customer')));
alter table public.profiles enable row level security;
revoke all on public.profiles from public,anon,authenticated;
grant select on public.profiles to authenticated;
create policy cloud_v3_read_own_profile on public.profiles for select to authenticated using(id=(select auth.uid()));
grant autopilot_cloud_runtime,autopilot_cloud_reader to authenticator;
notify pgrst,'reload schema';
commit;
