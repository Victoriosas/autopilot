-- Canonical hosted migration statements captured read-only for disposable replay tests.
-- Source: supabase_migrations.schema_migrations; never apply this fixture to a hosted project.

-- BEGIN 20260912033258_autopilot_core_v4
create table if not exists public.agent_tasks (
  id text primary key,
  goal text not null,
  actor text not null,
  action text not null,
  status text not null,
  input jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_tasks_status_check check (status in (
    'queued', 'running', 'awaiting_approval', 'completed', 'failed', 'blocked'
  ))
);
create index if not exists agent_tasks_status_idx on public.agent_tasks(status);
create index if not exists agent_tasks_created_at_idx on public.agent_tasks(created_at desc);
create table if not exists public.agent_audit_events (
  id bigint generated always as identity primary key,
  task_id text not null references public.agent_tasks(id) on delete cascade,
  event_type text not null,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists agent_audit_events_task_id_idx on public.agent_audit_events(task_id);
create index if not exists agent_audit_events_created_at_idx on public.agent_audit_events(created_at desc);
alter table public.agent_tasks enable row level security;
alter table public.agent_audit_events enable row level security;
-- END 20260912033258_autopilot_core_v4

-- BEGIN 20260912033307_autopilot_model_telemetry
create table if not exists public.model_calls (
  id bigint generated always as identity primary key,
  task_type text not null,
  provider text not null,
  model text not null,
  status text not null,
  latency_ms integer not null check (latency_ms >= 0),
  input_tokens integer,
  output_tokens integer,
  estimated_cost_usd numeric(12, 6),
  error_code text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint model_calls_status_check check (status in ('success', 'error'))
);
create index if not exists model_calls_created_at_idx on public.model_calls(created_at desc);
create index if not exists model_calls_provider_model_idx on public.model_calls(provider, model);
create index if not exists model_calls_task_type_idx on public.model_calls(task_type);
alter table public.model_calls enable row level security;
-- END 20260912033307_autopilot_model_telemetry

-- BEGIN 20260912033348_security_hardening_victoriosa
-- Prevent role escalation during signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Stable search_path for trigger helper.
alter function public.update_updated_at_column() set search_path = public;

-- SECURITY DEFINER helpers must not be callable as public RPCs unless needed.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Views must respect the querying user's RLS context.
alter view public.published_products set (security_invoker = true);
alter view public.recent_orders set (security_invoker = true);
alter view public.autopilot_stats set (security_invoker = true);

-- Replace dangerously broad sourcing policies. Service-role server calls bypass RLS;
-- authenticated admins can manage these records from the private console.
drop policy if exists service_all_discovered_products on public.discovered_products;
drop policy if exists service_all_sourcing_config on public.sourcing_config;
drop policy if exists service_all_sourcing_runs on public.sourcing_runs;

alter table public.discovered_products enable row level security;
alter table public.sourcing_config enable row level security;
alter table public.sourcing_runs enable row level security;

create policy "Admins full access discovered_products"
on public.discovered_products for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Admins full access sourcing_config"
on public.sourcing_config for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Admins full access sourcing_runs"
on public.sourcing_runs for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Scope existing admin/public policies to the roles that actually need them.
drop policy if exists "Admins full access products" on public.products;
create policy "Admins full access products" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public read published products" on public.products;
create policy "Public read published products" on public.products for select to anon, authenticated using (status = 'published');

drop policy if exists "Admins full access product_analysis" on public.product_analysis;
create policy "Admins full access product_analysis" on public.product_analysis for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public read analysis for published products" on public.product_analysis;
create policy "Public read analysis for published products" on public.product_analysis for select to anon, authenticated using (exists (select 1 from public.products where products.id = product_analysis.product_id and products.status = 'published'));

drop policy if exists "Admins full access feature_flags" on public.feature_flags;
create policy "Admins full access feature_flags" on public.feature_flags for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Public read feature_flags" on public.feature_flags;
create policy "Public read feature_flags" on public.feature_flags for select to anon, authenticated using (true);

drop policy if exists "Admins full access settings" on public.settings;
create policy "Admins full access settings" on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Public read settings" on public.settings;
create policy "Public read settings" on public.settings for select to anon, authenticated using (true);

-- Orders are created/updated by the server service role. Signed-in customers may read their own.
drop policy if exists "Admins full access orders" on public.orders;
create policy "Admins full access orders" on public.orders for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Users insert own orders" on public.orders;
drop policy if exists "Users read own orders" on public.orders;
create policy "Users read own orders" on public.orders for select to authenticated using ((select auth.uid()) = user_id);

-- Profile policies, explicitly authenticated and optimized auth.uid() lookup.
drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles" on public.profiles for select to authenticated using (public.is_admin());
drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Admins can update all profiles" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id and role = 'customer');

-- Admin-only operational tables.
do $$
declare t text;
begin
  foreach t in array array['alerts','autopilot_run_logs','autopilot_runs','supplier_orders','suppliers'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Cover missing FK indexes flagged by the advisor.
create index if not exists idx_alerts_product_id on public.alerts(product_id);
create index if not exists idx_alerts_supplier_order_id on public.alerts(supplier_order_id);
create index if not exists idx_discovered_products_sourcing_run_id on public.discovered_products(sourcing_run_id);
create index if not exists idx_settings_updated_by on public.settings(updated_by);
-- END 20260912033348_security_hardening_victoriosa

-- BEGIN 20260912035508_move_admin_helper_out_of_exposed_schema_v2
create schema if not exists private;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public, anon;
grant usage on schema private to authenticated, service_role;
grant execute on function private.is_admin() to authenticated, service_role;

alter policy "Admins full access alerts" on public.alerts to authenticated using (private.is_admin()) with check (private.is_admin());
alter policy "Admins read audit_logs" on public.audit_logs to authenticated using (private.is_admin());
alter policy "Admins full access run_logs" on public.autopilot_run_logs to authenticated using (private.is_admin()) with check (private.is_admin());
alter policy "Admins full access autopilot_runs" on public.autopilot_runs to authenticated using (private.is_admin()) with check (private.is_admin());
alter policy "Admins full access discovered_products" on public.discovered_products to authenticated using (private.is_admin()) with check (private.is_admin());
alter policy "Admins full access feature_flags" on public.feature_flags to authenticated using (private.is_admin()) with check (private.is_admin());
alter policy "Admins full access orders" on public.orders to authenticated using (private.is_admin()) with check (private.is_admin());
alter policy "Admins full access product_analysis" on public.product_analysis to authenticated using (private.is_admin()) with check (private.is_admin());
alter policy "Admins full access products" on public.products to authenticated using (private.is_admin()) with check (private.is_admin());
alter policy "Admins can read all profiles" on public.profiles to authenticated using (private.is_admin());
alter policy "Admins can update all profiles" on public.profiles to authenticated using (private.is_admin()) with check (private.is_admin());
alter policy "Admins full access settings" on public.settings to authenticated using (private.is_admin()) with check (private.is_admin());
alter policy "Admins full access sourcing_config" on public.sourcing_config to authenticated using (private.is_admin()) with check (private.is_admin());
alter policy "Admins full access sourcing_runs" on public.sourcing_runs to authenticated using (private.is_admin()) with check (private.is_admin());
alter policy "Admins full access supplier_orders" on public.supplier_orders to authenticated using (private.is_admin()) with check (private.is_admin());
alter policy "Admins full access suppliers" on public.suppliers to authenticated using (private.is_admin()) with check (private.is_admin());

alter policy "Admin delete product images" on storage.objects to authenticated using ((bucket_id = 'product-images'::text) and private.is_admin());
alter policy "Admin update product images" on storage.objects to authenticated using ((bucket_id = 'product-images'::text) and private.is_admin()) with check ((bucket_id = 'product-images'::text) and private.is_admin());
alter policy "Admin upload product images" on storage.objects to authenticated with check ((bucket_id = 'product-images'::text) and private.is_admin());

drop function if exists public.is_admin();
-- END 20260912035508_move_admin_helper_out_of_exposed_schema_v2

-- BEGIN 20260912200514_autopilot_product_drafts
create table if not exists public.autopilot_product_drafts (
  id uuid primary key default gen_random_uuid(),
  source_candidate_id text not null,
  status text not null default 'draft' check (status in ('draft')),
  draft jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists autopilot_product_drafts_created_at_idx
  on public.autopilot_product_drafts (created_at desc);

create index if not exists autopilot_product_drafts_source_candidate_idx
  on public.autopilot_product_drafts (source_candidate_id);

alter table public.autopilot_product_drafts enable row level security;

comment on table public.autopilot_product_drafts is
  'Server-only Autopilot commercial drafts. No frontend RLS policies by design; service role access only.';
-- END 20260912200514_autopilot_product_drafts

-- BEGIN 20260912200516_ai_governor_draft_reviews
alter table public.autopilot_product_drafts
  drop constraint if exists autopilot_product_drafts_status_check;

alter table public.autopilot_product_drafts
  add constraint autopilot_product_drafts_status_check
  check (status in ('draft', 'ai_approved', 'rejected'));

alter table public.autopilot_product_drafts
  add column if not exists reviewed_by text,
  add column if not exists review_reason text,
  add column if not exists reviewed_at timestamptz;

create index if not exists autopilot_product_drafts_status_idx
  on public.autopilot_product_drafts (status, created_at desc);

comment on column public.autopilot_product_drafts.reviewed_by is
  'Server-side review authority identifier. Standard approvals are recorded as AI council decisions and are never represented as human review.';

comment on column public.autopilot_product_drafts.review_reason is
  'Auditable rationale for approve/reject decisions, including council vote summaries when applicable.';
-- END 20260912200516_ai_governor_draft_reviews

-- BEGIN 20260912200517_governed_publication
alter table public.autopilot_product_drafts
  drop constraint if exists autopilot_product_drafts_status_check;

alter table public.autopilot_product_drafts
  add constraint autopilot_product_drafts_status_check
  check (status in ('draft', 'ai_approved', 'rejected', 'publishing', 'published'));

alter table public.autopilot_product_drafts
  add column if not exists published_product_id uuid,
  add column if not exists published_at timestamptz;

create unique index if not exists autopilot_product_drafts_published_product_uidx
  on public.autopilot_product_drafts (published_product_id)
  where published_product_id is not null;

create index if not exists autopilot_product_drafts_publication_status_idx
  on public.autopilot_product_drafts (status, updated_at desc);

comment on column public.autopilot_product_drafts.published_product_id is
  'Product created from this council-approved draft. Publication is server-side and does not trigger supplier purchase.';

comment on column public.autopilot_product_drafts.published_at is
  'Timestamp when a council-approved draft was published to the storefront catalog.';
-- END 20260912200517_governed_publication

-- BEGIN 20260912200518_autopilot_repricing_proposals
create table if not exists public.autopilot_repricing_proposals (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  status text not null check (status in ('pending','ai_approved','rejected','applied')) default 'pending',
  proposal jsonb not null,
  council jsonb,
  reviewed_by text,
  reviewed_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists autopilot_repricing_proposals_product_id_idx
  on public.autopilot_repricing_proposals(product_id);

create index if not exists autopilot_repricing_proposals_status_idx
  on public.autopilot_repricing_proposals(status);

alter table public.autopilot_repricing_proposals enable row level security;

-- Intentionally no frontend policies. This table is server/service-role only.
-- END 20260912200518_autopilot_repricing_proposals

-- BEGIN 20260912200520_catalog_observation_snapshots
create table if not exists public.autopilot_catalog_observations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  observed_at timestamptz not null default now(),
  source text not null,
  severity text not null check (severity in ('info','warning','critical')),
  current_price numeric not null,
  observed_supplier_cost numeric,
  observed_stock integer,
  signals jsonb not null default '[]'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists autopilot_catalog_observations_product_id_idx
  on public.autopilot_catalog_observations(product_id, observed_at desc);

alter table public.autopilot_catalog_observations enable row level security;

comment on table public.autopilot_catalog_observations is
  'Server-only immutable snapshots of catalog observations used by Autopilot governance.';
-- END 20260912200520_catalog_observation_snapshots

-- BEGIN 20260912200521_release_integrity
-- Additive rollout: existing catalog currency remains unknown until verified.
alter table public.products add column if not exists currency text;
alter table public.orders
  add column if not exists provider_order_id text,
  add column if not exists provider_amount numeric,
  add column if not exists provider_currency text;
create unique index if not exists orders_provider_order_uidx
  on public.orders(payment_method, provider_order_id) where provider_order_id is not null;

-- A single transaction owns approval, product insertion and publication marking.
-- Invoker security plus explicit service-role-only EXECUTE keeps browser users out.
create or replace function public.publish_autopilot_draft(draft_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare d public.autopilot_product_drafts%rowtype; p uuid; price_value numeric;
begin
  select * into strict d from public.autopilot_product_drafts where id=draft_id for update;
  if d.status='published' and d.published_product_id is not null then return to_jsonb(d); end if;
  if d.status<>'ai_approved' or d.reviewed_by not like 'autopilot-council:%' then
    raise exception 'COUNCIL_APPROVAL_REQUIRED';
  end if;
  if coalesce(d.draft #>> '{provenance,supplierCost}','') not in ('observed','verified') then
    raise exception 'SUPPLIER_EVIDENCE_REQUIRED';
  end if;
  if coalesce(d.draft->>'currency','') !~ '^[A-Z]{3}$' then raise exception 'CURRENCY_REQUIRED'; end if;
  price_value := (d.draft->>'price')::numeric;
  if price_value is null or price_value<=0 or price_value::text in ('NaN','Infinity','-Infinity') then raise exception 'INVALID_PRICE'; end if;
  if coalesce(btrim(d.draft->>'title'),'')='' then raise exception 'TITLE_REQUIRED'; end if;
  p := gen_random_uuid();
  insert into public.products(id,title,slug,sku,description,subtitle,category,price,currency,
    inventory,rating,review_count,status,tags,features,specs,images,brand,traceability,source_url,created_by)
  values(p,d.draft->>'title','victoriosa-'||p::text,'VIC-'||p::text,
    d.draft->>'description',d.draft->>'subtitle',d.draft->>'category',price_value,d.draft->>'currency',
    0,null,0,'published',coalesce(d.draft->'tags','[]'::jsonb),coalesce(d.draft->'features','[]'::jsonb),
    coalesce(d.draft->'specs','{}'::jsonb),array(select jsonb_array_elements_text(coalesce(d.draft->'images','[]'::jsonb))),
    'Victoriosa',jsonb_build_object('draftId',d.id,'provenance',d.draft->'provenance','commercial',d.draft->'commercial'),
    d.draft #>> '{provenance,sourceUrl}','Autopilot Council');
  update public.autopilot_product_drafts set status='published',published_product_id=p,published_at=now(),updated_at=now()
    where id=draft_id returning * into d;
  return to_jsonb(d);
end $$;
revoke all on function public.publish_autopilot_draft(uuid) from public,anon,authenticated;
grant execute on function public.publish_autopilot_draft(uuid) to service_role;

create or replace function public.apply_autopilot_repricing(proposal_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.autopilot_repricing_proposals%rowtype; p public.products%rowtype; new_price numeric;
begin
  select * into strict r from public.autopilot_repricing_proposals where id=proposal_id for update;
  if r.status='applied' then return to_jsonb(r); end if;
  if r.status<>'ai_approved' or coalesce(r.council->>'decision','')<>'approve' or
     coalesce((r.proposal #>> '{policy,ownerApprovalRequired}')::boolean,true) then
    raise exception 'REPRICING_APPROVAL_REQUIRED';
  end if;
  select * into strict p from public.products where id=r.product_id for update;
  if p.status<>'published' or p.price<>(r.proposal->>'currentPrice')::numeric or
     p.currency is distinct from r.proposal->>'currency' then raise exception 'STALE_PRICE_OR_CURRENCY'; end if;
  new_price := (r.proposal->>'proposedPrice')::numeric;
  if new_price is null or new_price<=0 or new_price::text in ('NaN','Infinity','-Infinity') then raise exception 'INVALID_PRICE'; end if;
  update public.products set price=new_price where id=p.id;
  update public.autopilot_repricing_proposals set status='applied',applied_at=now(),updated_at=now()
    where id=proposal_id returning * into r;
  return to_jsonb(r);
end $$;
revoke all on function public.apply_autopilot_repricing(uuid) from public,anon,authenticated;
grant execute on function public.apply_autopilot_repricing(uuid) to service_role;
-- END 20260912200521_release_integrity

-- BEGIN 20260912215447_catalog_archive_and_clear
create table if not exists public.product_catalog_archive (
  archive_id uuid primary key default gen_random_uuid(),
  operation_id text not null,
  archived_at timestamptz not null default now(),
  product_id uuid not null,
  product jsonb not null,
  unique (operation_id, product_id)
);

alter table public.product_catalog_archive enable row level security;
revoke all on table public.product_catalog_archive from anon, authenticated;
grant select, insert, update, delete on table public.product_catalog_archive to service_role;

create or replace function public.archive_and_clear_products(p_operation_id text)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  removed integer;
begin
  if p_operation_id is null or length(trim(p_operation_id)) < 8 then
    raise exception 'operation_id_required';
  end if;

  if exists (
    select 1 from public.product_catalog_archive
    where operation_id = p_operation_id
  ) then
    return 0;
  end if;

  insert into public.product_catalog_archive(operation_id, product_id, product)
  select p_operation_id, p.id, to_jsonb(p)
  from public.products p;

  delete from public.products;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.archive_and_clear_products(text) from public;
grant execute on function public.archive_and_clear_products(text) to service_role;
-- END 20260912215447_catalog_archive_and_clear

-- BEGIN 20260914232844_durable_sourcing_orchestrator
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
-- END 20260914232844_durable_sourcing_orchestrator

-- BEGIN 20260914232850_autopilot_sourcing_fk_indexes
-- Durable Autopilot foreign-key indexes.
-- Additive and safe to apply after 20260914215143_durable_sourcing_orchestrator.
create index if not exists autopilot_product_drafts_sourcing_run_idx
  on public.autopilot_product_drafts(sourcing_run_id);

create index if not exists autopilot_sourcing_items_draft_idx
  on public.autopilot_sourcing_items(draft_id)
  where draft_id is not null;
-- END 20260914232850_autopilot_sourcing_fk_indexes

-- BEGIN 20260914233819_production_shadow_once
-- One-time operator authorization for a bounded production shadow run.
-- Tokens are stored only as SHA-256 hashes and can be consumed once.
create table public.autopilot_shadow_run_authorizations (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  purpose text not null default 'production_shadow_once' check (purpose = 'production_shadow_once'),
  limits jsonb not null default '{"maxCandidates":3,"maxAiCalls":2,"durationMs":15000}'::jsonb,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

alter table public.autopilot_shadow_run_authorizations enable row level security;
revoke all on public.autopilot_shadow_run_authorizations from public, anon, authenticated;
grant select, insert, update on public.autopilot_shadow_run_authorizations to service_role;

create function public.consume_autopilot_shadow_run_authorization(requested_token_hash text)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  authorization_id uuid;
  authorization_limits jsonb;
begin
  if requested_token_hash is null or requested_token_hash !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  update public.autopilot_shadow_run_authorizations
     set consumed_at = clock_timestamp()
   where token_hash = requested_token_hash
     and consumed_at is null
     and expires_at > clock_timestamp()
  returning id, limits into authorization_id, authorization_limits;

  if not found then return null; end if;
  return jsonb_build_object('id', authorization_id, 'limits', authorization_limits);
end $$;

revoke all on function public.consume_autopilot_shadow_run_authorization(text) from public, anon, authenticated;
grant execute on function public.consume_autopilot_shadow_run_authorization(text) to service_role;
-- END 20260914233819_production_shadow_once

-- BEGIN 20260914234304_shadow_authorization_by_id
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
-- END 20260914234304_shadow_authorization_by_id

-- BEGIN 20260915060822_owner_safe_defaults
insert into public.settings (key, value, updated_at)
values (
  'autopilot_config',
  jsonb_build_object(
    'autoApproveScoreThreshold', 85,
    'maxRiskLevelAllowed', 'low',
    'minMarginPercentage', 30,
    'autoPublishApproved', false,
    'brandTone', 'premium_beauty_uruguay',
    'activeSources', jsonb_build_array('CJ Dropshipping'),
    'blacklistedKeywords', jsonb_build_array('fake','replica','imitation','cure','medical','miracle','toxic','unauthorized','counterfeit'),
    'targetCategories', jsonb_build_array('Belleza y cuidado personal','Accesorios de skincare','Organización de belleza','Cuidado corporal'),
    'defaultCurrency', 'UYU ($)',
    'autoDiscoveryIntervalHours', 6
  ),
  now()
)
on conflict (key) do update
set value = excluded.value,
    updated_at = excluded.updated_at;
-- END 20260915060822_owner_safe_defaults

-- BEGIN 20260915073800_release_candidate_lane
-- Owner release-candidate lane.
-- Production validation may finish with an approved, publishable draft without
-- mutating the public catalog. Manual publication remains a separate admin act.

alter table public.products
  add column if not exists publication_eligible boolean not null default false;

alter table public.autopilot_sourcing_items
  drop constraint if exists autopilot_sourcing_items_status_check;
alter table public.autopilot_sourcing_items
  add constraint autopilot_sourcing_items_status_check check (status in (
    'discovered','normalized','needs_evidence','evidence_validated','evidence_rejected',
    'opportunity_scored','pricing_completed','pricing_rejected','draft_created',
    'council_pending','council_approved','council_rejected','shadow_completed',
    'production_ready','published','failed_retryable','failed_terminal'
  ));

alter function public.autopilot_sourcing_command(text,jsonb)
  rename to autopilot_sourcing_command_v1;

create function public.autopilot_sourcing_command(command text, args jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb; target_run_id uuid;
begin
  result := public.autopilot_sourcing_command_v1(command,args);
  if command<>'release' then return result; end if;

  target_run_id := nullif(result->>'id','')::uuid;
  if target_run_id is null or result->>'status'<>'queued' then return result; end if;

  if exists(select 1 from public.autopilot_sourcing_runs r where r.id=target_run_id and r.discovery_done)
     and not exists(
       select 1 from public.autopilot_sourcing_items i
       where i.run_id=target_run_id and i.status not in (
         'needs_evidence','evidence_rejected','pricing_rejected','council_rejected',
         'shadow_completed','production_ready','published','failed_terminal'
       )
     ) then
    update public.autopilot_sourcing_runs r
      set status=case when exists(select 1 from public.autopilot_sourcing_items i where i.run_id=target_run_id and i.draft_id is not null)
                      then 'completed' else 'completed_no_candidates' end,
          completed_at=coalesce(r.completed_at,now()),updated_at=now()
      where r.id=target_run_id;
    select to_jsonb(r) into result from public.autopilot_sourcing_runs r where r.id=target_run_id;
  end if;
  return result;
end $$;
revoke all on function public.autopilot_sourcing_command(text,jsonb) from public,anon,authenticated;
grant execute on function public.autopilot_sourcing_command(text,jsonb) to service_role;
revoke all on function public.autopilot_sourcing_command_v1(text,jsonb) from public,anon,authenticated;
grant execute on function public.autopilot_sourcing_command_v1(text,jsonb) to service_role;

create or replace function public.autopilot_product_barrier() returns trigger
language plpgsql security invoker set search_path='' as $$
declare d public.autopilot_product_drafts%rowtype; r public.autopilot_sourcing_runs%rowtype;
begin
 if new.traceability->>'draftId' is not null then
  select * into strict d from public.autopilot_product_drafts where id=(new.traceability->>'draftId')::uuid;
  if d.created_in_shadow_mode or not d.publication_eligible then raise exception 'SHADOW_PUBLICATION_DENIED'; end if;
  if d.sourcing_run_id is not null then
   select * into strict r from public.autopilot_sourcing_runs where id=d.sourcing_run_id for update;
   if current_setting('autopilot.manual_release',true)='true' then
    if r.mode<>'production' or r.status<>'completed' or r.completed_at is null
       or r.completed_at < clock_timestamp()-interval '24 hours' then
      raise exception 'MANUAL_RELEASE_EVIDENCE_STALE_OR_INVALID';
    end if;
   elsif r.mode<>'production' or r.id::text is distinct from current_setting('autopilot.run',true)
      or r.lease_generation::text is distinct from current_setting('autopilot.generation',true)
      or r.lease_owner::text is distinct from current_setting('autopilot.owner',true)
      or r.lease_expires_at<=clock_timestamp() then
    raise exception 'FENCE_REJECTED';
   end if;
  end if;
  new.commercial_identity := d.commercial_identity;
  new.publication_eligible := true;
 end if;
 return new;
end $$;

create or replace function public.publish_autopilot_draft_manual(draft_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare d public.autopilot_product_drafts%rowtype; r public.autopilot_sourcing_runs%rowtype;
        i public.autopilot_sourcing_items%rowtype; result jsonb;
begin
  select * into strict d from public.autopilot_product_drafts d0 where d0.id=draft_id for update;
  if d.status='published' and d.published_product_id is not null then return to_jsonb(d); end if;
  if d.created_in_shadow_mode or not d.publication_eligible then raise exception 'SHADOW_PUBLICATION_DENIED'; end if;
  if d.status<>'ai_approved' or d.reviewed_by not like 'autopilot-council:%' then raise exception 'COUNCIL_APPROVAL_REQUIRED'; end if;
  if d.sourcing_run_id is null then raise exception 'PRODUCTION_SOURCING_RUN_REQUIRED'; end if;

  select * into strict r from public.autopilot_sourcing_runs r0 where r0.id=d.sourcing_run_id for update;
  if r.mode<>'production' or r.status<>'completed' or r.completed_at is null
     or r.completed_at < clock_timestamp()-interval '24 hours' then
    raise exception 'MANUAL_RELEASE_EVIDENCE_STALE_OR_INVALID';
  end if;

  select * into strict i from public.autopilot_sourcing_items si
   where si.run_id=r.id and si.draft_id=d.id for update;
  if i.status not in ('production_ready','published')
     or coalesce(i.council->>'decision','')<>'approve'
     or coalesce((i.council->>'ownerEscalationRequired')::boolean,true) then
    raise exception 'PRODUCTION_READY_COUNCIL_REQUIRED';
  end if;

  perform set_config('autopilot.manual_release','true',true);
  result := public.publish_autopilot_draft(d.id);
  update public.autopilot_sourcing_items si
    set status='published',checkpoint=si.checkpoint || jsonb_build_object('published',true,'manualPublishedAt',now()),updated_at=now()
    where si.id=i.id and si.status<>'published';
  return result;
end $$;
revoke all on function public.publish_autopilot_draft_manual(uuid) from public,anon,authenticated;
grant execute on function public.publish_autopilot_draft_manual(uuid) to service_role;
-- END 20260915073800_release_candidate_lane

-- BEGIN 20260915211638_autopilot_market_observations
create table if not exists public.autopilot_market_observations (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  title text not null,
  url text not null,
  price_uyu numeric(12,2) not null check (price_uyu >= 100 and price_uyu <= 1000000),
  sold_quantity integer null check (sold_quantity is null or sold_quantity >= 0),
  rating_count integer null check (rating_count is null or rating_count >= 0),
  source text not null default 'curated_web_research',
  observed_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_by text not null default 'autopilot_owner_research',
  created_at timestamptz not null default now(),
  constraint autopilot_market_observations_url_nonempty check (length(trim(url)) > 0),
  constraint autopilot_market_observations_title_nonempty check (length(trim(title)) > 0),
  constraint autopilot_market_observations_expiry check (expires_at > observed_at)
);
create index if not exists autopilot_market_observations_fresh_idx on public.autopilot_market_observations (expires_at desc, observed_at desc);
create index if not exists autopilot_market_observations_query_idx on public.autopilot_market_observations (query);
create unique index if not exists autopilot_market_observations_url_observed_uidx on public.autopilot_market_observations (url, observed_at);
alter table public.autopilot_market_observations enable row level security;
revoke all on table public.autopilot_market_observations from anon, authenticated;
grant select, insert, update, delete on table public.autopilot_market_observations to service_role;
comment on table public.autopilot_market_observations is 'Durable, source-linked Uruguay market observations used as evidence. Never treated as supplier inventory or audited sales.';
comment on column public.autopilot_market_observations.price_uyu is 'Observed retail asking price in Uruguayan pesos from the linked source at observed_at.';
comment on column public.autopilot_market_observations.sold_quantity is 'Optional sold-count signal explicitly visible at the source at observation time; null when not shown.';
comment on column public.autopilot_market_observations.rating_count is 'Optional rating-count signal explicitly visible at the source at observation time; null when not shown.';
-- END 20260915211638_autopilot_market_observations

-- BEGIN 20260915214420_storefront_waitlist
create table if not exists public.storefront_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  interest text not null default 'general' check (interest in ('general','facial_accessories','makeup_organization','reusable_care','body_care')),
  source text not null default 'storefront',
  consent_launch_updates boolean not null default false check (consent_launch_updates = true),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists storefront_waitlist_email_uidx on public.storefront_waitlist (lower(email));
create index if not exists storefront_waitlist_interest_created_idx on public.storefront_waitlist (interest, created_at desc);
alter table public.storefront_waitlist enable row level security;
revoke all on table public.storefront_waitlist from anon, authenticated;
grant select, insert, update on table public.storefront_waitlist to service_role;
comment on table public.storefront_waitlist is 'Explicit-consent launch notification list. Public clients cannot query or write this table directly.';
-- END 20260915214420_storefront_waitlist

-- BEGIN 20260917035357_add_private_provider_oauth_tokens
create table if not exists public.provider_oauth_tokens (
  provider text primary key,
  access_token text not null,
  refresh_token text,
  token_type text,
  expires_at timestamptz,
  scope text,
  external_user_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.provider_oauth_tokens enable row level security;
revoke all on table public.provider_oauth_tokens from anon, authenticated;
comment on table public.provider_oauth_tokens is 'Server-only OAuth credentials. Access only through service role; no client RLS policies.';
-- END 20260917035357_add_private_provider_oauth_tokens

-- BEGIN 20260917040051_link_manual_release_to_supplier
create or replace function public.publish_autopilot_draft(draft_id uuid)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  d public.autopilot_product_drafts%rowtype;
  p uuid;
  price_value numeric;
  supplier_uuid uuid;
begin
  select * into strict d from public.autopilot_product_drafts where id=draft_id for update;
  if d.status='published' and d.published_product_id is not null then return to_jsonb(d); end if;
  if d.status<>'ai_approved' or d.reviewed_by not like 'autopilot-council:%' then raise exception 'COUNCIL_APPROVAL_REQUIRED'; end if;
  if coalesce(d.draft #>> '{provenance,supplierCost}','') not in ('observed','verified') then raise exception 'SUPPLIER_EVIDENCE_REQUIRED'; end if;
  if coalesce(d.draft->>'currency','') !~ '^[A-Z]{3}$' then raise exception 'CURRENCY_REQUIRED'; end if;
  price_value := (d.draft->>'price')::numeric;
  if price_value is null or price_value<=0 or price_value::text in ('NaN','Infinity','-Infinity') then raise exception 'INVALID_PRICE'; end if;
  if coalesce(btrim(d.draft->>'title'),'')='' then raise exception 'TITLE_REQUIRED'; end if;

  select s.id into supplier_uuid from public.suppliers s
    where s.code = nullif(d.draft #>> '{provenance,supplierCode}','')
    limit 1;

  p := gen_random_uuid();
  insert into public.products(id,title,slug,sku,description,subtitle,category,price,currency,
    inventory,rating,review_count,status,tags,features,specs,images,brand,supplier_id,traceability,source_url,created_by)
  values(p,d.draft->>'title','victoriosa-'||p::text,
    coalesce(nullif(d.draft #>> '{provenance,sourceSku}',''),'VIC-'||p::text),
    d.draft->>'description',d.draft->>'subtitle',d.draft->>'category',price_value,d.draft->>'currency',
    0,null,0,'published',coalesce(d.draft->'tags','[]'::jsonb),coalesce(d.draft->'features','[]'::jsonb),
    coalesce(d.draft->'specs','{}'::jsonb),array(select jsonb_array_elements_text(coalesce(d.draft->'images','[]'::jsonb))),
    'Victoriosa',supplier_uuid,
    jsonb_build_object(
      'draftId',d.id,
      'provenance',d.draft->'provenance',
      'commercial',d.draft->'commercial',
      'supplier',jsonb_build_object(
        'name',d.draft #>> '{provenance,supplierName}',
        'code',d.draft #>> '{provenance,supplierCode}',
        'shopId',d.draft #>> '{provenance,supplierShopId}',
        'externalId',d.draft #>> '{provenance,supplierExternalId}'
      )
    ),
    d.draft #>> '{provenance,sourceUrl}','Autopilot Council');
  update public.autopilot_product_drafts set status='published',published_product_id=p,published_at=now(),updated_at=now()
    where id=draft_id returning * into d;
  return to_jsonb(d);
end $function$;
-- END 20260917040051_link_manual_release_to_supplier
