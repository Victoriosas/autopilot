-- STAGED ONLY: no hosted migration, activation or delivery capability.
begin;
create table public.consultation_material_requests (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.consultation_requests(id) on delete cascade,
 operation_id uuid not null,
 payload jsonb not null,
 consent_state text not null default 'granted' check(consent_state in('granted','revoked')),
 review_state text not null default 'pending' check(review_state in('pending','reviewed','rejected','revoked')),
 delivery_decision text not null default 'no_send' check(delivery_decision='no_send'),
 created_by uuid references public.profiles(id) on delete set null,
 updated_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 expires_at timestamptz not null,
 unique(request_id,operation_id)
);
create table private.consultation_material_keys (
 request_id uuid not null references public.consultation_requests(id) on delete cascade,
 operation_id uuid not null, record_id uuid not null, fingerprint text not null,
 created_at timestamptz not null default now(), retired_at timestamptz,
 primary key(request_id,operation_id)
);
create table public.consultation_material_events (
 id bigint generated always as identity primary key,
 material_id uuid not null references public.consultation_material_requests(id) on delete cascade,
 actor_id uuid references public.profiles(id) on delete set null,
 event text not null check(event in('created','reviewed','rejected','revoked')),
 occurred_at timestamptz not null default now()
);
create index consultation_material_expiry on public.consultation_material_requests(expires_at);
create index consultation_material_events_request on public.consultation_material_events(material_id);
create index consultation_material_key_record on private.consultation_material_keys(record_id);
alter table public.consultation_material_requests enable row level security;
alter table public.consultation_material_events enable row level security;
alter table private.consultation_material_keys enable row level security;
revoke all on public.consultation_material_requests, public.consultation_material_events, private.consultation_material_keys from public,anon,authenticated,service_role;
revoke all on sequence public.consultation_material_events_id_seq from public,anon,authenticated,service_role;
grant select on public.consultation_material_requests,public.consultation_material_events to authenticated;

create function private.consultation_material_sources_valid(p_sources jsonb) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare ref jsonb; candidate jsonb; name text;
begin
 if jsonb_typeof(p_sources) is distinct from 'array' or jsonb_array_length(p_sources) not between 1 and 32 then return false;end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_sources))<>jsonb_array_length(p_sources) then return false;end if;
 for ref in select value from jsonb_array_elements(p_sources) loop
  if jsonb_typeof(ref)<>'object' or (select count(*) from jsonb_object_keys(ref))<>4 or not ref ?& array['id','version','source','sha256']
   or jsonb_typeof(ref->'id')<>'string' or jsonb_typeof(ref->'version')<>'string' or jsonb_typeof(ref->'source')<>'string'
   or jsonb_typeof(ref->'sha256')<>'string' or coalesce(ref->>'sha256','')!~'^[a-f0-9]{64}$' then return false;end if;
  if ref->>'source'='src/components/public/serviceDirectory.ts' and ref->>'version'='2026-10-23-v1' and ref->>'id' like 'catalog:%' then
   select title into name from public.beauty_services where id=substring(ref->>'id' from 9) and id in('higiene-y-limpieza-facial','limpieza-profunda','tratamiento-para-manchas','acne','rejuvenecimiento','hidratacion-y-nutricion-profunda','efecto-lifting','peeling','hidratacion-de-labios','contorno-de-ojos','lineas-de-expresion','exfoliacion-e-hidratacion','masaje-modelador','masaje-de-drenaje-linfatico','masaje-descontracturante','masaje-relax','reduccion-de-estrias');
   if name is null or encode(sha256(convert_to(name,'UTF8')),'hex')<>ref->>'sha256' then return false;end if;
  elsif ref->>'version'='2026-10-23-v1' and ref->>'source'='src/storefront/consultationKnowledge.ts#'||(ref->>'id') then
   name:=case ref->>'id'
    when 'initial-step' then 'En Victoriosas comenzamos con una evaluación inicial remota.'
    when 'clinical-limit' then 'La evaluación inicial remota no sustituye una valoración médica.'
    when 'pricing' then 'No se publican tarifas ni disponibilidad general antes de una evaluación.'
    else null end;
   if name is null or encode(sha256(convert_to(name,'UTF8')),'hex')<>ref->>'sha256' then return false;end if;
  else
   select value into candidate from jsonb_array_elements(public.consultation_knowledge_facts())
    where value->>'id'=ref->>'id' and value->>'version'=ref->>'version' and value->>'source'=ref->>'source';
   if candidate is null or encode(sha256(convert_to(candidate->>'fragment','UTF8')),'hex')<>ref->>'sha256' then return false;end if;
  end if;
 end loop;
 return true;
exception when others then return false;
end $$;
revoke all on function private.consultation_material_sources_valid(jsonb) from public,anon,authenticated,service_role;

create function public.consultation_material_visible(p_request uuid,p_payload jsonb,p_consent text,p_review text,p_expiry timestamptz) returns boolean
language sql stable security definer set search_path='' as $$
 select p_consent='granted' and p_review<>'revoked' and p_expiry>now()
 and exists(select 1 from public.profiles where id=auth.uid() and role='admin')
 and exists(select 1 from public.consultation_requests where id=p_request and expires_at>now() and input->'consent'='true'::jsonb and p_payload->>'parent_fingerprint'=encode(sha256(convert_to(input::text,'UTF8')),'hex'))
 and private.consultation_material_sources_valid(p_payload->'sources');
$$;
revoke all on function public.consultation_material_visible(uuid,jsonb,text,text,timestamptz) from public,anon,service_role;
grant execute on function public.consultation_material_visible(uuid,jsonb,text,text,timestamptz) to authenticated;
create policy consultation_material_admin_read on public.consultation_material_requests for select to authenticated
 using(public.consultation_material_visible(request_id,payload,consent_state,review_state,expires_at));
create policy consultation_material_event_admin_read on public.consultation_material_events for select to authenticated
 using(exists(select 1 from public.profiles where id=auth.uid() and role='admin'));

create function public.consultation_material_context(p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare parent public.consultation_requests;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'ADMIN_REQUIRED';end if;
 select * into parent from public.consultation_requests where id=p_request;
 if not found or parent.expires_at<=now() or parent.input->'consent' is distinct from 'true'::jsonb then raise exception 'CONSENT_REQUIRED';end if;
 return jsonb_build_object('input',parent.input,'expiresAt',parent.expires_at,'fingerprint',encode(sha256(convert_to(parent.input::text,'UTF8')),'hex'));
end $$;
revoke all on function public.consultation_material_context(uuid) from public,anon,service_role;
grant execute on function public.consultation_material_context(uuid) to authenticated;

create function public.consultation_material_save(p_request uuid,p_operation uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare parent public.consultation_requests; saved public.consultation_material_requests; key private.consultation_material_keys; fingerprint text; new_id uuid;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'ADMIN_REQUIRED';end if;
 if p_operation is null or jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>12000
 or (select count(*) from jsonb_object_keys(p_payload))<>9 or not p_payload ?& array['intent','channel','sources','input_binding','consent_version','material','schema_version','parent_fingerprint','context_expires_at']
 or coalesce(p_payload->>'schema_version','')<>'material-v1' or coalesce(p_payload->>'consent_version','')<>'consultation-v1'
 or coalesce(p_payload->>'channel','') not in('email','whatsapp') or coalesce(p_payload->>'material','')<>'approved_information'
 or jsonb_typeof(p_payload->'input_binding') is distinct from 'string' or jsonb_typeof(p_payload->'parent_fingerprint') is distinct from 'string'
 or jsonb_typeof(p_payload->'context_expires_at') is distinct from 'string'
 or coalesce(p_payload->>'input_binding','')!~'^[a-f0-9]{64}$'
 or coalesce(p_payload->>'intent','') not in('greeting','organization','services','service_description','pricing','promotions','hours','location','booking','booking_change','duration','preparation','care','skin','professional_review','payment','gift','personal_contact','follow_up','complaint_privacy') then raise exception 'MATERIAL_INVALID';end if;
 -- Parent lock serializes consent revocation/deletion and operations across workers.
 select * into parent from public.consultation_requests where id=p_request for update;
 if not found or parent.expires_at<=now() or parent.input->'consent' is distinct from 'true'::jsonb then raise exception 'CONSENT_REQUIRED';end if;
 if not isfinite((p_payload->>'context_expires_at')::timestamptz) or (p_payload->>'context_expires_at')::timestamptz<=now() then raise exception 'MATERIAL_INVALID';end if;
 if p_payload->>'parent_fingerprint' is distinct from encode(sha256(convert_to(parent.input::text,'UTF8')),'hex') or not private.consultation_material_sources_valid(p_payload->'sources') then raise exception 'MATERIAL_INVALID';end if;
 fingerprint:=encode(sha256(convert_to(p_payload::text,'UTF8')),'hex');
 select * into key from private.consultation_material_keys where request_id=p_request and operation_id=p_operation;
 if found then
  if key.fingerprint<>fingerprint then raise exception 'MATERIAL_CONFLICT';end if;
  select * into saved from public.consultation_material_requests where id=key.record_id;
  if not found or saved.expires_at<=now() or saved.consent_state<>'granted' or saved.review_state='revoked' then raise exception 'MATERIAL_EXPIRED_OR_REVOKED';end if;
  return jsonb_build_object('id',saved.id,'state',saved.review_state,'delivery_decision','no_send');
 end if;
 new_id:=gen_random_uuid();
 insert into private.consultation_material_keys(request_id,operation_id,record_id,fingerprint) values(p_request,p_operation,new_id,fingerprint);
 insert into public.consultation_material_requests(id,request_id,operation_id,payload,created_by,updated_by,expires_at)
 values(new_id,p_request,p_operation,p_payload,auth.uid(),auth.uid(),least(parent.expires_at,now()+interval '7 days',(p_payload->>'context_expires_at')::timestamptz));
 insert into public.consultation_material_events(material_id,actor_id,event) values(new_id,auth.uid(),'created');
 return jsonb_build_object('id',new_id,'state','pending','delivery_decision','no_send');
end $$;

create function public.consultation_material_review(p_id uuid,p_state text) returns boolean
language plpgsql security definer set search_path='' as $$
declare saved public.consultation_material_requests;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'ADMIN_REQUIRED';end if;
 if p_state not in('reviewed','rejected','revoked') or p_state is null then raise exception 'MATERIAL_STATE_INVALID';end if;
 select * into saved from public.consultation_material_requests where id=p_id for update;
 if not found then return false;end if;
 if saved.review_state=p_state then return p_state='revoked' or public.consultation_material_visible(saved.request_id,saved.payload,saved.consent_state,saved.review_state,saved.expires_at);end if;
 if saved.review_state='revoked' or p_state<>'revoked' and not public.consultation_material_visible(saved.request_id,saved.payload,saved.consent_state,saved.review_state,saved.expires_at) then return false;end if;
 update public.consultation_material_requests set review_state=p_state,updated_at=now(),updated_by=auth.uid(),
 consent_state=case when p_state='revoked' then 'revoked' else consent_state end,
 payload=case when p_state='revoked' then '{}'::jsonb else payload end where id=p_id;
 if p_state='revoked' then update private.consultation_material_keys set retired_at=coalesce(retired_at,now()) where record_id=p_id;end if;
 insert into public.consultation_material_events(material_id,actor_id,event) values(p_id,auth.uid(),p_state);
 return true;
end $$;

create function public.consultation_material_purge() returns integer
language plpgsql security definer set search_path='' as $$
declare erased integer;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'ADMIN_REQUIRED';end if;
 with removed as (delete from public.consultation_material_requests m where m.expires_at<=now() or m.consent_state='revoked'
 or not private.consultation_material_sources_valid(m.payload->'sources')
 or exists(select 1 from public.consultation_requests r where r.id=m.request_id and (r.expires_at<=now() or r.input->'consent' is distinct from 'true'::jsonb or m.payload->>'parent_fingerprint' is distinct from encode(sha256(convert_to(r.input::text,'UTF8')),'hex'))) returning m.id),
 marked as(update private.consultation_material_keys set retired_at=coalesce(retired_at,now()) where record_id in(select id from removed) returning record_id)
 select count(*) into erased from removed;
 -- Minimal operation tombstones remain only until parent retention; no content/recipient.
 return erased;
end $$;
revoke all on function public.consultation_material_save(uuid,uuid,jsonb),public.consultation_material_review(uuid,text),public.consultation_material_purge() from public,anon,service_role;
grant execute on function public.consultation_material_save(uuid,uuid,jsonb),public.consultation_material_review(uuid,text),public.consultation_material_purge() to authenticated;
commit;
