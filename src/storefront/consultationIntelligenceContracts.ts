export const INTELLIGENCE_VERSION='consultation-intelligence-v1';
export const topics=['price','service','duration','availability','location','gift','complaint','unknown'] as const;
export type QuestionTopic=typeof topics[number];
export const riskCodes=['health','minor','urgent','injection','efficacy','ambiguous','complaint'] as const;
export type RiskCode=typeof riskCodes[number];
export type ModelStage='understand'|'draft'|'review';
export interface ConsultationModel {
 id:string; model:string; configVersion:string; remote?:boolean;
 complete(stage:ModelStage,payload:unknown,schema:Record<string,unknown>,signal:AbortSignal):Promise<unknown>;
}
export function strictObject(value:unknown,keys:readonly string[]):value is Record<string,unknown>{
 return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&Object.keys(value).every(k=>keys.includes(k));
}
const stringArray=(value:unknown,max:number):value is string[]=>Array.isArray(value)&&value.length<=max&&value.every(v=>typeof v==='string'&&v.length<=160);
export type ModelUnderstanding={topics:QuestionTopic[];serviceCandidates:string[];risks:RiskCode[];confidence:number;notes:string[]};
export function validateModelUnderstanding(value:unknown):ModelUnderstanding {
 if(!strictObject(value,['topics','serviceCandidates','risks','confidence','notes'])||!stringArray(value.topics,8)||!value.topics.length||value.topics.some(v=>!topics.includes(v as any))||
 !stringArray(value.serviceCandidates,20)||!stringArray(value.risks,8)||value.risks.some(v=>!riskCodes.includes(v as any))||
 typeof value.confidence!=='number'||!Number.isFinite(value.confidence)||value.confidence<0||value.confidence>1||!stringArray(value.notes,8))throw Error('MODEL_OUTPUT_INVALID');
 return value as ModelUnderstanding;
}
const objectSchema=(properties:Record<string,unknown>)=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const strings=(items:Record<string,unknown>={type:'string'})=>({type:'array',items});
export const intelligenceSchemas={
 understand:objectSchema({topics:strings({type:'string',enum:topics}),serviceCandidates:strings(),risks:strings({type:'string',enum:riskCodes}),confidence:{type:'number'},notes:strings()}),
 draft:objectSchema({texts:strings()}),
 review:objectSchema({status:{type:'string',enum:['approved','requires_changes','blocked']},codes:strings()}),
};
