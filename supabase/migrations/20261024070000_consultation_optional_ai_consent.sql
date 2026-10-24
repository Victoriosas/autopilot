-- Optional AI consent: legacy 11-field requests continue unchanged.
-- Explicit Boolean aiConsent is recorded in input with the request.
begin;
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
     or (p_input ? 'aiConsent' and jsonb_typeof(p_input->'aiConsent') <> 'boolean')
     or (select count(*) from jsonb_object_keys(p_input)) <> case when p_input ? 'aiConsent' then 12 else 11 end then
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
end;
$;

revoke all on function public.consultation_claim(jsonb,text,text) from public,anon,authenticated;
grant execute on function public.consultation_claim(jsonb,text,text) to service_role;
commit;
