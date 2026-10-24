import test from 'node:test';
import assert from 'node:assert/strict';
import { configuredConsultationModel } from './consultationIntelligenceProviders';
test('remote models require independent approval, dedicated key and supported model',()=>{
 assert.equal(configuredConsultationModel({GEMINI_API_KEY:'unrelated'}),undefined);
 assert.throws(()=>configuredConsultationModel({CONSULTATION_AI_PROVIDER:'openai',CONSULTATION_AI_MODEL:'gpt-6-luna'}),/NOT_AUTHORIZED/);
 assert.throws(()=>configuredConsultationModel({CONSULTATION_AI_PROVIDER:'openai',CONSULTATION_AI_REMOTE_AUTHORIZED:'true',CONSULTATION_AI_API_KEY:'synthetic',CONSULTATION_AI_MODEL:'unknown'}),/CONFIG_INVALID/);
});
test('OpenAI and Gemini adapters use bounded structured requests without tools or fallback',async()=>{
 for(const provider of ['openai','gemini']){
  const calls:any[]=[];
  const mock=async(url:any,init:any)=>{calls.push({url,init,body:JSON.parse(init.body)});return new Response(JSON.stringify(provider==='openai'?{status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"ok":true}'}]}]}:{candidates:[{finishReason:'STOP',content:{parts:[{text:'{"ok":true}'}]}}]}),{status:200});};
  const model=configuredConsultationModel({CONSULTATION_AI_REMOTE_AUTHORIZED:'true',CONSULTATION_AI_PROVIDER:provider,CONSULTATION_AI_MODEL:provider==='openai'?'gpt-6-luna':'gemini-3.5-flash-lite',CONSULTATION_AI_API_KEY:'fixture-key',CONSULTATION_AI_CONFIG_VERSION:'fixture-v1'},mock as any)!;
  assert.deepEqual(await model.complete('understand',{untrustedMessage:'Consulta sintética'},{type:'object'},new AbortController().signal),{ok:true});
  assert.equal(calls.length,1);assert.ok(!('tools' in calls[0].body));assert.ok(!calls[0].url.includes('fixture-key'));
  if(provider==='openai'){assert.equal(calls[0].body.store,false);assert.equal(calls[0].body.text.format.strict,true);}
 }
});
test('invalid responses and HTTP failures do not retry or disclose response content',async()=>{
 let calls=0;
 const model=configuredConsultationModel({CONSULTATION_AI_REMOTE_AUTHORIZED:'true',CONSULTATION_AI_PROVIDER:'openai',CONSULTATION_AI_MODEL:'gpt-6-luna',CONSULTATION_AI_API_KEY:'fixture-key'},(async()=>{calls++;return new Response('private detail',{status:500});}) as any)!;
 await assert.rejects(model.complete('draft',{}, {},new AbortController().signal),/^Error: MODEL_PROVIDER_UNAVAILABLE$/);
 assert.equal(calls,1);
});
