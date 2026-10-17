import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { createBeautyManagementRouter, type BeautyManagementStore } from './beautyManagementRouter';
test('catalogue public filtering, publication gate and professional access are independent',async()=>{
 let writes=0;
 const store:BeautyManagementStore={services:async()=>[{id:'facial',publication_status:'draft',available:true,price_approved:false,proposed_price_uyu:9999},{id:'massage',publication_status:'published',available:true,price_approved:true,proposed_price_uyu:3200}],saveService:async()=>{writes++;return null;},evaluation:async()=>null,saveEvaluation:async()=>{writes++;return null;}};
 const app=express();app.use(express.json());app.use('/api/beauty',createBeautyManagementRouter({store,catalogEnabled:()=>true,professionalEnabled:()=>true,adminAuth:(req,res,next)=>req.get('authorization')==='Bearer admin'?next():res.sendStatus(401)}));
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as any).port}/api/beauty`;
 try{
  const list=await(await fetch(base+'/catalog')).json();assert.equal(list.services.length,1);assert.equal(list.services[0].id,'massage');assert.ok(!JSON.stringify(list).includes('9999'));
  assert.equal((await fetch(base+'/catalog/admin/services')).status,401);
  assert.equal((await fetch(base+'/professional/access')).status,401);
  const published={version:1,requestService:'facial',category:'Faciales',title:'Cosmético',description:'Cuidado',durationMinutes:75,proposedPriceUyu:3600,priceApproved:true,conditions:'Acordadas',availability:'Consultar',available:true,publicationStatus:'published'};
  const response=await fetch(base+'/catalog/admin/services/facial',{method:'PATCH',headers:{authorization:'Bearer admin','content-type':'application/json'},body:JSON.stringify(published)});assert.equal(response.status,403);assert.equal(writes,0);
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
