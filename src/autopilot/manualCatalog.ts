import {randomUUID} from 'node:crypto';
import {Router,type RequestHandler} from 'express';
import {createClient} from '@supabase/supabase-js';
import {requireSupabaseAdminAuth} from '../security/adminAuth';
import {safeCatalogUrl,salesAction} from '../storefront/salesChannel';

function field(value:unknown,max:number) {
 if(typeof value!=='string' || !value.trim() || value.trim().length>max) throw Error('INVALID_CATALOG_FIELD');
 return value.trim();
}
export function buildManualDraft(body:Record<string,unknown>) {
 const title=field(body.title,160),description=field(body.description,3000),category=field(body.category,100);
 const merchant=field(body.merchant,100),source=safeCatalogUrl(body.source);
 if(!source || !['affiliate','inquiry'].includes(String(body.mode))) throw Error('INVALID_CATALOG_SOURCE');
 const offer={mode:body.mode as 'affiliate'|'inquiry',url:field(body.url,2048),merchant,approved:false};
 if(salesAction({title,traceability:{offer:{...offer,approved:true}}}).kind==='blocked') throw Error('INVALID_CATALOG_DESTINATION');
 const image=body.image ? safeCatalogUrl(body.image) : null;
 if(body.image && (!image || body.imagePermission!==true)) throw Error('IMAGE_PERMISSION_REQUIRED');
 // Conservative review gate; manual intake is not regulatory certification.
 if(/cura(r)?\b|cancer|cáncer|tratamiento médico|medical treatment|permanent whitening/i.test(title+' '+description)) throw Error('CATALOG_CONTENT_REQUIRES_REVIEW');
 const id=randomUUID(),now=new Date().toISOString();
 return {id,status:'draft_ready',title,original_title:title,description,category,slug:'seleccion-'+id,
 sku:'MANUAL-'+id,brand:'Victoriosa',tags:[],features:[],specs:{},price:0,cost_price:0,inventory:0,
 images:image?[image.href]:[],original_images:image?[image.href]:[],badges:[],rating:0,review_count:0,
 traceability:{offer,source:{name:merchant,url:source.href,platform:'Manual Discovery',sku:'',rawCategory:category},
  image_permission:body.imagePermission===true,createdBy:'Manual catalog',createdAt:now,updatedAt:now,
  risk:{level:'medium',supplierRisk:'unverified',details:['Condiciones comerciales pendientes de revisión humana.']},
  history:[{timestamp:now,action:'Borrador manual creado sin compra ni publicación',actor:'Administrador'}]},
 updated_at:now};
}
type Row=ReturnType<typeof buildManualDraft>;
interface Store {
 insert(row:Row):Promise<any>; list():Promise<any[]>; find(id:string):Promise<any>;
 publish(row:any,previous:any):Promise<any>;
}
function database() {
 const url=process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url || !key) throw Error('CATALOG_DATABASE_NOT_CONFIGURED');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
const store:Store={
 async insert(row){const {data,error}=await database().from('products').insert(row).select().single();if(error)throw Error('CATALOG_SAVE_FAILED');return data;},
 async list(){const {data,error}=await database().from('products').select('*').not('traceability->offer','is',null).order('updated_at',{ascending:false}).limit(30);if(error)throw Error('CATALOG_LOAD_FAILED');return data||[];},
 async find(id){const {data,error}=await database().from('products').select('*').eq('id',id).single();if(error)throw Error('CATALOG_LOAD_FAILED');return data;},
 async publish(row,previous){const {data,error}=await database().from('products').update({status:'published',price:0,inventory:0,traceability:row.traceability,updated_at:row.updated_at}).eq('id',row.id).eq('status','draft_ready').eq('updated_at',previous.updated_at).select().single();if(error)throw Error('CATALOG_CHANGED_OR_SAVE_FAILED');return data;}
};
export function createManualCatalogRouter(deps:{store?:Store;auth?:RequestHandler}={}) {
 const router=Router(),db=deps.store||store;
 router.use(deps.auth||requireSupabaseAdminAuth);
 router.get('/',async(_req,res)=>{try{return res.json({products:await db.list()});}catch{return res.status(503).json({error:'CATALOG_LOAD_FAILED'});}});
 router.post('/',async(req,res)=>{
  let row:Row;try{row=buildManualDraft(req.body||{});}catch{return res.status(400).json({error:'INVALID_MANUAL_CATALOG_INPUT'});}
  try{return res.status(201).json({product:await db.insert(row)});}catch{return res.status(503).json({error:'CATALOG_SAVE_FAILED'});}
 });
 router.post('/:id/publish',async(req,res)=>{
  if(req.body?.reviewed!==true || !/^[0-9a-f-]{36}$/.test(req.params.id)) return res.status(400).json({error:'EXPLICIT_CATALOG_REVIEW_REQUIRED'});
  try{
   const previous=await db.find(req.params.id);
   if(previous?.status!=='draft_ready' || !previous.traceability?.offer) return res.status(409).json({error:'CATALOG_DRAFT_REQUIRED'});
   if(typeof req.body.version!=='string' || req.body.version!==previous.updated_at) return res.status(409).json({error:'CATALOG_REVIEW_OUTDATED'});
   if(previous.images?.length && previous.traceability.image_permission!==true) return res.status(409).json({error:'IMAGE_PERMISSION_REQUIRED'});
   const next={...previous,price:0,inventory:0,status:'published',updated_at:new Date().toISOString(),
    traceability:{...previous.traceability,offer:{...previous.traceability.offer,approved:true},
      reviewed_by:res.locals.adminUserId,reviewed_at:new Date().toISOString(),
      history:[...(previous.traceability.history||[]),{timestamp:new Date().toISOString(),action:'Ficha externa revisada y publicada sin checkout',actor:res.locals.adminUserId||'Administrador'}]}};
   if(salesAction(next).kind==='blocked') return res.status(409).json({error:'CATALOG_DESTINATION_INVALID'});
   return res.json({product:await db.publish(next,previous)});
  }catch{return res.status(503).json({error:'CATALOG_SAVE_FAILED'});}
 });
 return router;
}
