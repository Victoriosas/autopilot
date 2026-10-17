import { Router, type RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { beautyCallerDatabase, requireBeautyPractitioner } from './beautyDatabase';
import { requireSupabaseAdminAuth } from '../security/adminAuth';
import { normalizeBeautyService, normalizeBeautyEvaluation, type BeautyServiceInput, type BeautyEvaluationInput } from './beautyManagement';
import { BEAUTY_UUID } from './beautyRequests';
const token=(req:any)=>req.get('authorization')?.match(/^Bearer (.+)$/i)?.[1]||'';
const version=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=1&&v<2147483647;
const serviceRow=(b:BeautyServiceInput)=>({id:b.id,request_service:b.requestService,category:b.category,title:b.title,description:b.description,duration_minutes:b.durationMinutes,proposed_price_uyu:b.proposedPriceUyu,price_approved:b.priceApproved,conditions:b.conditions,availability:b.availability,available:b.available,publication_status:b.publicationStatus});
const evaluationRow=(b:BeautyEvaluationInput)=>({request_id:b.requestId,client_declared:b.clientDeclared,professional_notes:b.professionalNotes,consent_version:b.consentVersion,consent_evidence:b.consentEvidence,consent_recorded_at:b.consentRecordedAt,status:b.status});
export interface BeautyManagementStore{
 services(jwt?:string):Promise<any[]>;
 saveService(jwt:string,input:BeautyServiceInput,expected?:number):Promise<any|null>;
 evaluation(jwt:string,requestId:string):Promise<any|null>;
 saveEvaluation(jwt:string,input:BeautyEvaluationInput,actor:string,id?:string,expected?:number):Promise<any|null>;
}
export const beautyManagementStore:BeautyManagementStore={
 async services(jwt){const result=await beautyCallerDatabase(jwt).from('beauty_services').select('*').order('category').order('id');if(result.error)throw new Error();return result.data;},
 async saveService(jwt,input,expected){
  const db=beautyCallerDatabase(jwt),row=serviceRow(input);
  const result=expected===undefined?await db.from('beauty_services').insert(row).select().single():await db.from('beauty_services').update({...row,version:expected+1}).eq('id',input.id).eq('version',expected).select().maybeSingle();
  if(result.error)throw new Error();return result.data;
 },
 async evaluation(jwt,requestId){const result=await beautyCallerDatabase(jwt).from('beauty_evaluations').select('*').eq('request_id',requestId).maybeSingle();if(result.error)throw new Error();return result.data;},
 async saveEvaluation(jwt,input,actor,id,expected){
  const db=beautyCallerDatabase(jwt),row=evaluationRow(input);
  const result=id?await db.from('beauty_evaluations').update({client_declared:row.client_declared,professional_notes:row.professional_notes,status:row.status,version:expected!+1}).eq('id',id).eq('request_id',input.requestId).eq('version',expected!).select().maybeSingle():await db.from('beauty_evaluations').insert({...row,id:randomUUID(),practitioner_id:actor}).select().single();
  if(result.error)throw new Error();return result.data;
 },
};
export function createBeautyManagementRouter(deps:{store?:BeautyManagementStore;adminAuth?:RequestHandler;professionalAuth?:RequestHandler;catalogEnabled?:()=>boolean;professionalEnabled?:()=>boolean;publicationEnabled?:()=>boolean}={}){
 const router=Router(),store=deps.store||beautyManagementStore;
 const catalogEnabled=deps.catalogEnabled||(()=>process.env.BEAUTY_CATALOG_ENABLED==='true'),professionalEnabled=deps.professionalEnabled||(()=>process.env.BEAUTY_PROFESSIONAL_ENABLED==='true'),publicationEnabled=deps.publicationEnabled||(()=>process.env.BEAUTY_PUBLICATION_ENABLED==='true');
 router.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');next();});
 router.get('/catalog',async(_req,res)=>{
  if(!catalogEnabled())return res.json({catalogEnabled:false,services:[]});
  try{const rows=await store.services();return res.json({catalogEnabled:true,services:rows.filter(r=>r.publication_status==='published'&&r.available&&r.price_approved).map(r=>({id:r.id,request_service:r.request_service,category:r.category,title:r.title,description:r.description,duration_minutes:r.duration_minutes,price_uyu:r.proposed_price_uyu,conditions:r.conditions,availability:r.availability,version:r.version}))});}catch{return res.status(503).json({error:'BEAUTY_CATALOG_UNAVAILABLE'});}
 });
 router.use('/catalog/admin',deps.adminAuth||requireSupabaseAdminAuth,(_req,res,next)=>catalogEnabled()?next():res.status(503).json({error:'BEAUTY_CATALOG_DISABLED'}));
 router.get('/catalog/admin/services',async(req,res)=>{try{return res.json({services:await store.services(token(req))});}catch{return res.status(503).json({error:'BEAUTY_CATALOG_UNAVAILABLE'});}});
 const saveCatalog=(editing:boolean):RequestHandler=>async(req,res)=>{
  let input:BeautyServiceInput;const {version:expected,...fields}=req.body||{};
  try{if(editing&&(!version(expected)||'id' in fields)||!editing&&expected!==undefined)throw new Error();input=normalizeBeautyService(editing?{...fields,id:req.params.id}:fields);if(!editing&&input.publicationStatus!=='draft')throw new Error();}catch{return res.status(400).json({error:'BEAUTY_CATALOG_INVALID'});}
  if(input.publicationStatus==='published'&&!publicationEnabled())return res.status(403).json({error:'BEAUTY_PUBLICATION_DISABLED'});
  try{const row=await store.saveService(token(req),input,editing?expected:undefined);return res.status(row?(editing?200:201):409).json(row?{service:row}:{error:'BEAUTY_VERSION_CONFLICT'});}catch{return res.status(409).json({error:'BEAUTY_CATALOG_SAVE_REJECTED'});}
 };
 router.post('/catalog/admin/services',saveCatalog(false));router.patch('/catalog/admin/services/:id',saveCatalog(true));
 router.use('/professional',(_req,res,next)=>professionalEnabled()?next():res.status(503).json({error:'BEAUTY_PROFESSIONAL_DISABLED'}),deps.professionalAuth||requireBeautyPractitioner);
 router.get('/professional/access',(_req,res)=>res.json({authorized:true}));
 router.get('/professional/evaluations',async(req,res)=>{
  if(!BEAUTY_UUID.test(String(req.query.requestId)))return res.status(400).json({error:'BEAUTY_REFERENCE_INVALID'});
  try{return res.json({evaluation:await store.evaluation(token(req),String(req.query.requestId))});}catch{return res.status(503).json({error:'BEAUTY_EVALUATION_UNAVAILABLE'});}
 });
 const saveEvaluation=(editing:boolean):RequestHandler=>async(req,res)=>{
  if(Buffer.byteLength(JSON.stringify(req.body||{}))>20000)return res.status(413).json({error:'BEAUTY_INPUT_TOO_LARGE'});
  const {version:expected,...fields}=req.body||{};let input:BeautyEvaluationInput;
  try{if(editing&&(!version(expected)||!BEAUTY_UUID.test(String(req.params.id)))||!editing&&expected!==undefined)throw new Error();input=normalizeBeautyEvaluation(fields);if(!editing&&input.status!=='draft')throw new Error();}catch{return res.status(400).json({error:'BEAUTY_EVALUATION_INVALID'});}
  try{const row=await store.saveEvaluation(token(req),input,res.locals.beautyPractitionerId,editing?String(req.params.id):undefined,editing?expected:undefined);return res.status(row?(editing?200:201):409).json(row?{evaluation:row}:{error:'BEAUTY_VERSION_CONFLICT'});}catch{return res.status(409).json({error:'BEAUTY_EVALUATION_SAVE_REJECTED'});}
 };
 router.post('/professional/evaluations',saveEvaluation(false));router.patch('/professional/evaluations/:id',saveEvaluation(true));
 return router;
}
