-- Only after explicit approval and retention/export review. Removes this cycle's data.
begin;
drop function public.consultation_material_context(uuid);
drop function public.consultation_material_save(uuid,uuid,jsonb);
drop function public.consultation_material_review(uuid,text);
drop function public.consultation_material_purge();
drop table public.consultation_material_events;
drop table public.consultation_material_requests;
drop function public.consultation_material_visible(uuid,jsonb,text,text,timestamptz);
drop function private.consultation_material_sources_valid(jsonb);
drop table private.consultation_material_keys;
commit;
