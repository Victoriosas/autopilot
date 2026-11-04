begin;

-- Initial commercial contact only. No skin, medical or exact-address data.
create table public.beauty_requests (
 id uuid primary key,
 fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
 first_name text not null check (char_length(btrim(first_name)) between 1 and 60),
 last_name text not null check (char_length(btrim(last_name)) between 1 and 60),
 contact text not null check (char_length(btrim(contact)) between 3 and 100),
 zone text not null check (char_length(btrim(zone)) between 1 and 100),
 service text not null check (service in ('facial','massage','ritual','consultation')),
 availability text not null default '' check (char_length(availability)<=120),
 source text not null default 'web' check (source in ('web','instagram','facebook','whatsapp','recomendacion')),
 consent_version text not null check (consent_version='beauty-v1'),
 status text not null default 'pending' check (status in ('pending','reviewing','confirmed','completed','cancelled')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 reviewed_by uuid,
 expires_at timestamptz not null default (now()+interval '90 days'),
 check (expires_at>created_at)
);
create index beauty_requests_review_queue on public.beauty_requests(status,created_at desc);
create index beauty_requests_expiry on public.beauty_requests(expires_at);
alter table public.beauty_requests enable row level security;
alter table public.beauty_requests force row level security;
revoke all on public.beauty_requests from public,anon,authenticated,service_role;
grant select,insert on public.beauty_requests to service_role;
grant select on public.beauty_requests to authenticated;
grant update(status,updated_at,reviewed_by) on public.beauty_requests to authenticated;

-- Uses existing profiles authorization; this migration does not change profiles.
create policy beauty_requests_admin_read on public.beauty_requests for select to authenticated
 using (expires_at>now() and exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin'));
create policy beauty_requests_admin_review on public.beauty_requests for update to authenticated
 using (expires_at>now() and exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin'))
 with check (expires_at>now() and reviewed_by=(select auth.uid()) and exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin'));

create function public.beauty_request_transition() returns trigger
language plpgsql set search_path=pg_catalog,public as $$
begin
 if TG_OP='INSERT' then
  if new.status<>'pending' or new.reviewed_by is not null then
   raise exception 'BEAUTY_INITIAL_STATUS_INVALID';
  end if;
  -- Serialize initial inquiries per normalized contact. A duplicate UUID is
  -- handled by ON CONFLICT DO NOTHING and the server fingerprint comparison.
  perform pg_advisory_xact_lock(hashtextextended(lower(btrim(new.contact)),17220000));
  if exists(select 1 from public.beauty_requests where id=new.id) then return new; end if;
  if (select count(*) from public.beauty_requests
      where lower(btrim(contact))=lower(btrim(new.contact))
      and created_at>now()-interval '1 hour')>=3 then
   raise exception 'BEAUTY_CONTACT_RATE_LIMIT';
  end if;
  return new;
 end if;
 if new.reviewed_by is distinct from auth.uid() or auth.uid() is null then
  raise exception 'BEAUTY_REVIEW_ACTOR_INVALID';
 end if;
 if not ((old.status='pending' and new.status in ('reviewing','cancelled'))
  or (old.status='reviewing' and new.status in ('confirmed','cancelled'))
  or (old.status='confirmed' and new.status in ('completed','cancelled'))) then
  raise exception 'BEAUTY_TRANSITION_INVALID';
 end if;
 new.updated_at=now();
 return new;
end $$;
revoke all on function public.beauty_request_transition() from public;
create trigger beauty_request_initial before insert on public.beauty_requests
 for each row execute function public.beauty_request_transition();
create trigger beauty_request_review before update of status,updated_at,reviewed_by on public.beauty_requests
 for each row execute function public.beauty_request_transition();
comment on table public.beauty_requests is 'Private initial Beauty inquiries. No public lookup by reference. Default retention 90 days; expiry hides admin reads but physical deletion requires an authorized retention task.';
commit;
