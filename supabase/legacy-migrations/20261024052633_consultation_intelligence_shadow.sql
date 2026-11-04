-- Additive, server-only shadow workflow. No delivery queue, customer backfill or production activation.
begin;
create table public.consultation_intelligence_runs (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.consultation_requests(id) on delete cascade,
 conversation_version text not null check(conversation_version ~ '^[a-f0-9]{64}$'),
 config_version text not null check(length(config_version) between 1 and 300),
 state text not null check(state in('processing','ready','needs_review','approved','rejected','failed')),
 lease uuid, lease_until timestamptz, attempts integer not null default 1 check(attempts between 1 and 3),
 analysis jsonb check(octet_length(analysis::text)<=64000),
 approval_hash text check(approval_hash ~ '^[a-f0-9]{64}$'), exact_text text check(length(exact_text)<=6000),
 approved_by uuid, approved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(request_id,conversation_version,config_version)
);
create table public.consultation_intelligence_events (
 id uuid primary key default gen_random_uuid(),run_id uuid not null references public.consultation_intelligence_runs(id) on delete cascade,
 kind text not null check(kind in('claimed','finished','approve','reject','consent_recorded','opt_out','proposal_confirmed','session_confirmed','followup_proposed','learning_proposed','dispatch_started')),actor uuid,
 event_key text unique check(event_key ~ '^[a-f0-9]{64}$'),payload jsonb check(octet_length(payload::text)<=2000),
 created_at timestamptz not null default now()
);
create index consultation_intelligence_events_run on public.consultation_intelligence_events(run_id);
-- Budget reservations deliberately survive request retention; only time/amount remain, without contact/content.
create table private.consultation_ai_budget (
 reservation_id uuid primary key,period_day date not null default (now() at time zone 'UTC')::date,
 reserved_microusd bigint not null check(reserved_microusd between 1 and 100000)
);
alter table public.consultation_intelligence_runs enable row level security;
alter table public.consultation_intelligence_events enable row level security;
alter table private.consultation_ai_budget enable row level security;
revoke all on public.consultation_intelligence_runs,public.consultation_intelligence_events,private.consultation_ai_budget from public,anon,authenticated,service_role;
grant select on public.consultation_intelligence_runs to service_role;

create function public.consultation_ai_claim(p_request uuid,p_version text,p_config text) returns jsonb
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
  if r.attempts>=3 then return jsonb_build_object('state','failed','id',r.id);end if;
  update public.consultation_intelligence_runs set state='processing',lease=token,lease_until=now()+interval '90 seconds',attempts=attempts+1,analysis=null,approval_hash=null,exact_text=null,approved_by=null,approved_at=null,updated_at=now() where id=r.id returning * into r;
 else
  insert into public.consultation_intelligence_runs(request_id,conversation_version,config_version,state,lease,lease_until)
   values(p_request,p_version,p_config,'processing',token,now()+interval '90 seconds') returning * into r;
 end if;
 insert into public.consultation_intelligence_events(run_id,kind) values(r.id,'claimed');
 return jsonb_build_object('state','claimed','id',r.id,'lease',token);
end$$;

create function public.consultation_ai_finish(p_run uuid,p_lease uuid,p_analysis jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.consultation_intelligence_runs;
begin
 select * into r from public.consultation_intelligence_runs where id=p_run for update;
 if not found or r.state<>'processing' or r.lease is distinct from p_lease or r.lease_until<=now() then return false;end if;
 if not exists(select 1 from public.consultation_requests where id=r.request_id and expires_at>now()) then return false;end if;
 if p_analysis->>'version' is distinct from 'consultation-intelligence-v1' or p_analysis->>'mode' is distinct from 'shadow'
 or p_analysis->>'conversationVersion' is distinct from r.conversation_version or octet_length(p_analysis::text)>64000
 or coalesce(p_analysis->'guardian'->>'status','') not in('approved','blocked','requires_changes')
 or jsonb_typeof(p_analysis->'drafts') is distinct from 'array' or (p_analysis->>'expiresAt')::timestamptz<=now() then return false;end if;
 update public.consultation_intelligence_runs set state=case when p_analysis->'guardian'->>'status'='approved' then 'ready' else 'needs_review' end,
 analysis=p_analysis,lease=null,lease_until=null,updated_at=now() where id=p_run;
 insert into public.consultation_intelligence_events(run_id,kind) values(p_run,'finished');
 return true;
end$$;

create function public.consultation_ai_review(p_request uuid,p_run uuid,p_admin uuid,p_text text,p_hash text,p_action text) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.consultation_intelligence_runs;
begin
 select * into r from public.consultation_intelligence_runs where id=p_run and request_id=p_request for update;
 if not found or r.analysis is null or r.state='processing' or p_admin is null or p_hash!~'^[a-f0-9]{64}$' or p_action not in('approve','reject') then return false;end if;
 if not exists(select 1 from public.consultation_requests where id=p_request and expires_at>now()) then return false;end if;
 if (r.analysis->>'expiresAt')::timestamptz<=now() then return false;end if;
 if p_action='approve' and (r.analysis->'guardian'->>'status'<>'approved' or not exists(select 1 from jsonb_array_elements(r.analysis->'drafts') d where d->>'text'=p_text)) then return false;end if;
 if r.approval_hash=p_hash and r.state=(case when p_action='approve' then 'approved' else 'rejected' end) then return true;end if;
 update public.consultation_intelligence_runs set state=case when p_action='approve' then 'approved' else 'rejected' end,
 approval_hash=p_hash,exact_text=case when p_action='approve' then p_text else null end,approved_by=p_admin,approved_at=now(),updated_at=now() where id=p_run;
 insert into public.consultation_intelligence_events(run_id,kind,actor) values(p_run,p_action,p_admin);
 return true;
end$$;

create function public.consultation_ai_reserve_budget(p_run uuid,p_amount bigint,p_daily bigint,p_monthly bigint) returns boolean
language plpgsql security definer set search_path='' as $$
declare today date:=(now() at time zone 'UTC')::date; used_day bigint;used_month bigint;
begin
 if p_amount is null or p_amount not between 1 and 100000 or p_daily is null or p_daily not between 1 and 1000000 or p_monthly is null or p_monthly not between 1 and 10000000 then return false;end if;
 perform pg_advisory_xact_lock(726,1);
 if not exists(select 1 from public.consultation_intelligence_runs where id=p_run and state='processing' and lease_until>now()) then return false;end if;
 if exists(select 1 from private.consultation_ai_budget where reservation_id=p_run) then return false;end if;
 select coalesce(sum(reserved_microusd) filter(where period_day=today),0),coalesce(sum(reserved_microusd),0) into used_day,used_month
 from private.consultation_ai_budget where period_day>=date_trunc('month',today)::date;
 if used_day+p_amount>p_daily or used_month+p_amount>p_monthly then return false;end if;
 insert into private.consultation_ai_budget(reservation_id,period_day,reserved_microusd) values(p_run,today,p_amount);
 return true;
end$$;

create function public.consultation_ai_report() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('windowDays',7,'runs',count(*),'analyzedRuns',count(*) filter(where analysis is not null),'needsReview',count(*) filter(where state='needs_review'),
 'approved',count(*) filter(where state='approved'),'rejected',count(*) filter(where state='rejected'),
 'processing',count(*) filter(where state='processing'),'staleLeases',count(*) filter(where state='processing' and lease_until<=now()),
 'modelCalls',coalesce(sum((analysis->'statistics'->>'calls')::integer),0),
 'meanProcessingMs',avg((analysis->'statistics'->>'latencyMs')::numeric),
 'reservedMicrousd',(select coalesce(sum(reserved_microusd),0) from private.consultation_ai_budget where period_day>=(now() at time zone 'UTC')::date-6),
 'actualCost',null,'delivered',null,'readByRecipient',null,'commercialResults',null,'mode','shadow',
 'consultations',(select count(*) from public.consultation_requests where created_at>=now()-interval '7 days' and expires_at>now()),
 'services',(select coalesce(jsonb_object_agg(s.service,s.n),'{}'::jsonb) from (select input->>'service' service,count(*) n from public.consultation_requests where created_at>=now()-interval '7 days' and expires_at>now() group by input->>'service') s),
 'replyAccepted',(select count(*) from public.consultation_reply_outbox where state='sent' and created_at>=now()-interval '7 days'),
 'replyUncertain',(select count(*) from public.consultation_reply_outbox where state='failed_unknown' and created_at>=now()-interval '7 days'))
 from public.consultation_intelligence_runs where created_at>=now()-interval '7 days'
$$;
create function public.consultation_ai_events(p_request uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('kind',e.kind,'key',e.event_key,'payload',e.payload) order by e.created_at),'[]'::jsonb)
 from public.consultation_intelligence_events e join public.consultation_intelligence_runs r on r.id=e.run_id
 join public.consultation_requests q on q.id=r.request_id where q.id=p_request and q.expires_at>now() and e.event_key is not null
$$;
create function public.consultation_ai_record_event(p_request uuid,p_run uuid,p_admin uuid,p_kind text,p_key text,p_payload jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,726));
 if p_admin is null or p_key!~'^[a-f0-9]{64}$' or p_kind not in('consent_recorded','opt_out','proposal_confirmed','session_confirmed','followup_proposed','learning_proposed') then return false;end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>2000 or p_payload-'occurredAt'-'consentReference'-'sourceKey'-'issue'-'factId'<>'{}'::jsonb then return false;end if;
 if coalesce(p_payload->>'occurredAt','')='' or (p_payload->>'occurredAt')::timestamptz>now() then return false;end if;
 if p_kind='consent_recorded' and coalesce(p_payload->>'consentReference','')!~'^[a-f0-9-]{36}$' then return false;end if;
 if not exists(select 1 from public.consultation_intelligence_runs r join public.consultation_requests q on q.id=r.request_id where r.id=p_run and q.id=p_request and q.expires_at>now()) then return false;end if;
 if exists(select 1 from public.consultation_intelligence_events where event_key=p_key and (run_id<>p_run or kind<>p_kind or payload<>p_payload)) then return false;end if;
 if exists(select 1 from public.consultation_intelligence_events where event_key=p_key and run_id=p_run and kind=p_kind and payload=p_payload) then return true;end if;
 if p_kind='followup_proposed' then
  if (select e.kind from public.consultation_intelligence_events e join public.consultation_intelligence_runs r on r.id=e.run_id where r.request_id=p_request and e.kind in('consent_recorded','opt_out') order by (e.payload->>'occurredAt')::timestamptz desc,(e.kind='opt_out') desc limit 1) is distinct from 'consent_recorded' then return false;end if;
  if (select count(*) from public.consultation_intelligence_events e join public.consultation_intelligence_runs r on r.id=e.run_id where r.request_id=p_request and e.kind='followup_proposed')>=2 then return false;end if;
  if not exists(select 1 from public.consultation_intelligence_events e join public.consultation_intelligence_runs r on r.id=e.run_id where r.request_id=p_request and e.event_key=p_payload->>'sourceKey' and e.kind in('proposal_confirmed','session_confirmed') and (e.payload->>'occurredAt')::timestamptz<=now()-(case when e.kind='proposal_confirmed' then interval '48 hours' else interval '24 hours' end)) then return false;end if;
  if exists(select 1 from public.consultation_intelligence_events e join public.consultation_intelligence_runs r on r.id=e.run_id where r.request_id=p_request and e.kind='followup_proposed' and e.payload->>'sourceKey'=p_payload->>'sourceKey') then return false;end if;
 end if;
 insert into public.consultation_intelligence_events(run_id,kind,actor,event_key,payload) values(p_run,p_kind,p_admin,p_key,p_payload) on conflict(event_key) do nothing;
 return true;
end$$;
-- Future level-1 handoff only; callers must independently pass the live-review activation gates.
create function public.consultation_ai_begin_dispatch(p_request uuid,p_run uuid,p_admin uuid,p_hash text,p_input jsonb,p_knowledge text) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.consultation_intelligence_runs; n integer;
begin
 select * into r from public.consultation_intelligence_runs where id=p_run and request_id=p_request for update;
 if not found or r.state<>'approved' or r.approved_by is distinct from p_admin or r.approval_hash is distinct from p_hash or r.analysis->>'knowledgeVersion' is distinct from p_knowledge then return false;end if;
 if (r.analysis->>'expiresAt')::timestamptz<=now() or r.analysis->'guardian'->>'status'<>'approved' then return false;end if;
 perform 1 from public.consultation_requests where id=p_request and expires_at>now() and input=p_input and input->>'responseChannel'='email' and coalesce(input->>'email','')<>'' for share;
 if not found then return false;end if;
 insert into public.consultation_reply_outbox(request_id,approved_by,recipient,subject,body,state)
 values(p_request,p_admin,p_input->>'email','Tu consulta en Victoriosas',r.exact_text,'sending') on conflict(request_id) do nothing;
 get diagnostics n=row_count;if n<>1 then return false;end if;
 insert into public.consultation_intelligence_events(run_id,kind,actor) values(p_run,'dispatch_started',p_admin);
 return true;
end$$;
revoke all on function public.consultation_ai_claim(uuid,text,text),public.consultation_ai_finish(uuid,uuid,jsonb),public.consultation_ai_review(uuid,uuid,uuid,text,text,text),public.consultation_ai_reserve_budget(uuid,bigint,bigint,bigint),public.consultation_ai_report() from public,anon,authenticated;
grant execute on function public.consultation_ai_claim(uuid,text,text),public.consultation_ai_finish(uuid,uuid,jsonb),public.consultation_ai_review(uuid,uuid,uuid,text,text,text),public.consultation_ai_reserve_budget(uuid,bigint,bigint,bigint),public.consultation_ai_report() to service_role;
revoke all on function public.consultation_ai_events(uuid),public.consultation_ai_record_event(uuid,uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.consultation_ai_events(uuid),public.consultation_ai_record_event(uuid,uuid,uuid,text,text,jsonb) to service_role;
revoke all on function public.consultation_ai_begin_dispatch(uuid,uuid,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.consultation_ai_begin_dispatch(uuid,uuid,uuid,text,jsonb,text) to service_role;
comment on table public.consultation_intelligence_runs is 'Server-only shadow analysis. Approval is not email dispatch, delivery or knowledge approval. Parent retention cascades.';
commit;
