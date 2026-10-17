import { Router, json, type RequestHandler } from 'express';
import { createHash } from 'node:crypto';
import { beautyCallerDatabase, beautyServerDatabase } from './beautyDatabase';
import { createBeautyManagementRouter } from './beautyManagementRouter';
import { requireSupabaseAdminAuth } from '../security/adminAuth';
import { BEAUTY_UUID, BEAUTY_STATUSES, beautyTransition, beautyWhatsAppUrl, normalizeBeautyRequest, type BeautyInput, type BeautyStatus } from './beautyRequests';

export type BeautyRecord = {id:string;fingerprint?:string;catalog_service_id?:string;catalog_version?:number;catalog_snapshot?:unknown;first_name:string;last_name:string;contact:string;zone:string;service:string;availability:string;source:string;status:BeautyStatus;created_at?:string;expires_at?:string};
export interface BeautyStore {
  create(input:BeautyInput):Promise<{id:string;status:BeautyStatus}>;
  list(token:string,offset:number):Promise<BeautyRecord[]>;
  update(token:string,id:string,from:BeautyStatus,to:BeautyStatus,actor:string):Promise<boolean>;
}
export const beautySupabaseStore:BeautyStore={
  async create(input){
    const db=beautyServerDatabase();
    const {id,consent,...fields}=input;
    const fingerprint=createHash('sha256').update(JSON.stringify(fields)).digest('hex');
    const existing=await db.from('beauty_requests').select('id,status,fingerprint').eq('id',id).gt('expires_at',new Date().toISOString()).maybeSingle();
    if(existing.error)throw new Error('BEAUTY_UNAVAILABLE');
    if(existing.data){if(existing.data.fingerprint!==fingerprint)throw new Error('BEAUTY_IDEMPOTENCY_CONFLICT');return{id:existing.data.id,status:existing.data.status};}
    let catalog:Record<string,unknown>={};
    if(input.catalogServiceId){
      const selected=await db.from('beauty_services').select('id,version,request_service').eq('id',input.catalogServiceId).eq('publication_status','published').eq('available',true).eq('price_approved',true).single();
      if(selected.error||selected.data.request_service!==input.service)throw new Error('BEAUTY_UNAVAILABLE');
      catalog={catalog_service_id:selected.data.id,catalog_version:selected.data.version};
    }else if(process.env.BEAUTY_CATALOG_ENABLED==='true')throw new Error('BEAUTY_UNAVAILABLE');
    const row={id,fingerprint,first_name:input.firstName,last_name:input.lastName,contact:input.contact,zone:input.zone,service:input.service,availability:input.availability,source:input.source,consent_version:input.consentVersion};
    const write=await db.from('beauty_requests').upsert({...row,...catalog},{onConflict:'id',ignoreDuplicates:true});
    if(write.error) throw new Error('BEAUTY_UNAVAILABLE');
    const read=await db.from('beauty_requests').select('id,status,fingerprint').eq('id',id).gt('expires_at',new Date().toISOString()).single();
    if(read.error) throw new Error('BEAUTY_UNAVAILABLE');
    if(read.data.fingerprint!==fingerprint) throw new Error('BEAUTY_IDEMPOTENCY_CONFLICT');
    return {id:read.data.id,status:read.data.status};
  },
  async list(token,offset){
    const result=await beautyCallerDatabase(token).from('beauty_requests').select('id,first_name,last_name,contact,zone,service,catalog_service_id,catalog_version,catalog_snapshot,availability,source,status,created_at,expires_at').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).range(offset,offset+49);
    if(result.error) throw new Error('BEAUTY_UNAVAILABLE');
    return result.data as BeautyRecord[];
  },
  async update(token,id,from,to,actor){
    const result=await beautyCallerDatabase(token).from('beauty_requests').update({status:to,reviewed_by:actor,updated_at:new Date().toISOString()}).eq('id',id).eq('status',from).gt('expires_at',new Date().toISOString()).select('id');
    if(result.error) throw new Error('BEAUTY_UNAVAILABLE');
    return result.data.length===1;
  },
};
export function createBeautyRouter(deps:{store?:BeautyStore;auth?:RequestHandler;enabled?:()=>boolean}={}) {
  const router=Router();
  const store=deps.store || beautySupabaseStore;
  const enabled=deps.enabled || (()=>process.env.BEAUTY_REQUESTS_ENABLED==='true');
  router.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
  router.use(createBeautyManagementRouter());
  router.get('/config',(_req,res)=>res.json({requestsEnabled:enabled(),privacyVersion:'beauty-v1',retentionDays:90}));
  router.post('/requests',json({limit:'4kb'}),async(req,res)=>{
    if(!enabled()) return res.status(503).json({error:'BEAUTY_REQUESTS_DISABLED'});
    const expected=process.env.PUBLIC_APP_URL;
    const origin=req.get('origin');
    if(origin){
      let allowed='';try{allowed=expected?new URL(expected).origin:'';}catch{return res.status(503).json({error:'BEAUTY_UNAVAILABLE'});}
      if(origin!==allowed) return res.status(403).json({error:'BEAUTY_ORIGIN_INVALID'});
    }
    if(req.get('sec-fetch-site')==='cross-site') return res.status(403).json({error:'BEAUTY_ORIGIN_INVALID'});
    if(Buffer.byteLength(JSON.stringify(req.body||{}))>4096) return res.status(413).json({error:'BEAUTY_INPUT_TOO_LARGE'});
    let input:BeautyInput;
    try{input=normalizeBeautyRequest(req.body);}catch{return res.status(400).json({error:'BEAUTY_INPUT_INVALID'});}
    try{
      const receipt=await store.create(input);
      return res.status(202).json({...receipt,whatsappUrl:beautyWhatsAppUrl(receipt.id),message:'Solicitud recibida; el turno requiere confirmación personal.'});
    }catch(error){return res.status((error as Error).message==='BEAUTY_IDEMPOTENCY_CONFLICT'?409:503).json({error:(error as Error).message==='BEAUTY_IDEMPOTENCY_CONFLICT'?'BEAUTY_IDEMPOTENCY_CONFLICT':'BEAUTY_UNAVAILABLE'});}
  });
  router.use('/admin',deps.auth || requireSupabaseAdminAuth);
  router.get('/admin/requests',async(req,res)=>{
    if(!enabled()) return res.status(503).json({error:'BEAUTY_REQUESTS_DISABLED'});
    const raw=req.query.offset===undefined?'0':String(req.query.offset);
    if(!/^\d{1,5}$/.test(raw)) return res.status(400).json({error:'BEAUTY_PAGE_INVALID'});
    try{return res.json({requests:await store.list(req.get('authorization')?.slice(7)||'',Number(raw))});}
    catch{return res.status(503).json({error:'BEAUTY_UNAVAILABLE'});}
  });
  router.patch('/admin/requests/:id',async(req,res)=>{
    if(!enabled()) return res.status(503).json({error:'BEAUTY_REQUESTS_DISABLED'});
    const {from,status}=req.body||{};
    if(!BEAUTY_UUID.test(String(req.params.id))||Object.keys(req.body||{}).some(k=>!['from','status'].includes(k))||!BEAUTY_STATUSES.includes(from)||!BEAUTY_STATUSES.includes(status)||!beautyTransition(from,status)) return res.status(400).json({error:'BEAUTY_TRANSITION_INVALID'});
    try{
      const changed=await store.update(req.get('authorization')?.slice(7)||'',String(req.params.id),from,status,res.locals.adminUserId);
      return res.status(changed?200:409).json(changed?{ok:true}:{error:'BEAUTY_STATE_CONFLICT'});
    }catch{return res.status(503).json({error:'BEAUTY_UNAVAILABLE'});}
  });
  return router;
}
