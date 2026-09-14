-- New tables intentionally separate legacy scheduler state from resumable v4 work.
create table public.autopilot_sourcing_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  scope text not null,
  provider text not null default 'cj',
  mode text not null check (mode in ('shadow','production')),
  config jsonb not null,
  status text not null default 'queued' check (status in ('queued','running','resuming','completed','completed_no_candidates','failed_retryable','failed_terminal','cancelled')),
  lease_owner uuid,
  lease_generation bigint not null default 0,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  attempt integer not null default 0,
  resume_count integer not null default 0,
  current_stage text not null default 'discovery',
  last_checkpoint jsonb not null default '{}',
  next_retry_at timestamptz,
  discovery_done boolean not null default false,
  model_calls integer not null default 0,
  error_count integer not null default 0,
  error_code text,
  metrics jsonb not null default '{}',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index autopilot_one_open_scope on public.autopilot_sourcing_runs(scope)
 where status in ('queued','running','resuming','failed_retryable');
create table public.autopilot_sourcing_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.autopilot_sourcing_runs(id),
  identity text not null,
  evidence_version text not null,
  status text not null default 'discovered' check (status in ('discovered','normalized','needs_evidence','evidence_validated','evidence_rejected','opportunity_scored','pricing_completed','pricing_rejected','draft_created','council_pending','council_approved','council_rejected','shadow_completed','published','failed_retryable','failed_terminal')),
  payload jsonb not null,
  checkpoint jsonb not null default '{}',
  draft_id uuid references public.autopilot_product_drafts(id),
  council jsonb,
  attempt integer not null default 0,
  next_retry_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(run_id,identity,evidence_version)
);
create index autopilot_items_resume on public.autopilot_sourcing_items(run_id,status,next_retry_at);
alter table public.autopilot_product_drafts
 add column created_in_shadow_mode boolean not null default true,
 add column publication_eligible boolean not null default false,
 add column commercial_identity text,
 add column evidence_version text,
 add column sourcing_run_id uuid references public.autopilot_sourcing_runs(id);
create unique index autopilot_draft_evidence_identity on public.autopilot_product_drafts(commercial_identity,evidence_version,created_in_shadow_mode)
 where commercial_identity is not null;
alter table public.products add column commercial_identity text;
create unique index autopilot_product_identity on public.products(commercial_identity) where commercial_identity is not null;

-- Defense at the database boundary also covers older RPC/direct service entrypoints.
create function public.autopilot_draft_barrier() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='UPDATE' and (old.created_in_shadow_mode is distinct from new.created_in_shadow_mode
    or old.sourcing_run_id is distinct from new.sourcing_run_id
    or old.commercial_identity is distinct from new.commercial_identity
    or old.evidence_version is distinct from new.evidence_version) then
   raise exception 'IMMUTABLE_DRAFT_ORIGIN';
 end if;
 if new.created_in_shadow_mode and new.publication_eligible then raise exception 'SHADOW_NOT_ELIGIBLE'; end if;
 if new.status in ('publishing','published') and (new.created_in_shadow_mode or not new.publication_eligible) then
   raise exception 'SHADOW_PUBLICATION_DENIED';
 end if;
 return new;
end $$;
create trigger autopilot_draft_barrier before insert or update on public.autopilot_product_drafts
 for each row execute function public.autopilot_draft_barrier();

create function public.autopilot_product_barrier() returns trigger language plpgsql security invoker set search_path='' as $$
declare d public.autopilot_product_drafts%rowtype; r public.autopilot_sourcing_runs%rowtype;
begin
 if new.traceability->>'draftId' is not null then
  select * into strict d from public.autopilot_product_drafts where id=(new.traceability->>'draftId')::uuid;
  if d.created_in_shadow_mode or not d.publication_eligible then raise exception 'SHADOW_PUBLICATION_DENIED'; end if;
  if d.sourcing_run_id is not null then
   select * into strict r from public.autopilot_sourcing_runs where id=d.sourcing_run_id for update;
   if r.mode<>'production' or r.id::text is distinct from current_setting('autopilot.run',true)
    or r.lease_generation::text is distinct from current_setting('autopilot.generation',true)
    or r.lease_owner::text is distinct from current_setting('autopilot.owner',true)
    or r.lease_expires_at<=clock_timestamp() then raise exception 'FENCE_REJECTED'; end if;
  end if;
  new.commercial_identity := d.commercial_identity;
 end if;
 return new;
end $$;
create trigger autopilot_product_barrier before insert or update on public.products
 for each row execute function public.autopilot_product_barrier();

-- One bounded RPC per durable transition. No network I/O occurs inside transactions.
create function public.autopilot_sourcing_command(command text, args jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r public.autopilot_sourcing_runs%rowtype; i public.autopilot_sourcing_items%rowtype;
 d public.autopilot_product_drafts%rowtype; entry jsonb; result jsonb; n integer;
begin
 if command='claim' then
  perform pg_advisory_xact_lock(hashtextextended(args->>'scope',0));
  select * into r from public.autopilot_sourcing_runs where scope=args->>'scope'
   and status in ('queued','running','resuming','failed_retryable') for update;
  if found then
   if r.lease_expires_at>clock_timestamp() then return jsonb_build_object('status','already_running','run',to_jsonb(r)); end if;
   if r.next_retry_at>clock_timestamp() then return jsonb_build_object('status','waiting_retry','run',to_jsonb(r)); end if;
   update public.autopilot_sourcing_runs set status='resuming',resume_count=resume_count+1 where id=r.id;
  else
   select * into r from public.autopilot_sourcing_runs where run_key=args->>'key';
   if found then return jsonb_build_object('status','replayed','run',to_jsonb(r)); end if;
   insert into public.autopilot_sourcing_runs(run_key,scope,mode,config,status)
    values(args->>'key',args->>'scope',args->>'mode',args->'config','running') returning * into r;
  end if;
  update public.autopilot_sourcing_runs set lease_owner=(args->>'owner')::uuid,lease_generation=lease_generation+1,
   lease_expires_at=clock_timestamp()+interval '120 seconds',heartbeat_at=clock_timestamp(),
   started_at=coalesce(started_at,now()),updated_at=now(),attempt=attempt+1 where id=r.id returning * into r;
  return jsonb_build_object('status','claimed','run',to_jsonb(r));
 end if;
 if command='status' then
  return jsonb_build_object('runs',coalesce((select jsonb_agg(t) from
   (select id,status,mode,created_at,completed_at,lease_expires_at,resume_count,model_calls,error_count,metrics from public.autopilot_sourcing_runs order by created_at desc limit 20) t),'[]'::jsonb));
 end if;
 select * into strict r from public.autopilot_sourcing_runs where id=(args->>'run')::uuid for update;
 if r.lease_owner is distinct from (args->>'owner')::uuid or r.lease_generation is distinct from (args->>'generation')::bigint
  or r.lease_expires_at is null or r.lease_expires_at<=clock_timestamp()
  or r.status not in ('running','resuming') then raise exception 'FENCE_REJECTED'; end if;
 perform set_config('autopilot.run',r.id::text,true);
 perform set_config('autopilot.owner',r.lease_owner::text,true);
 perform set_config('autopilot.generation',r.lease_generation::text,true);
 update public.autopilot_sourcing_runs set heartbeat_at=clock_timestamp(),lease_expires_at=clock_timestamp()+interval '120 seconds',updated_at=now() where id=r.id;
 if command='discover' then
  if not r.discovery_done then
   for entry in select value from jsonb_array_elements(args->'items') loop
    insert into public.autopilot_sourcing_items(run_id,identity,evidence_version,payload)
     values(r.id,entry->>'identity',entry->>'version',entry->'payload') on conflict do nothing;
   end loop;
   update public.autopilot_sourcing_runs set discovery_done=true,current_stage='items' where id=r.id;
  end if;
 elsif command='items' then
  return coalesce((select jsonb_agg(t order by t.created_at,t.id) from public.autopilot_sourcing_items t where run_id=r.id),'[]'::jsonb);
 elsif command='reserve_ai' then
  n := (args->>'calls')::integer;
  if n<1 or r.model_calls+n>(r.config->>'maxAiCalls')::integer then raise exception 'AI_BUDGET_EXHAUSTED'; end if;
  update public.autopilot_sourcing_runs set model_calls=model_calls+n where id=r.id;
 elsif command in ('checkpoint','draft','council','publish') then
  select * into strict i from public.autopilot_sourcing_items where id=(args->>'item')::uuid and run_id=r.id for update;
  if command='checkpoint' then
   update public.autopilot_sourcing_items set status=args->>'status',checkpoint=checkpoint || coalesce(args->'data','{}'::jsonb) || jsonb_build_object(args->>'status',true),
    attempt=attempt+case when args->>'status' in ('failed_retryable','failed_terminal') then 1 else 0 end,
    error_code=args->>'error',next_retry_at=(args->>'retryAt')::timestamptz,updated_at=now() where id=i.id;
   if args->>'error' is not null then update public.autopilot_sourcing_runs set error_count=error_count+1 where id=r.id; end if;
  elsif command='draft' then
   if i.draft_id is null then
    insert into public.autopilot_product_drafts(source_candidate_id,draft,commercial_identity,evidence_version,
     created_in_shadow_mode,publication_eligible,sourcing_run_id)
    values(i.identity,args->'draft',i.identity,i.evidence_version,r.mode='shadow',r.mode='production',r.id)
    on conflict (commercial_identity,evidence_version,created_in_shadow_mode) where commercial_identity is not null do nothing;
    select * into strict d from public.autopilot_product_drafts where commercial_identity=i.identity and evidence_version=i.evidence_version and created_in_shadow_mode=(r.mode='shadow');
    -- Reused evidence drafts remain owned by their original run. Shadow reuse is safe;
    -- production publication must create a fresh evidence version after revalidation.
    update public.autopilot_sourcing_items set draft_id=d.id,status='draft_created',checkpoint=checkpoint || '{"draft_created":true}'::jsonb,updated_at=now() where id=i.id;
   end if;
  elsif command='council' then
   if i.council is null then
    update public.autopilot_sourcing_items set council=args->'council',status=case when args #>> '{council,decision}'='approve' and not coalesce((args #>> '{council,ownerEscalationRequired}')::boolean,true) then 'council_approved' else 'council_rejected' end,updated_at=now() where id=i.id;
    update public.autopilot_product_drafts set status=case when args #>> '{council,decision}'='approve' and not coalesce((args #>> '{council,ownerEscalationRequired}')::boolean,true) then 'ai_approved' else 'rejected' end,
     reviewed_by='autopilot-council:durable',review_reason=args #>> '{council,summary}',reviewed_at=now() where id=i.draft_id and status='draft';
   end if;
  else
   if i.status not in ('council_approved','published','shadow_completed') then raise exception 'COUNCIL_APPROVAL_REQUIRED'; end if;
   if r.mode='shadow' then
    update public.autopilot_sourcing_items set status='shadow_completed',checkpoint=checkpoint || '{"shadow_completed":true}'::jsonb,updated_at=now() where id=i.id;
   else
    select * into strict d from public.autopilot_product_drafts where id=i.draft_id;
    if d.created_in_shadow_mode or not d.publication_eligible then raise exception 'SHADOW_PUBLICATION_DENIED'; end if;
    if d.sourcing_run_id<>r.id then raise exception 'FRESH_PRODUCTION_EVIDENCE_REQUIRED'; end if;
    select id into d.published_product_id from public.products where commercial_identity=i.identity;
    if d.published_product_id is null then perform public.publish_autopilot_draft(i.draft_id); end if;
    update public.autopilot_sourcing_items set status='published',checkpoint=checkpoint || '{"published":true}'::jsonb,updated_at=now() where id=i.id;
   end if;
  end if;
  update public.autopilot_sourcing_runs set current_stage=command,last_checkpoint=jsonb_build_object('item',i.id,'command',command) where id=r.id;
 elsif command='release' then
  if args->>'error' is not null then
   update public.autopilot_sourcing_runs set status=case when coalesce((args->>'terminal')::boolean,false) then 'failed_terminal' else 'failed_retryable' end,
    error_code=args->>'error',error_count=error_count+1,next_retry_at=(args->>'retryAt')::timestamptz where id=r.id;
  elsif r.discovery_done and not exists(select 1 from public.autopilot_sourcing_items where run_id=r.id and status not in ('needs_evidence','evidence_rejected','pricing_rejected','council_rejected','shadow_completed','published','failed_terminal')) then
   update public.autopilot_sourcing_runs set status=case when exists(select 1 from public.autopilot_sourcing_items where run_id=r.id and draft_id is not null) then 'completed' else 'completed_no_candidates' end,completed_at=now() where id=r.id;
  else
   update public.autopilot_sourcing_runs set status='queued' where id=r.id;
  end if;
  update public.autopilot_sourcing_runs set lease_expires_at=null,lease_owner=null where id=r.id;
 elsif command<>'heartbeat' then raise exception 'UNKNOWN_COMMAND';
 end if;
 update public.autopilot_sourcing_runs set metrics=(select jsonb_build_object(
  'productsFetched',count(*),'productsNormalized',count(*) filter(where checkpoint ? 'normalized'),
  'evidenceAccepted',count(*) filter(where checkpoint ? 'evidence_validated'),
  'evidenceRejected',count(*) filter(where status='evidence_rejected'),
  'needsEvidence',count(*) filter(where status='needs_evidence'),
  'opportunitiesEvaluated',count(*) filter(where checkpoint ? 'opportunity_scored'),
  'pricingAccepted',count(*) filter(where draft_id is not null),
  'pricingRejected',count(*) filter(where status='pricing_rejected'),
  'draftsCreated',count(*) filter(where draft_id is not null),
  'councilApproved',count(*) filter(where council->>'decision'='approve'),
  'councilRejected',count(*) filter(where council->>'decision'='reject'),
  'ownerEscalations',count(*) filter(where council->>'ownerEscalationRequired'='true'),
  'shadowWouldPublish',count(*) filter(where status='shadow_completed'),
  'published',count(*) filter(where status='published'),
  'retryCount',coalesce(sum(attempt),0),
  'errorCount',(select error_count from public.autopilot_sourcing_runs where id=r.id),
  'modelCalls',(select model_calls from public.autopilot_sourcing_runs where id=r.id),
  'durationMs',extract(epoch from(clock_timestamp()-r.started_at))*1000,
  'costActual',null)
  from public.autopilot_sourcing_items where run_id=r.id) where id=r.id;
 select to_jsonb(t) into result from public.autopilot_sourcing_runs t where id=r.id;
 return result;
end $$;
alter table public.autopilot_sourcing_runs enable row level security;
alter table public.autopilot_sourcing_items enable row level security;
revoke all on public.autopilot_sourcing_runs,public.autopilot_sourcing_items from public,anon,authenticated;
grant select,insert,update on public.autopilot_sourcing_runs,public.autopilot_sourcing_items to service_role;
revoke all on function public.autopilot_sourcing_command(text,jsonb),public.autopilot_draft_barrier(),public.autopilot_product_barrier() from public,anon,authenticated;
grant execute on function public.autopilot_sourcing_command(text,jsonb),public.autopilot_draft_barrier(),public.autopilot_product_barrier() to service_role;
