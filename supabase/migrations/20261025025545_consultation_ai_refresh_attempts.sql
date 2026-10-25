-- Normal TTL refreshes do not consume the retry ceiling for failed generations.
begin;
create or replace function public.consultation_ai_claim(p_request uuid,p_version text,p_config text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.consultation_intelligence_runs; token uuid:=gen_random_uuid();
begin
 if p_version!~'^[a-f0-9]{64}$' or length(p_config) not between 1 and 300 then raise exception 'INPUT_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,726));
 if not exists(select 1 from public.consultation_requests where id=p_request and expires_at>now()) then return jsonb_build_object('state','failed');end if;
 select * into r from public.consultation_intelligence_runs where request_id=p_request and conversation_version=p_version and config_version=p_config for update;
 if found then
  if r.analysis is not null and (r.analysis->>'expiresAt')::timestamptz>now() then
   return jsonb_build_object('state','ready','id',r.id,'analysis',r.analysis);
  end if;
  if r.state='processing' and r.lease_until>now() then return jsonb_build_object('state','busy','id',r.id);end if;
  if r.analysis is null and r.attempts>=3 then return jsonb_build_object('state','failed','id',r.id);end if;
  update public.consultation_intelligence_runs set state='processing',lease=token,lease_until=now()+interval '90 seconds',attempts=case when r.analysis is not null then 1 else attempts+1 end,analysis=null,approval_hash=null,exact_text=null,approved_by=null,approved_at=null,updated_at=now() where id=r.id returning * into r;
 else
  insert into public.consultation_intelligence_runs(request_id,conversation_version,config_version,state,lease,lease_until)
   values(p_request,p_version,p_config,'processing',token,now()+interval '90 seconds') returning * into r;
 end if;
 insert into public.consultation_intelligence_events(run_id,kind) values(r.id,'claimed');
 return jsonb_build_object('state','claimed','id',r.id,'lease',token);
end$$;
revoke all on function public.consultation_ai_claim(uuid,text,text) from public,anon,authenticated;
grant execute on function public.consultation_ai_claim(uuid,text,text) to service_role;
commit;
