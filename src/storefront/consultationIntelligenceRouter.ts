import { json,type Router,type RequestHandler } from 'express';
import type { ConsultationStore } from './consultationSupabase';
import { CONSULTATION_UUID } from './consultationRequest';
import { strictObject,type ConsultationModel } from './consultationIntelligenceContracts';
import { configuredConsultationModel } from './consultationIntelligenceProviders';
import { intelligenceStore,runConsultationIntelligence,reviewConsultationIntelligence,type IntelligenceStore } from './consultationIntelligenceStore';
import { prepareIntelligenceOperations,validateWorkflowEvent } from './consultationIntelligenceOperations';
import { dispatchIntelligenceReply } from './consultationIntelligenceDispatch';

export type IntelligenceRouterDependencies={enabled?:()=>boolean;store?:IntelligenceStore;provider?:()=>ConsultationModel|undefined;now?:()=>Date};
/** Adds authenticated, explicit, durable shadow work; never changes the existing delivery path. */
export function registerConsultationIntelligence(router:Router,auth:RequestHandler,store:ConsultationStore,allowedOrigin:()=>string,deps:IntelligenceRouterDependencies={}){
 const enabled=deps.enabled??(()=>process.env.CONSULTATION_INTELLIGENCE_ENABLED==='true' || (process.env.AUTOPILOT_RUNTIME==='supabase-edge' && process.env.CONSULTATION_PRIVACY_APPROVED==='true'));
 const persistence=deps.store??intelligenceStore;
 const guard:RequestHandler=(req,res,next)=>{
  res.set('Cache-Control','no-store');
  if(!enabled())return res.status(503).json({error:'INTELLIGENCE_DISABLED',mode:'shadow'});
  if(!CONSULTATION_UUID.test(req.params.id)||req.params.run&&!CONSULTATION_UUID.test(req.params.run))return res.status(400).json({error:'CONSULTATION_INPUT_INVALID'});
  if(req.method==='POST'&&(req.get('origin')!==allowedOrigin()||req.get('x-consultation-approval')!==req.params.id))return res.status(403).json({error:'CONSULTATION_ORIGIN_INVALID'});
  next();
 };
 router.get('/admin/intelligence-config',auth,(_req,res)=>res.json({enabled:enabled(),mode:'shadow',sendsEnabled:false}));
 router.get('/admin/intelligence-report',auth,async(_req,res)=>{
  if(!enabled())return res.status(503).json({error:'INTELLIGENCE_DISABLED'});
  try{return res.json({...await persistence.report(),content:prepareIntelligenceOperations([],deps.now?.()??new Date()).content});}catch{return res.status(503).json({error:'INTELLIGENCE_UNAVAILABLE'});}
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
 router.get('/admin/:id/intelligence/operations',auth,guard,async(req,res)=>{
  try{if(!await recordFor(req))return res.status(404).json({error:'CONSULTATION_NOT_FOUND'});
   if(!persistence.events)throw Error();return res.json(prepareIntelligenceOperations(await persistence.events(req.params.id),deps.now?.()??new Date()));
  }catch{return res.status(503).json({error:'INTELLIGENCE_UNAVAILABLE'});}
 });
 router.post('/admin/:id/intelligence/:run/event',auth,guard,json({limit:'2kb',strict:true}),async(req,res)=>{
  if(!validateWorkflowEvent(req.body,deps.now?.()??new Date()))return res.status(400).json({error:'INTELLIGENCE_EVENT_INVALID'});
  try{if(!await recordFor(req))return res.status(404).json({error:'CONSULTATION_NOT_FOUND'});
   if(!persistence.recordEvent||typeof res.locals.adminUserId!=='string')throw Error();
   const confirmed=await persistence.recordEvent(req.params.id,req.params.run,res.locals.adminUserId,req.body);
   return res.status(confirmed?200:409).json({recorded:confirmed});
  }catch{return res.status(503).json({error:'INTELLIGENCE_UNAVAILABLE'});}
 });
 router.post('/admin/:id/intelligence/:run/dispatch',auth,guard,json({limit:'1kb',strict:true}),async(req,res)=>{
  if(!strictObject(req.body,['approvalHash'])||typeof req.body.approvalHash!=='string'||!/^[a-f0-9]{64}$/.test(req.body.approvalHash))return res.status(400).json({error:'CONSULTATION_INPUT_INVALID'});
  try{const record=await recordFor(req);if(!record)return res.status(404).json({error:'CONSULTATION_NOT_FOUND'});
   if(typeof res.locals.adminUserId!=='string')return res.status(403).json({error:'ADMIN_AUTH_REQUIRED'});
   const status=await dispatchIntelligenceReply(record,req.params.run,res.locals.adminUserId,req.body.approvalHash);
   return res.status(status==='sent'?200:409).json({status});
  }catch{return res.status(503).json({error:'INTELLIGENCE_DELIVERY_UNCONFIRMED'});}
 });
}
