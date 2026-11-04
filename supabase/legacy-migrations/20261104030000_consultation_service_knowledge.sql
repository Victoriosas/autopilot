begin;
-- Reconcile names only. Descriptions, fees, duration and approvals stay empty.
insert into public.beauty_services(id,request_service,category,title) values
('higiene-y-limpieza-facial','facial','faciales','Higiene y limpieza facial'),
('limpieza-profunda','facial','faciales','Limpieza profunda'),
('tratamiento-para-manchas','facial','faciales','Tratamiento para manchas'),
('acne','facial','faciales','Acné'),
('rejuvenecimiento','facial','faciales','Rejuvenecimiento'),
('hidratacion-y-nutricion-profunda','facial','faciales','Hidratación y nutrición profunda'),
('efecto-lifting','facial','faciales','Efecto lifting'),
('peeling','facial','faciales','Peeling'),
('hidratacion-de-labios','facial','faciales','Hidratación de labios'),
('contorno-de-ojos','facial','faciales','Contorno de ojos'),
('lineas-de-expresion','facial','faciales','Líneas de expresión'),
('exfoliacion-e-hidratacion','consultation','corporales','Exfoliación e hidratación'),
('masaje-modelador','consultation','corporales','Masaje modelador'),
('masaje-de-drenaje-linfatico','consultation','corporales','Masaje de drenaje linfático'),
('masaje-descontracturante','consultation','corporales','Masaje descontracturante'),
('masaje-relax','consultation','corporales','Masaje relax'),
('reduccion-de-estrias','consultation','corporales','Reducción de estrías')
on conflict(id) do nothing;
-- An internal extension of beauty_services, never a public price catalog.
create table private.consultation_service_knowledge (
 slug text not null references public.beauty_services(id),
 version integer not null check(version > 0),
 entry jsonb not null check(jsonb_typeof(entry)='object'),
 reviewed_by uuid references public.profiles(id) on delete set null,
 reviewed_at timestamptz not null default now(),
 primary key(slug,version)
);
revoke all on private.consultation_service_knowledge from public,anon,authenticated,service_role;

create function public.consultation_knowledge_list() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'ADMIN_REQUIRED';end if;
 return coalesce((select jsonb_agg(entry) from (select distinct on(slug) entry from private.consultation_service_knowledge order by slug,version desc) latest),'[]'::jsonb);
end $$;

create function public.consultation_knowledge_save(p_entry jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare current_version integer; expected integer; service_id text; key text;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'ADMIN_REQUIRED';end if;
 if jsonb_typeof(p_entry)<>'object' or (select count(*) from jsonb_object_keys(p_entry))<>11
 or not p_entry ?& array['slug','version','description','techniques','duration','conditions','faq','internalFee','approvedForAI','priceApproved','validUntil'] then raise exception 'KNOWLEDGE_INVALID';end if;
 if jsonb_typeof(p_entry->'slug')<>'string' or (p_entry->>'slug')!~'^[a-z][a-z0-9-]{1,63}$'
 or jsonb_typeof(p_entry->'version')<>'number' or (p_entry->>'version')!~'^[0-9]+$'
 or jsonb_typeof(p_entry->'approvedForAI')<>'boolean' or jsonb_typeof(p_entry->'priceApproved')<>'boolean' then raise exception 'KNOWLEDGE_INVALID';end if;
 foreach key in array array['description','techniques','duration','conditions','faq','internalFee'] loop
  if jsonb_typeof(p_entry->key)<>'string' or char_length(p_entry->>key)>2000 or (p_entry->>key)~'[<>]' then raise exception 'KNOWLEDGE_INVALID';end if;
 end loop;
 if (p_entry->>'approvedForAI')::boolean and btrim(p_entry->>'description')='' or (p_entry->>'priceApproved')::boolean and btrim(p_entry->>'internalFee')='' then raise exception 'KNOWLEDGE_INCOMPLETE';end if;
 if p_entry->'validUntil'<>'null'::jsonb and (jsonb_typeof(p_entry->'validUntil')<>'string' or (p_entry->>'validUntil')::timestamptz<=now()) then raise exception 'KNOWLEDGE_EXPIRED';end if;
 service_id:=p_entry->>'slug';expected:=(p_entry->>'version')::integer;
 -- Locks an existing service, including the first knowledge revision.
 perform 1 from public.beauty_services where id=service_id for update;
 if not found then raise exception 'KNOWLEDGE_SERVICE_UNKNOWN';end if;
 select coalesce(max(version),0) into current_version from private.consultation_service_knowledge where slug=service_id;
 if current_version<>expected then return false;end if;
 insert into private.consultation_service_knowledge(slug,version,entry,reviewed_by)
 values(service_id,expected+1,jsonb_set(p_entry,'{version}',to_jsonb(expected+1)),auth.uid());
 return true;
end $$;

create function public.consultation_knowledge_facts() returns jsonb
language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
 'id','service:'||slug,'version',version::text,'source','Supabase beauty_services/'||slug||'/knowledge/'||version,
 'fragment',entry->>'description','approval','approved','owner','Victoria',
 'reviewedAt',reviewed_at,'validUntil',entry->'validUntil','scope','general_information','topic','service','service',slug,'authority',2
 )),'[]'::jsonb)
 from (select distinct on(slug) * from private.consultation_service_knowledge order by slug,version desc) latest
 where (entry->>'approvedForAI')::boolean and btrim(entry->>'description')<>''
 and (entry->'validUntil'='null'::jsonb or (entry->>'validUntil')::timestamptz>now())
 -- Fees are NEVER emitted, including explicitly approved internal fees.
 and (entry->>'description')!~*'(\$|[0-9].*(UYU|USD|pesos)|garantiz|garantiza|sin riesgos|te recomiendo|diagn[oó]stico)';
$$;
revoke all on function public.consultation_knowledge_list() from public,anon,service_role;
revoke all on function public.consultation_knowledge_save(jsonb) from public,anon,service_role;
revoke all on function public.consultation_knowledge_facts() from public,anon,authenticated;
grant execute on function public.consultation_knowledge_list(),public.consultation_knowledge_save(jsonb) to authenticated;
grant execute on function public.consultation_knowledge_facts() to service_role;
commit;
