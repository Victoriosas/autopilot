import { json,type Router,type RequestHandler } from 'express';
import type { ConsultationStore } from './consultationSupabase';
import { CONSULTATION_UUID } from './consultationRequest';
import { strictObject,type ConsultationModel } from './consultationIntelligenceContracts';
import { configuredConsultationModel } from './consultationIntelligenceProviders';
import { intelligenceStore,runConsultationIntelligence,reviewConsultationIntelligence,type IntelligenceStore } from './consultationIntelligenceStore';

export type IntelligenceRouterDependencies={enabled?:()=>boolean;store?:IntelligenceStore;provider?:()=>ConsultationModel|undefined;now?:()=>Date};
/** Adds authenticated, explicit, durable shadow work; never changes the existing delivery path. */
export function registerConsultationIntelligence(router:Router,auth:RequestHandler,store:ConsultationStore,allowedOrigin:()=>string,deps:IntelligenceRouterDependencies={}){
 const enabled=deps.enabled??(()=>process.env.CONSULTATION_INTELLIGENCE_ENABLED==='true');
 const persistence=deps.store??intelligenceStore;
 const guard:RequestHandler=(req,res,next)=>{
  if(!enabled())return res.status(503).json({error:'INTELLIGENCE_DISABLED',mode:'shadow'});
  if(!CONSULTATION_UUID.test(req.params.id)||req.params.run&&!CONSULTATION_UUID.test(req.params.run))return res.status(400).json({error:'CONSULTATION_INPUT_INVALID'});
  if(req.method==='POST'&&(req.get('origin')!==allowedOrigin()||req.get('x-consultation-approval')!==req.params.id))return res.status(403).json({error:'CONSULTATION_ORIGIN_INVALID'});
  next();
 };
 router.get('/admin/intelligence-config',auth,(_req,res)=>res.json({enabled:enabled(),mode:'shadow',sendsEnabled:false}));
 router.get('/admin/intelligence-report',auth,async(_req,res)=>{
  if(!enabled())return res.status(503).json({error:'INTELLIGENCE_DISABLED'});
  try{return res.json(await persistence.report());}catch{return res.status(503).json({error:'INTELLIGENCE_UNAVAILABLE'});}
 });
 const recordFor=async(req:any)=>{const token=req.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];if(!token||!store.get)throw Error('CONSULTATION_UNAVAILABLE');return store.get(token,req.params.id);};
 router.post('/admin/:id/intelligence',auth,guard,json({limit:'1kb',strict:true}),async(req,res)=>{
  if(!strictObject(req.body,[]))return res.status(400).json({error:'CONSULTATION_INPUT_INVALID'});
  try{
   const record=await recordFor(req);if(!record)return res.status(404).json({error:'CONSULTATION_NOT_FOUND'});
   const provider=(deps.provider??(()=>configuredConsultationModel()))();
   const budget=(key:string)=>/^\d+$/.test(process.env[key]??'')?Number(process.env[key]):0;
   const result=await runConsultationIntelligence(record,{store:persistence,provider,now:deps.now?.(),dailyBudget:budget('CONSULTATION_AI_DAILY_MICROUSD'),monthlyBudget:budget('CONSULTATION_AI_MONTHLY_MICROUSD')});
   return res.status(result.state==='busy'?202:result.state==='failed'?409:200).json(result);
  }catch{return res.status(503).json({error:'INTELLIGENCE_UNAVAILABLE',mode:'shadow'});}
 });
 router.post('/admin/:id/intelligence/:run/review',auth,guard,json({limit:'16kb',strict:true}),async(req,res)=>{
  if(!strictObject(req.body,['text','action'])||typeof req.body.text!=='string'||req.body.text.length>6000||!['approve','reject'].includes(req.body.action as string))return res.status(400).json({error:'CONSULTATION_INPUT_INVALID'});
  try{
   const record=await recordFor(req);if(!record)return res.status(404).json({error:'CONSULTATION_NOT_FOUND'});
   const admin=res.locals.adminUserId;if(typeof admin!=='string')return res.status(403).json({error:'ADMIN_AUTH_REQUIRED'});
   const result=await reviewConsultationIntelligence(record,req.params.run,admin,req.body.text,{store:persistence,now:deps.now?.(),action:req.body.action as 'approve'|'reject'});
   return res.status(result.status==='blocked'?409:200).json(result);
  }catch{return res.status(409).json({error:'INTELLIGENCE_REVIEW_STALE'});}
 });
}
