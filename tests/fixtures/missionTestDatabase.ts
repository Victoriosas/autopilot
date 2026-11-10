import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import type { SupabaseClient } from '@supabase/supabase-js';

export const sqlLiteral = (value: unknown) => `'${(typeof value === 'object' ? JSON.stringify(value) : String(value)).replaceAll("'", "''")}'`;
/** Only test databases on loopback. No SDK connection, hosted fallback or production credential lookup. */
export function missionTestDatabase(database: string | undefined, name: string) {
  if (database) {
    const target = new URL(database);
    assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname));
    assert.equal(target.pathname, `/${name}`); assert.equal(target.search, '');
  }
  const sql = (query: string): Promise<string> => new Promise((resolve, reject) => {
    assert.ok(database);
    const child = execFile(process.env.PSQL_PATH || 'psql', [database, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'],
      { windowsHide: true, timeout: 15000 }, (error, out) => error ? reject(Error('synthetic_sql_failed')) : resolve(out.trim()));
    child.stdin!.end(`set request.jwt.claim.role='service_role';\n${query}`);
  });
  const parameters: Record<string, string[]> = {
    six_agent_claim: ['p_agent', 'p_lease_seconds'],
    six_agent_claim_mission: ['p_agent', 'p_lease_seconds'],
    six_agent_checkpoint: ['p_task_id', 'p_mission_id', 'p_token', 'p_checkpoint_version', 'p_operation_id', 'p_executor_id', 'p_checkpoint'],
    six_agent_complete: ['p_task_id', 'p_token', 'p_evidence'], six_agent_fail: ['p_task_id', 'p_token', 'p_reason'],
    six_agent_save_plan: ['p_task_id', 'p_token', 'p_checkpoint_version', 'p_operation_id', 'p_planner_id', 'p_proposal'],
    six_agent_block_mission: ['p_task_id', 'p_token', 'p_checkpoint_version', 'p_reason'],
  };
  const client = { async rpc(rpc: string, args: Record<string, unknown>) {
    assert.ok(Object.hasOwn(parameters, rpc));
    const values = parameters[rpc].map(key => sqlLiteral(args[key]) + (['p_checkpoint', 'p_proposal'].includes(key) ? '::jsonb' : '')).join(',');
    try {
      const query = ['six_agent_claim', 'six_agent_claim_mission'].includes(rpc)
        ? `select coalesce(json_agg(c),'[]'::json) from public.${rpc}(${values}) c;`
        : `select to_json(public.${rpc}(${values}));`;
      return { data: JSON.parse(await sql(query)), error: null };
    } catch { return { data: null, error: { message: 'synthetic_rpc_failed' } }; }
  } } as unknown as SupabaseClient;
  return { sql, client };
}
