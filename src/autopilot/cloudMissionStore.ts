import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { LocalMissionStore } from './localMissionStore';
import { validateLocalConfig, type LocalMissionConfig } from './localMissionConfig';
import { ManagedProcesses } from './managedProcesses';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface CloudMissionConfig extends Omit<LocalMissionConfig, 'mode' | 'database'> {
  mode: 'cloud_synthetic_lab';
  ledgerId: string;
  database: { host: string; port: number; name: 'victoriosa_mission_operator_lab' | 'victoriosa_director_supervision_lab' | 'postgres'; user: 'autopilot_cloud_runner';
    sslRootCert: string; passFile: string; connectionMode?: 'direct' | 'supabase-session' };
}
const exact = (v: unknown, keys: string[]) => !!v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).sort().join(',') === [...keys].sort().join(',');
export function localCloudResources(c: CloudMissionConfig): LocalMissionConfig {
  return { version:c.version, mode:'local_synthetic_lab', database:{host:'127.0.0.1',port:c.database.port,
    name:'victoriosa_mission_operator_lab',user:c.database.user},resources:c.resources,permissions:c.permissions,
    leaseSeconds:c.leaseSeconds,deadlineMs:c.deadlineMs,queryTimeoutMs:c.queryTimeoutMs };
}
export function validateCloudConfig(value: unknown): CloudMissionConfig {
  const c = value as CloudMissionConfig;
  if (!exact(c,['version','mode','ledgerId','database','resources','permissions','leaseSeconds','deadlineMs','queryTimeoutMs'])
    || c.mode !== 'cloud_synthetic_lab' || !/^synthetic-[a-z0-9-]{8,64}$/.test(c.ledgerId)
    || !exact(c.database,['host','port','name','user','sslRootCert','passFile',
      ...(c.database?.connectionMode === undefined ? [] : ['connectionMode'])])
    || (c.database.connectionMode !== undefined && !['direct','supabase-session'].includes(c.database.connectionMode))
    || typeof c.database.host !== 'string' || !/^[a-z0-9][a-z0-9.-]{0,252}$/.test(c.database.host)
    || c.database.host.includes('..') || c.database.user !== 'autopilot_cloud_runner'
    || c.database.host.includes('jfjzpwlrhzqbcrvqxhzf')
    || (c.database.name !== 'victoriosa_mission_operator_lab' && c.database.name !== 'victoriosa_director_supervision_lab' && !(c.database.name === 'postgres'
      && c.database.host === (c.database.connectionMode === 'supabase-session'
        ? 'aws-0-ca-central-1.pooler.supabase.com' : 'db.juyowvmtluxfetgkckjd.supabase.co') && c.database.port === 5432))
    || (c.database.connectionMode === 'supabase-session' && c.database.name !== 'postgres')
    || ((c.database.name === 'victoriosa_mission_operator_lab' || c.database.name === 'victoriosa_director_supervision_lab')
      && (c.database.host !== '127.0.0.1' || /supabase\.(co|com)$/.test(c.database.host)))
    || typeof c.database.sslRootCert !== 'string' || !path.isAbsolute(c.database.sslRootCert)
    || typeof c.database.passFile !== 'string' || !path.isAbsolute(c.database.passFile)
    || !c.permissions || c.permissions.admit !== false) throw Error('cloud_ledger_adapter_not_configured');
  validateLocalConfig(localCloudResources(c));
  return c;
}
export function cloudConnectionUser(c: CloudMissionConfig): string {
  validateCloudConfig(c);
  return c.database.connectionMode === 'supabase-session'
    ? 'autopilot_cloud_runner.juyowvmtluxfetgkckjd' : c.database.user;
}
export function cloudBinding(c: CloudMissionConfig): string {
  // Runner paths, DNS aliases and rotating credentials are not ledger identity.
  return createHash('sha256').update(JSON.stringify({ledgerId:c.ledgerId,baseSha:c.resources.baseSha,
    domain:'synthetic.ensure_verified_artifact',version:1})).digest('hex');
}
export function cloudProcessEnvironment(c: CloudMissionConfig): NodeJS.ProcessEnv {
  return { ...Object.fromEntries(['PATH','Path','SystemRoot','WINDIR','TEMP','TMP'].flatMap(k => process.env[k] ? [[k,process.env[k]!]] : [])),
    PGSSLMODE:'verify-full', PGSSLROOTCERT:c.database.sslRootCert, PGPASSFILE:c.database.passFile,
    PGSSLCERTMODE:'disable', PGGSSENCMODE:'disable', PGCONNECT_TIMEOUT:'5', PGCLIENTENCODING:'UTF8' };
}
export async function readMissionHost(file: string) {
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size>16384) throw Error('invalid_config_file');
  const raw = JSON.parse(await readFile(file,'utf8'));
  if (raw?.mode !== 'cloud_synthetic_lab') {
    const { readLocalConfig } = await import('./localMissionConfig');
    const config = await readLocalConfig(file);
    return {config, store:(p:ManagedProcesses,s?:AbortSignal,r?:(e:Record<string,unknown>)=>void)=>new LocalMissionStore(config,p,s,r)};
  }
  const cloud = validateCloudConfig(raw);
  for (const directory of [cloud.resources.repository,cloud.resources.worktreeRoot]) {
    const entry=await lstat(directory);
    if (!entry.isDirectory() || entry.isSymbolicLink() || await realpath(directory)!==path.resolve(directory)) throw Error('unsafe_host_resource');
  }
  return { config:localCloudResources(cloud), store:(p:ManagedProcesses,s?:AbortSignal,r?:(e:Record<string,unknown>)=>void)=>new CloudMissionStore(cloud,p,s,r) };
}
/** A transport adapter only: all admission/claim/checkpoint/fencing semantics remain in the existing SQL ledger. */
export class CloudMissionStore extends LocalMissionStore {
  private readonly cloud: CloudMissionConfig;
  constructor(c:CloudMissionConfig,p:ManagedProcesses,s?:AbortSignal,r?:(e:Record<string,unknown>)=>void) {
    const copy=structuredClone(validateCloudConfig(c));
    super(localCloudResources(copy),p,s,r); this.cloud=copy;
  }
  override get binding() { return cloudBinding(this.cloud); }
  protected override get databaseName() { return this.cloud.database.name; }
  override async initialize(): Promise<void> { throw Error('cloud_provisioning_not_allowed'); }
  override async admit(_value:unknown): Promise<string> { throw Error('cloud_admission_not_allowed'); }
  get reviewedBaseSha(): string { return this.cloud.resources.baseSha; }
  get hostIdentity(): string { return this.cloud.database.user; }

  /** RPC facade for the one staged Director lane; generic claims stay unavailable. */
  directorClient(grant: {missionId:string;binding:string;reviewedSha:string;slot:string;authorizationId:string}): SupabaseClient {
    const store=this;
    const invoke=async(name:string,args:Record<string,unknown>)=>{
      try {
        let procedure:string;let values:unknown[];
        const auth=[grant.missionId,grant.binding,grant.reviewedSha,grant.slot];
        if(name==='six_agent_claim_mission') {
          if(args.p_agent!=='director' || !Number.isInteger(args.p_lease_seconds)
            || Number(args.p_lease_seconds)<5 || Number(args.p_lease_seconds)>30) throw Error('director_scope_denied');
          procedure='six_agent_director_claim';values=[...auth,grant.authorizationId,args.p_lease_seconds];
        } else if(name==='six_agent_checkpoint') {
          if(args.p_task_id!==grant.missionId || args.p_mission_id!==grant.missionId
            || args.p_executor_id!=='director-cloud-synthetic') throw Error('director_scope_denied');
          procedure='six_agent_director_checkpoint';values=[args.p_task_id,args.p_mission_id,args.p_token,args.p_checkpoint_version,
            args.p_operation_id,args.p_executor_id,args.p_checkpoint,...auth.slice(1),grant.authorizationId];
        } else if(name==='six_agent_complete') {
          if(args.p_task_id!==grant.missionId)throw Error('director_scope_denied');
          procedure='six_agent_director_complete';values=[args.p_task_id,args.p_token,
            `director_verified:${grant.reviewedSha}:${grant.slot}`,...auth.slice(1),grant.authorizationId];
        } else if(name==='six_agent_fail') {
          if(args.p_task_id!==grant.missionId)throw Error('director_scope_denied');
          procedure='six_agent_director_fail';values=[args.p_task_id,args.p_token,args.p_reason,...auth.slice(1),grant.authorizationId];
        } else throw Error('director_rpc_denied');
        const result=await store.callDirectorSql(procedure,values);
        return {data:JSON.parse(result),error:null};
      } catch(error) {
        const message=error instanceof Error?error.message:'';
        return {data:null,error:{message:/^process_failed_[a-z0-9_]+$/.test(message)?message:'director_rpc_denied'}};
      }
    };
    return {rpc:invoke} as unknown as SupabaseClient;
  }

  /** Only fixed procedures are callable; no SQL or arbitrary RPC is accepted from a task. */
  async callDirectorSql(procedure:string,values:unknown[]):Promise<string> {
    if(this.cloud.permissions.execute!==true||this.cloud.permissions.admit!==false||this.cloud.permissions.cancel!==false)
      throw Error('cloud_director_execution_disabled');
    const definitions:Record<string,{arity:number;casts:Record<number,string>;mode:'rows'|'json'}>={
      six_agent_director_claim:{arity:6,casts:{5:'integer'},mode:'rows'},
      six_agent_director_checkpoint:{arity:11,casts:{2:'uuid',3:'integer',6:'jsonb'},mode:'json'},
      six_agent_director_complete:{arity:7,casts:{1:'uuid'},mode:'json'},
      six_agent_director_fail:{arity:7,casts:{1:'uuid'},mode:'json'},
      director_observe_synthetic_agents:{arity:5,casts:{},mode:'json'},
      director_read_mission:{arity:5,casts:{},mode:'json'},
    };
    const definition=definitions[procedure];
    if(!definition || values.length!==definition.arity)throw Error('director_rpc_denied');
    const sqlLiteral=(value:unknown)=>`'${(value===null?'null':typeof value==='object'?JSON.stringify(value):String(value)).replaceAll("'","''")}'`;
    const args=values.map((value,index)=>`${sqlLiteral(value)}${definition.casts[index]?`::${definition.casts[index]}`:''}`).join(',');
    const expression=definition.mode==='rows'
      ? `coalesce((select json_agg(r) from public.${procedure}(${args}) r),'[]'::json)`
      : `to_json(public.${procedure}(${args}))`;
    return await this.execute(`select ${expression};`,'director_'+procedure);
  }
  protected override async execute(query:string,operation:string): Promise<string> {
    const c=this.cloud;
    for (const file of [c.database.passFile,c.database.sslRootCert]) {
      const entry=await lstat(file);
      if (!entry.isFile() || entry.isSymbolicLink() || entry.size===0 || entry.size>65536
        || await realpath(file)!==path.resolve(file)
        || (file===c.database.passFile && process.platform!=='win32' && (entry.mode & 0o077)!==0)) throw Error('unsafe_cloud_config_file');
    }
    const prelude=`set statement_timeout=${c.queryTimeoutMs};set lock_timeout=${c.queryTimeoutMs};
      set idle_in_transaction_session_timeout=${c.queryTimeoutMs};set request.jwt.claim.role='service_role';
      do $cloud$ begin if session_user<>'autopilot_cloud_runner'
        ${c.database.name === 'postgres' ? "or not exists(select 1 from public.autopilot_hosted_lab where project_ref='juyowvmtluxfetgkckjd')" : ''}
        or exists(select 1 from pg_roles where rolname=session_user and (rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls))
        or exists(select 1 from pg_auth_members where member=(select oid from pg_roles where rolname=session_user))
        or not exists(select 1 from pg_stat_ssl where pid=pg_backend_pid() and ssl)
        then raise exception 'unauthorized_cloud_session';end if;end $cloud$;`;
    const result=await this.processes.exec(process.env.PSQL_PATH||'psql',
      ['-h',c.database.host,'-p',String(c.database.port),'-U',cloudConnectionUser(c),'-d',c.database.name,'-w','-X','-qAt','-v','ON_ERROR_STOP=1'],
      {env:cloudProcessEnvironment(c),timeout:c.queryTimeoutMs+7000,signal:this.signal,input:`${prelude}\n${query}`,operation});
    return result.stdout.trim();
  }
}
