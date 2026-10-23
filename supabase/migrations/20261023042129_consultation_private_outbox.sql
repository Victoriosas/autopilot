-- Prepared offline. Apply individually only after authorization, backup and review.
-- No customer data, hosted writes, cron activation or public form activation here.
begin;
create schema if not exists private;
create table if not exists public.consultation_requests (
  id uuid primary key,
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  input jsonb not null check (jsonb_typeof(input)='object' and octet_length(input::text)<=4096),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '30 days'
);
create index if not exists consultation_requests_expiry on public.consultation_requests(expires_at);
alter table public.consultation_requests enable row level security;
revoke all on public.consultation_requests from public, anon, authenticated, service_role;
grant select (id,input,created_at,expires_at) on public.consultation_requests to authenticated;
drop policy if exists consultation_admin_read on public.consultation_requests;
create policy consultation_admin_read on public.consultation_requests for select to authenticated
  using (expires_at>now() and exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin'));

create table if not exists private.consultation_outbox (
  request_id uuid primary key references public.consultation_requests(id) on delete cascade,
  first_attempt_at timestamptz not null default now(),
  lease uuid not null,
  lease_until timestamptz not null,
  provider_id text,
  accepted_at timestamptz
);
create table if not exists private.consultation_abuse (
  address_hash text not null check(address_hash ~ '^[0-9a-f]{64}$'),
  hour timestamptz not null,
  attempts integer not null,
  primary key(address_hash,hour)
);
alter table private.consultation_outbox enable row level security;
alter table private.consultation_abuse enable row level security;
revoke all on private.consultation_outbox,private.consultation_abuse from public,anon,authenticated,service_role;

create or replace function public.consultation_schema_ready() returns text
language sql stable security definer set search_path='' as $$select 'consultation-v1'::text$$;

create or replace function public.consultation_claim(p_input jsonb,p_fingerprint text,p_abuse_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  request_uuid uuid;
  request_row public.consultation_requests;
  outbox_row private.consultation_outbox;
  next_lease uuid;
  attempts integer;
begin
  if jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text)>4096
     or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$'
     or p_abuse_hash is null or p_abuse_hash !~ '^[0-9a-f]{64}$'
     or coalesce(p_input->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or p_input->'consent' is distinct from 'true'::jsonb
     or p_input->>'consentVersion' is distinct from 'consultation-v1'
     or p_input->>'website' is distinct from ''
     or not(p_input ?& array['id','fullName','phone','email','age','service','message','responseChannel','consent','consentVersion','website'])
     or (select count(*) from jsonb_object_keys(p_input))<>11 then
    raise exception 'CONSULTATION_INPUT_INVALID';
  end if;
  request_uuid := (p_input->>'id')::uuid;
  -- Serialize this request even when it has not yet been inserted.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(request_uuid::text,0));
  select * into request_row from public.consultation_requests where id=request_uuid;
  if found then
    if request_row.expires_at<=now() then return jsonb_build_object('state','expired'); end if;
    if request_row.fingerprint<>p_fingerprint then return jsonb_build_object('state','conflict'); end if;
    select * into outbox_row from private.consultation_outbox where request_id=request_uuid;
    if not found then raise exception 'CONSULTATION_UNAVAILABLE'; end if;
    if outbox_row.accepted_at is not null then return jsonb_build_object('state','accepted'); end if;
    -- Resend retains deduplication keys for 24h. Stop retries with a 1h margin.
    if outbox_row.first_attempt_at<=now()-interval '23 hours' then return jsonb_build_object('state','expired'); end if;
    if outbox_row.lease_until>now() then return jsonb_build_object('state','pending'); end if;
    next_lease:=gen_random_uuid();
    update private.consultation_outbox set lease=next_lease,lease_until=now()+interval '2 minutes' where request_id=request_uuid;
    return jsonb_build_object('state','send','lease',next_lease);
  end if;
  -- Atomic across workers; no raw IP is stored. Five new requests/hour/address.
  insert into private.consultation_abuse as bucket(address_hash,hour,attempts)
  values(p_abuse_hash,date_trunc('hour',now()),1)
  on conflict(address_hash,hour) do update set attempts=least(bucket.attempts+1,6)
  returning bucket.attempts into attempts;
  if attempts>5 then return jsonb_build_object('state','throttled'); end if;
  insert into public.consultation_requests(id,fingerprint,input)values(request_uuid,p_fingerprint,p_input);
  next_lease:=gen_random_uuid();
  insert into private.consultation_outbox(request_id,lease,lease_until)values(request_uuid,next_lease,now()+interval '2 minutes');
  return jsonb_build_object('state','send','lease',next_lease);
end$$;

create or replace function public.consultation_finish(p_id uuid,p_lease uuid,p_provider_id text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if p_provider_id is null or p_provider_id !~ '^[A-Za-z0-9_-]{1,100}$' then return false; end if;
  update private.consultation_outbox set provider_id=p_provider_id,accepted_at=now()
  where request_id=p_id and lease=p_lease and lease_until>now() and accepted_at is null
    and exists(select 1 from public.consultation_requests where id=p_id and expires_at>now());
  return found;
end$$;

create or replace function public.consultation_purge_expired() returns integer
language plpgsql security definer set search_path='' as $$
declare erased integer;
begin
  delete from public.consultation_requests where expires_at<=now();
  get diagnostics erased=row_count;
  delete from private.consultation_abuse where hour<now()-interval '24 hours';
  return erased;
end$$;
revoke all on function public.consultation_schema_ready(),public.consultation_claim(jsonb,text,text),public.consultation_finish(uuid,uuid,text),public.consultation_purge_expired() from public,anon,authenticated;
grant execute on function public.consultation_schema_ready(),public.consultation_claim(jsonb,text,text),public.consultation_finish(uuid,uuid,text),public.consultation_purge_expired() to service_role;
commit;
