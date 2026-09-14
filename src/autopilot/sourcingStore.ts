import { createClient } from '@supabase/supabase-js';
import type { SourcingConfig, Evidence } from './sourcingEvidence';
import type { CouncilResult } from './approvalCouncil';
export interface Run { id:string; status:string; mode:'shadow'|'production'; config:SourcingConfig; discovery_done:boolean; lease_owner:string; lease_generation:number; attempt:number; }
export interface Item { id:string; identity:string; status:string; payload:Evidence; checkpoint:Record<string,any>; draft_id?:string; council?:CouncilResult; attempt:number; next_retry_at?:string; }
export interface SourcingStore { command<T=any>(command:string,args:Record<string,unknown>):Promise<T>; }
export function createSourcingStore(): SourcingStore {
  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SOURCING_DATABASE_NOT_CONFIGURED');
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(10000)})}});
  return {async command(command,args){const {data,error}=await db.rpc('autopilot_sourcing_command',{command,args});
    if(error) throw new Error(error.message.includes('FENCE_REJECTED')?'FENCE_REJECTED':'SOURCING_DATABASE_ERROR'); return data;}};
}
