import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Fixed source list only; never accepts SQL, credentials or paths from a mission.
export async function hostedLedgerSql(binding, projectRef) {
  if (!/^[a-f0-9]{64}$/.test(binding) || projectRef !== 'juyowvmtluxfetgkckjd') throw Error('invalid_provision_target');
  const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  const files = ['supabase/migrations/20260912033258_autopilot_core_v4.sql',
    'supabase/staged/six_agent_queue_20261025.sql','supabase/staged/six_agent_mission_checkpoint_20261109.sql',
    'supabase/staged/six_agent_mission_planning_20261109.sql','supabase/staged/six_agent_local_operator_20261109.sql'];
  const sources = await Promise.all(files.map(read));
  const grants = await read('supabase/staged/cloud_synthetic_ledger_20261112.sql');
  if ((grants.match(/^begin;\r?$/gm)||[]).length !== 1 || (grants.match(/^commit;\r?$/gm)||[]).length !== 1) throw Error('unexpected_grants_transaction');
  const template = await read('supabase/staged/hosted_synthetic_ledger_p0c.sql');
  return `set autopilot.provision_project='${projectRef}';\nset autopilot.provision_binding='${binding}';\n`
    + template.replace('-- LEDGER_SOURCES',()=>sources.join('\n')).replace('-- CLOUD_GRANTS',()=>grants.replace(/^begin;\r?$/gm,'').replace(/^commit;\r?$/gm,''));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [binding, projectRef, output, ...extra] = process.argv.slice(2);
    if (!output || extra.length) throw Error('invalid_arguments');
    await writeFile(output,await hostedLedgerSql(binding,projectRef),{flag:'wx',mode:0o600});
    console.log('hosted_provision_sql_prepared_offline');
  } catch { console.error('hosted_provision_preparation_failed'); process.exitCode=2; }
}
