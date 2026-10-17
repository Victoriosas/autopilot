import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createManualCatalogRouter,buildManualDraft} from './manualCatalog';
const input={title:'Vincha de spa',description:'Accesorio para sujetar el cabello.',category:'Accesorios',merchant:'Comercio',mode:'inquiry',url:'https://wa.me/59899123456',source:'https://example.com/vincha',image:'',imagePermission:false};

test('manual intake always creates an unpriced, unstocked draft with unapproved destination',()=>{
 const p=buildManualDraft({...input,status:'published',price:500,inventory:100,approved:true});
 assert.equal(p.status,'draft_ready');assert.equal(p.price,0);assert.equal(p.inventory,0);
 assert.equal(p.traceability.offer.approved,false);
 assert.throws(()=>buildManualDraft({...input,url:'javascript:alert(1)'}));
 assert.throws(()=>buildManualDraft({...input,image:'https://example.com/img.jpg'}));
 assert.throws(()=>buildManualDraft({...input,title:''}));
});
test('HTTP intake requires admin and publication requires explicit review; no checkout or supplier calls',async()=>{
 const rows:any[]=[];let saves=0;
 const store={async insert(p:any){rows.push(p);return p;},async list(){return rows;},async find(id:string){return rows.find(x=>x.id===id);},async publish(p:any){saves++;rows[0]=p;return p;}};
 const app=express();app.use(express.json());
 app.use('/guarded',createManualCatalogRouter({store}));
 app.use('/catalog',createManualCatalogRouter({store,auth:(_req,_res,next)=>next()}));
 const server=createServer(app).listen(0,'127.0.0.1');await once(server,'listening');
 const {port}=server.address() as any;
 const post=(path:string,body:any)=>fetch('http://127.0.0.1:'+port+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  assert.equal((await post('/guarded',input)).status,401);assert.equal(rows.length,0);
  const created=await post('/catalog',input);assert.equal(created.status,201);const {product}=await created.json();
  assert.equal((await post('/catalog/'+product.id+'/publish',{})).status,400);assert.equal(saves,0);
  assert.equal((await post('/catalog/'+product.id+'/publish',{reviewed:true,version:'stale'})).status,409);
  assert.equal(saves,0);
  const published=await post('/catalog/'+product.id+'/publish',{reviewed:true,version:product.updated_at});
  assert.equal(published.status,200);assert.equal(rows[0].status,'published');assert.equal(rows[0].price,0);assert.equal(rows[0].inventory,0);
  assert.equal(rows[0].traceability.offer.approved,true);
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
