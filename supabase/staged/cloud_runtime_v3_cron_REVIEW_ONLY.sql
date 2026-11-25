-- Explicitly approved hosted step only. Never run through migration discovery.
-- This prepares ONE INACTIVE job. It does not install extensions or store secrets.
-- Requires installed pg_cron, pg_net, Vault and independently provisioned secrets:
-- cloud-v3-trigger-url: exact isolated /functions/v1/autopilot-director-wake/run URL
-- cloud-v3-trigger-token: dedicated high-entropy trigger token, NOT an API/service key.
begin;
do $$ begin
 if coalesce(current_setting('autopilot.cloud_activation_sha',true),'') !~ '^[0-9a-f]{40}$' then
  raise exception 'explicit_reviewed_sha_required';
 end if;
 if not exists(select 1 from pg_extension where extname='pg_cron')
  or not exists(select 1 from pg_extension where extname='pg_net') then raise exception 'approved_extensions_required';end if;
 if (select count(*) from vault.decrypted_secrets where name in ('cloud-v3-trigger-url','cloud-v3-trigger-token'))<>2 then raise exception 'isolated_vault_configuration_required';end if;
 if exists(select 1 from cron.job where jobname in ('autopilot-cloud-v3','autopilot-director-wake-preflight')) then raise exception 'existing_scheduler_requires_reconciliation';end if;
end $$;
select cron.schedule('autopilot-cloud-v3','*/30 * * * *',$job$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='cloud-v3-trigger-url'),
  headers:=jsonb_build_object('Content-Type','application/json','x-autopilot-cloud-token',
   (select decrypted_secret from vault.decrypted_secrets where name='cloud-v3-trigger-token')),
  body:='{}'::jsonb,timeout_milliseconds:=120000);
$job$);
select cron.alter_job(job_id:=jobid,active:=false) from cron.job where jobname='autopilot-cloud-v3';
commit;
-- Activating this job is a DIFFERENT, separately approved operation after
-- disabling and draining the GitHub runtime workflows and setting the policy.
