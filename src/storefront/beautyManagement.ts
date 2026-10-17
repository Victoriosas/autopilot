import { BEAUTY_SERVICES, BEAUTY_UUID } from './beautyRequests';
export const SERVICE_ID=/^[a-z][a-z0-9-]{1,63}$/;
export type BeautyServiceInput={id:string;requestService:typeof BEAUTY_SERVICES[number];category:string;title:string;description:string;durationMinutes:number;proposedPriceUyu:number|null;priceApproved:boolean;conditions:string;availability:string;available:boolean;publicationStatus:'draft'|'pending'|'approved'|'published'};
export type BeautyEvaluationInput={requestId:string;clientDeclared:Record<string,string>;professionalNotes:{observations?:string;suggestedServices?:string[];steps?:string;frequency?:string;aftercare?:string;referral?:boolean};consent:true;consentVersion:'beauty-evaluation-v1';consentEvidence:string;consentRecordedAt:string;status:'draft'|'finalized'};
function object(input:unknown,keys:string[]):Record<string,any>{
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!keys.includes(k)))throw new Error('BEAUTY_INPUT_INVALID');
 return input as Record<string,any>;
}
function text(value:unknown,max:number,required=true){if(typeof value!=='string'||value.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)||required&&!value.trim())throw new Error('BEAUTY_INPUT_INVALID');return value.trim();}
export function normalizeBeautyService(input:unknown):BeautyServiceInput{
 const b=object(input,['id','requestService','category','title','description','durationMinutes','proposedPriceUyu','priceApproved','conditions','availability','available','publicationStatus']);
 if(!SERVICE_ID.test(b.id)||!BEAUTY_SERVICES.includes(b.requestService)||!Number.isInteger(b.durationMinutes)||b.durationMinutes<15||b.durationMinutes>240||typeof b.priceApproved!=='boolean'||typeof b.available!=='boolean'||!['draft','pending','approved','published'].includes(b.publicationStatus))throw new Error('BEAUTY_INPUT_INVALID');
 if(b.proposedPriceUyu!==null&&(typeof b.proposedPriceUyu!=='number'||!Number.isFinite(b.proposedPriceUyu)||b.proposedPriceUyu<=0||b.proposedPriceUyu>100000||Math.abs(b.proposedPriceUyu*100-Math.round(b.proposedPriceUyu*100))>0.000001))throw new Error('BEAUTY_INPUT_INVALID');
 const result={id:b.id,requestService:b.requestService,category:text(b.category,80),title:text(b.title,120),description:text(b.description,1500,false),durationMinutes:b.durationMinutes,proposedPriceUyu:b.proposedPriceUyu,priceApproved:b.priceApproved,conditions:text(b.conditions,1500,false),availability:text(b.availability,500,false),available:b.available,publicationStatus:b.publicationStatus};
 if(['approved','published'].includes(b.publicationStatus)&&(!b.priceApproved||b.proposedPriceUyu===null||!result.description||!result.conditions||!result.availability))throw new Error('BEAUTY_APPROVAL_REQUIRED');
 return result;
}
export function normalizeBeautyEvaluation(input:unknown):BeautyEvaluationInput{
 const b=object(input,['requestId','clientDeclared','professionalNotes','consent','consentVersion','consentEvidence','consentRecordedAt','status']);
 if(!BEAUTY_UUID.test(b.requestId)||b.consent!==true||b.consentVersion!=='beauty-evaluation-v1'||!['draft','finalized'].includes(b.status))throw new Error('BEAUTY_EVALUATION_INVALID');
 const timestamp=text(b.consentRecordedAt,40),date=new Date(timestamp);
 if(!Number.isFinite(date.getTime())||date.getTime()>Date.now()||date.getTime()<Date.parse('2000-01-01T00:00:00Z'))throw new Error('BEAUTY_CONSENT_INVALID');
 const declared=object(b.clientDeclared,['skinType','sensitivity','cosmeticReactions','recentTreatments','expectations']);
 const notes=object(b.professionalNotes,['observations','suggestedServices','steps','frequency','aftercare','referral']);
 const clientDeclared:Record<string,string>={};for(const [key,value]of Object.entries(declared))clientDeclared[key]=text(value,1000,false);
 const professionalNotes:BeautyEvaluationInput['professionalNotes']={};
 for(const key of ['observations','steps','frequency','aftercare'] as const)if(notes[key]!==undefined)professionalNotes[key]=text(notes[key],3000,false);
 if(notes.referral!==undefined){if(typeof notes.referral!=='boolean')throw new Error('BEAUTY_EVALUATION_INVALID');professionalNotes.referral=notes.referral;}
 if(notes.suggestedServices!==undefined){if(!Array.isArray(notes.suggestedServices)||notes.suggestedServices.length>10||notes.suggestedServices.some((s:unknown)=>typeof s!=='string'||!SERVICE_ID.test(s)))throw new Error('BEAUTY_EVALUATION_INVALID');professionalNotes.suggestedServices=[...new Set(notes.suggestedServices)] as string[];}
 if(b.status==='finalized'&&!professionalNotes.observations)throw new Error('BEAUTY_EVALUATION_INVALID');
 return {requestId:b.requestId.toLowerCase(),clientDeclared,professionalNotes,consent:true,consentVersion:'beauty-evaluation-v1',consentEvidence:text(b.consentEvidence,200),consentRecordedAt:date.toISOString(),status:b.status};
}
