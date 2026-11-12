begin;
drop function public.consultation_material_admin_snapshot(uuid);
drop function public.consultation_material_admin_review(uuid,uuid,text,text);
drop function public.consultation_material_admin_purge(uuid);
commit;
