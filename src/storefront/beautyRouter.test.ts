import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { createBeautyRouter, type BeautyStore } from './beautyRouter';
const input={id:'8f7c7698-cdbe-4a77-8a86-5a1d090284b5',firstName:'Cliente',lastName:'Prueba',contact:'099123456',zone:'Solymar',service:'facial',availability:'',source:'web',consent:true,consentVersion:'beauty-v1'};
test('HTTP validation, honest DB failures, origin and administrative access',async t=>{
  let calls=0,fail=false;
  const store:BeautyStore={create:async()=>{calls++;if(fail)throw new Error('db detail private');return{id:input.id,status:'pending'};},list:async()=>[],update:async()=>false};
  const app=express();app.use(express.json());app.use('/api/beauty',createBeautyRouter({store,enabled:()=>true}));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${(server.address() as any).port}/api/beauty`;
  const post=(data:any,extra={})=>fetch(base+'/requests',{method:'POST',headers:{'content-type':'application/json',...extra},body:JSON.stringify(data)});
  try{
    await t.test('valid receipt contains only opaque WhatsApp reference',async()=>{const r=await post(input);assert.equal(r.status,202);const b=await r.json();assert.equal(b.id,input.id);assert(!b.whatsappUrl.includes(input.contact));assert(!('contact' in b));});
    await t.test('private fields and missing consent rejected before store',async()=>{calls=0;assert.equal((await post({...input,skin:'sensitive'})).status,400);assert.equal((await post({...input,consent:false})).status,400);assert.equal(calls,0);});
    await t.test('DB error never claims receipt or leaks details',async()=>{fail=true;const r=await post(input);assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'BEAUTY_UNAVAILABLE'});});
    await t.test('cross-site writes blocked',async()=>assert.equal((await post(input,{'sec-fetch-site':'cross-site'})).status,403));
    await t.test('admin list requires real auth guard, no token denied',async()=>assert.equal((await fetch(base+'/admin/requests')).status,401));
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
