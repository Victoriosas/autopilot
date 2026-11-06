begin;
-- Only the database owner may authorize public catalog release.
create schema if not exists private;
revoke create on schema private from public,anon,authenticated,service_role;
grant usage on schema private to anon,authenticated,service_role;
create table public.beauty_publication_control(singleton boolean primary key default true check(singleton),enabled boolean not null default false);
revoke all on public.beauty_publication_control from public,anon,authenticated,service_role;
insert into public.beauty_publication_control(singleton,enabled)values(true,false);
create function private.beauty_publication_enabled() returns boolean language sql stable security definer set search_path='' as $$select coalesce((select enabled from public.beauty_publication_control where singleton),false)$$;
revoke all on function private.beauty_publication_enabled() from public;
grant execute on function private.beauty_publication_enabled() to anon,authenticated,service_role;
create table public.beauty_services (
 id text primary key check(id ~ '^[a-z][a-z0-9-]{1,63}$'),
 request_service text not null check(request_service in ('facial','massage','ritual','consultation')),
 category text not null check(char_length(category) between 1 and 80),
 title text not null check(char_length(btrim(title)) between 1 and 120),
 description text not null default '' check(char_length(description)<=2000),
 duration_minutes integer check(duration_minutes between 15 and 240),
 proposed_price_uyu numeric(10,2) check(proposed_price_uyu>0 and proposed_price_uyu<=100000),
 price_approved boolean not null default false,
 conditions text not null default '' check(char_length(conditions)<=2000),
 availability text not null default '' check(char_length(availability)<=500),
 available boolean not null default false,
 publication_status text not null default 'draft' check(publication_status in ('draft','pending','approved','published')),
 version integer not null default 1 check(version>0),
 updated_at timestamptz not null default now()
);
alter table public.beauty_services enable row level security;
alter table public.beauty_services force row level security;
revoke all on public.beauty_services from public,anon,authenticated,service_role;
grant select on public.beauty_services to anon,authenticated,service_role;
grant insert,update on public.beauty_services to authenticated,service_role;
create policy beauty_catalog_public on public.beauty_services for select to anon,authenticated using(private.beauty_publication_enabled() and publication_status='published' and available and price_approved);
create policy beauty_catalog_admin_read on public.beauty_services for select to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin'));
create policy beauty_catalog_admin_insert on public.beauty_services for insert to authenticated with check(exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin'));
create policy beauty_catalog_admin_update on public.beauty_services for update to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin')) with check(exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin'));
create function public.beauty_catalog_validate() returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
 if new.publication_status='published' and not private.beauty_publication_enabled() then raise exception 'BEAUTY_PUBLICATION_DISABLED';end if;
 if TG_OP='INSERT' and new.version<>1 then raise exception 'BEAUTY_VERSION_CONFLICT';end if;
 if TG_OP='UPDATE' then
  if new.id<>old.id or new.version<>old.version+1 then raise exception 'BEAUTY_VERSION_CONFLICT';end if;
  if old.publication_status='published' and (new.request_service,new.category,new.title,new.description,new.duration_minutes,new.proposed_price_uyu,new.conditions,new.availability) is distinct from (old.request_service,old.category,old.title,old.description,old.duration_minutes,old.proposed_price_uyu,old.conditions,old.availability) and (new.publication_status not in ('draft','pending') or new.price_approved) then raise exception 'BEAUTY_REAPPROVAL_REQUIRED';end if;
 end if;
 if new.publication_status in ('approved','published') and (not new.price_approved or new.proposed_price_uyu is null or new.duration_minutes is null or btrim(new.description)='' or btrim(new.conditions)='' or btrim(new.availability)='') then raise exception 'BEAUTY_PUBLICATION_INCOMPLETE';end if;
 new.updated_at=now();return new;
end $$;
revoke all on function public.beauty_catalog_validate() from public;
create trigger beauty_catalog_validate before insert or update on public.beauty_services for each row execute function public.beauty_catalog_validate();
insert into public.beauty_services(id,request_service,category,title)values('facial','facial','facial','Facial personalizado'),('massage','massage','massage','Masaje de relajación'),('ritual','ritual','ritual','Ritual facial y masaje'),('consultation','consultation','consultation','Consulta estética');
alter table public.beauty_requests add column catalog_service_id text references public.beauty_services(id),add column catalog_version integer,add column catalog_snapshot jsonb;
alter table public.beauty_requests add constraint beauty_request_catalog_pair check((catalog_service_id is null and catalog_version is null) or (catalog_service_id is not null and catalog_version>0));
create function public.beauty_request_catalog_validate() returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare selected public.beauty_services;
begin
 if new.catalog_service_id is null then new.catalog_snapshot=null;return new;end if;
 select * into selected from public.beauty_services where id=new.catalog_service_id for share;
 if not found or not private.beauty_publication_enabled() or selected.publication_status<>'published' or not selected.available or not selected.price_approved or selected.version<>new.catalog_version or selected.request_service<>new.service then raise exception 'BEAUTY_CATALOG_UNAVAILABLE';end if;
 new.catalog_snapshot=jsonb_build_object('title',selected.title,'duration_minutes',selected.duration_minutes,'price_uyu',selected.proposed_price_uyu,'conditions',selected.conditions,'availability',selected.availability);
 return new;
end $$;
revoke all on function public.beauty_request_catalog_validate() from public;
create trigger beauty_request_catalog_validate before insert on public.beauty_requests for each row execute function public.beauty_request_catalog_validate();
create table public.beauty_practitioners(user_id uuid primary key,active boolean not null default false);
alter table public.beauty_practitioners enable row level security;
alter table public.beauty_practitioners force row level security;
revoke all on public.beauty_practitioners from public,anon,authenticated,service_role;
grant select on public.beauty_practitioners to authenticated;
create policy beauty_practitioner_self on public.beauty_practitioners for select to authenticated using(user_id=(select auth.uid()));
create table public.beauty_evaluations(
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique references public.beauty_requests(id) on delete cascade,
 practitioner_id uuid not null references public.beauty_practitioners(user_id),
 client_declared jsonb not null default '{}',professional_notes jsonb not null default '{}',
 consent_version text not null check(consent_version='beauty-evaluation-v1'),
 consent_recorded_at timestamptz not null,consent_evidence text not null check(char_length(btrim(consent_evidence)) between 1 and 200),
 status text not null default 'draft' check(status in ('draft','finalized')),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 expires_at timestamptz not null default(now()+interval '90 days'),
 check(expires_at>created_at and expires_at<=created_at+interval '90 days')
);
create index beauty_evaluations_expiry on public.beauty_evaluations(expires_at);
alter table public.beauty_evaluations enable row level security;
alter table public.beauty_evaluations force row level security;
revoke all on public.beauty_evaluations from public,anon,authenticated,service_role;
grant select,insert on public.beauty_evaluations to authenticated;
grant update(client_declared,professional_notes,status,version) on public.beauty_evaluations to authenticated;
create policy beauty_evaluation_assigned on public.beauty_evaluations for all to authenticated using(practitioner_id=(select auth.uid()) and expires_at>now() and exists(select 1 from public.beauty_practitioners where user_id=(select auth.uid()) and active)) with check(practitioner_id=(select auth.uid()) and expires_at>now() and exists(select 1 from public.beauty_practitioners where user_id=(select auth.uid()) and active));
create function public.beauty_evaluation_validate() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare item record;entry jsonb;
begin
 if TG_OP='INSERT' then
  new.expires_at=least(new.expires_at,(select expires_at from public.beauty_requests where id=new.request_id));
  if new.version<>1 or new.status<>'draft' or new.consent_recorded_at>now() or new.consent_recorded_at<'2000-01-01'::timestamptz then raise exception 'BEAUTY_EVALUATION_CONSENT_INVALID';end if;
 else
  if new.request_id<>old.request_id or new.practitioner_id<>old.practitioner_id or new.consent_version<>old.consent_version or new.consent_recorded_at<>old.consent_recorded_at or new.consent_evidence<>old.consent_evidence or new.created_at<>old.created_at or new.expires_at<>old.expires_at then raise exception 'BEAUTY_EVALUATION_IDENTITY_IMMUTABLE';end if;
  if old.status='finalized' then raise exception 'BEAUTY_EVALUATION_FINALIZED';end if;
  if new.version<>old.version+1 then raise exception 'BEAUTY_VERSION_CONFLICT';end if;
 end if;
 if jsonb_typeof(new.client_declared)<>'object' or jsonb_typeof(new.professional_notes)<>'object' then raise exception 'BEAUTY_EVALUATION_CONTENT_INVALID';end if;
 for item in select key,value from jsonb_each(new.client_declared) loop
  if item.key not in ('skinType','sensitivity','cosmeticReactions','recentTreatments','expectations') or jsonb_typeof(item.value)<>'string' or char_length(item.value#>>'{}')>1000 then raise exception 'BEAUTY_EVALUATION_CONTENT_INVALID';end if;
 end loop;
 for item in select key,value from jsonb_each(new.professional_notes) loop
  if item.key='referral' then
   if jsonb_typeof(item.value)<>'boolean' then raise exception 'BEAUTY_EVALUATION_CONTENT_INVALID';end if;
  elsif item.key='suggestedServices' then
   if jsonb_typeof(item.value)<>'array' or jsonb_array_length(item.value)>20 then raise exception 'BEAUTY_EVALUATION_CONTENT_INVALID';end if;
   for entry in select value from jsonb_array_elements(item.value) loop
    if jsonb_typeof(entry)<>'string' or (entry#>>'{}')!~'^[a-z][a-z0-9-]{1,63}$' then raise exception 'BEAUTY_EVALUATION_CONTENT_INVALID';end if;
   end loop;
  elsif item.key not in ('observations','steps','frequency','aftercare') or jsonb_typeof(item.value)<>'string' or char_length(item.value#>>'{}')>3000 then raise exception 'BEAUTY_EVALUATION_CONTENT_INVALID';end if;
 end loop;
 if new.status='finalized' and coalesce(btrim(new.professional_notes->>'observations'),'')='' then raise exception 'BEAUTY_EVALUATION_CONTENT_INVALID';end if;
 new.updated_at=now();return new;
end $$;
revoke all on function public.beauty_evaluation_validate() from public;
create trigger beauty_evaluation_validate before insert or update on public.beauty_evaluations for each row execute function public.beauty_evaluation_validate();
comment on table public.beauty_evaluations is 'Sensitive cosmetic assessment. Explicit practitioner provisioning by database owner only. CRM administrators/service_role have no grants. Deleting parent inquiry cascades assessment (90-day inquiry retention); no permanent clinical history. No content logging.';
commit;
