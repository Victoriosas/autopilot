import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

export function redact(s) {
  return String(s).replace(/(?:gsk_|gh[opusr]_|csk-|re_|sk-or-v1-)[A-Za-z0-9_-]{16,}/g, '[REDACTED]')
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]');
}
function envForProject() {
  const env = { ...process.env };
  const root = process.env.OPENCODE_CREDENTIAL_ROOT || process.env.OPENCODE_PROJECT_ROOT;
  // Trusted service code may use credentials; the model never receives their values.
  if (root) {
    const filename = path.join(root, '.env.local');
    if (fs.existsSync(filename)) {
      for (const line of fs.readFileSync(filename, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
        if (m && /^(?:VITE_SUPABASE_URL|SUPABASE_URL|VITE_SUPABASE_ANON_KEY|SUPABASE_ANON_KEY|RESEND_API_KEY|CAMELAI_API_KEY)$/.test(m[1]) && !env[m[1]]) {
          env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
        }
      }
    }
  }
  return env;
}
function run(file, args, env) {
  return new Promise((resolve, reject) => execFile(file, args, {
    cwd: process.env.OPENCODE_PROJECT_ROOT || process.cwd(), env,
    windowsHide: true, timeout: 20000, maxBuffer: 200000,
  }, (error, stdout, stderr) => {
    const result = redact((stdout || '') + (stderr || '')).slice(0, 18000);
    if (error) reject(new Error(result || `Command failed: ${error.code}`));
    else resolve(result);
  }));
}
async function request(url, headers) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false, httpStatus: response.status, error: 'Service rejected request; verify access locally' };
  return { ok: true, httpStatus: response.status, data: body };
}
export function githubArgs(action, repo, number) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new Error('Invalid owner/repo');
  if (action === 'repository') return ['repo', 'view', repo, '--json', 'nameWithOwner,defaultBranchRef,url,isPrivate'];
  if (action === 'pulls') return ['pr', 'list', '--repo', repo, '--limit', '10', '--json', 'number,title,state,isDraft,headRefName,url'];
  if (action === 'issues') return ['issue', 'list', '--repo', repo, '--limit', '10', '--json', 'number,title,state,url'];
  if (action === 'runs') return ['run', 'list', '--repo', repo, '--limit', '5', '--json', 'databaseId,status,conclusion,headSha,url'];
  if (action === 'checks' && Number.isInteger(number) && number > 0) return ['pr', 'checks', String(number), '--repo', repo, '--json', 'name,state,link'];
  throw new Error('Unsupported read action');
}
export async function inspect(args) {
  const env = envForProject();
  if (args.target === 'status') {
    const gateway = await fetch('http://127.0.0.1:3001/health', {signal:AbortSignal.timeout(3000)}).then(r=>r.ok).catch(()=>false);
    return { gatewayReachable: gateway, githubVia: 'existing gh keyring; use github/repository to verify',
      vercelVia: 'existing CLI account; use vercel/identity to verify',
      supabaseConfigured: !!((env.SUPABASE_URL || env.VITE_SUPABASE_URL) && (env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY)),
      resendConfigured: !!env.RESEND_API_KEY, camelRunConfigured: !!env.CAMELAI_API_KEY,
      note: 'Configured does not mean authenticated. ChatGPT connector sessions are not exported.' };
  }
  if (args.target === 'github') return run('gh', githubArgs(args.action, args.repo || 'Victoriosas/autopilot', args.number), env);
  if (args.target === 'vercel') {
    const cli = path.join(env.APPDATA || path.join(os.homedir(),'AppData/Roaming'), 'npm/node_modules/vercel/dist/index.js');
    const argv = args.action === 'identity' ? ['whoami'] : args.action === 'deployments' ? ['ls'] : null;
    if (!argv) throw new Error('Only identity/deployments read actions are enabled');
    return run(process.execPath, [cli, ...argv], env);
  }
  if (args.target === 'supabase' && args.action === 'health') {
    const url = new URL(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '');
    if (!url.hostname.endsWith('.supabase.co') || url.protocol !== 'https:') throw new Error('Expected configured official Supabase project');
    const key = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
    if (!key) throw new Error('No local public Supabase client credential configured');
    return request(new URL('/auth/v1/health',url), {apikey:key});
  }
  if (args.target === 'resend' && args.action === 'domains') {
    if (!env.RESEND_API_KEY) throw new Error('Resend API key not configured locally');
    const r = await request('https://api.resend.com/domains', {Authorization:'Bearer '+env.RESEND_API_KEY});
    if (!r.ok) return r;
    return {ok:true, domains:r.data.data?.map(x=>({name:x.name,status:x.status,region:x.region}))};
  }
  throw new Error('Unsupported operation. No mutations, email sending or SQL execution are exposed.');
}
const tool = {
  name: 'inspect', description: 'Read-only connection status, GitHub repository/PR/issues/CI, Vercel identity/deployments, Supabase health, or Resend domains. Never returns credentials.',
  inputSchema: {type:'object',properties:{target:{type:'string',enum:['status','github','vercel','supabase','resend']},action:{type:'string',enum:['repository','pulls','issues','runs','checks','identity','deployments','health','domains']},repo:{type:'string'},number:{type:'integer',minimum:1}},required:['target'],additionalProperties:false},
};
export async function dispatch(message) {
  const {id,method,params} = message;
  if (method === 'initialize') return {protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'autopilot-read-ops',version:'1.0.0'}};
  if (method === 'tools/list') return {tools:[tool]};
  if (method === 'ping') return {};
  if (method === 'tools/call') {
    if (params?.name !== 'inspect') throw new Error('Unknown tool');
    try {const result=await inspect(params.arguments||{});return {content:[{type:'text',text:redact(typeof result==='string'?result:JSON.stringify(result))}]};}
    catch(e){return {isError:true,content:[{type:'text',text:redact(e.message)}]};}
  }
  if (id !== undefined) throw new Error('Unknown method');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rl = readline.createInterface({input:process.stdin,crlfDelay:Infinity});
  for await (const line of rl) {
    let m;
    try {m=JSON.parse(line);if(m.id===undefined)continue;const result=await dispatch(m);process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result})+'\n');}
    catch(e){process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m?.id??null,error:{code:-32603,message:redact(e.message)}})+'\n');}
  }
}
