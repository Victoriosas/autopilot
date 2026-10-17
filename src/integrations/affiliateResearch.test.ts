import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import {affiliatePrograms,researchProducts,createAffiliateResearchRouter} from './affiliateResearch';

test('affiliate configuration requires exact destination and explicit approval',()=>{
 assert.equal(affiliatePrograms({})[0].state,'missing_link');
 assert.equal(affiliatePrograms({ALIEXPRESS_AFFILIATE_URL:'https://aliexpress.com.evil.com/x',ALIEXPRESS_AFFILIATE_URL_APPROVED:'true'})[0].state,'invalid_link');
 const env={ALIEXPRESS_AFFILIATE_URL:'https://s.click.aliexpress.com/e/test'};
 assert.equal(affiliatePrograms(env)[0].url,null);
 assert.equal(affiliatePrograms({...env,ALIEXPRESS_AFFILIATE_URL_APPROVED:'true'})[0].state,'configured');
});

test('research is bounded, rejects hostile sources and never exposes the API key',async()=>{
 let calls=0;
 const fetcher=(async(url:any,init:any)=>{
  calls++;assert.equal(url,'https://api.firecrawl.dev/v2/search');
  assert.equal(JSON.parse(init.body).limit,5);assert.equal(init.redirect,'error');
  return Response.json({success:true,data:{web:[
   {url:'https://www.aliexpress.com/item/1.html',title:'Vincha'},
   {url:'https://aliexpress.com.evil.com/item/2',title:'Hostile'},
   {url:'http://localhost/x',title:'Private'}
  ]}});
 }) as typeof fetch;
 await assert.rejects(researchProducts('abc',{env:{},fetcher}),/NOT_CONFIGURED/);assert.equal(calls,0);
 await assert.rejects(researchProducts('',{env:{FIRECRAWL_API_KEY:'secret'},fetcher}),/INVALID_QUERY/);
 const rows=await researchProducts('vincha spa',{env:{FIRECRAWL_API_KEY:'secret'},fetcher});
 assert.equal(rows.length,1);assert.equal(rows[0].reviewRequired,true);
 assert.equal(JSON.stringify(rows).includes('secret'),false);
});

test('HTTP requires admin before status or billed research',async()=>{
 let calls=0;const app=express();app.use(express.json());
 app.use('/guard',createAffiliateResearchRouter({env:{FIRECRAWL_API_KEY:'secret'},fetcher:(async()=>{calls++;throw Error('secret');}) as typeof fetch}));
 app.use('/admin',createAffiliateResearchRouter({env:{},auth:(_q,_s,next)=>next()}));
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');const port=(server.address() as any).port;
 try{
  assert.equal((await fetch('http://127.0.0.1:'+port+'/guard/status')).status,401);
  assert.equal((await fetch('http://127.0.0.1:'+port+'/guard/search',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"query":"spa"}'})).status,401);
  assert.equal(calls,0);
  const r=await fetch('http://127.0.0.1:'+port+'/admin/search',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"query":"spa"}'});
  assert.equal(r.status,503);assert.equal((await r.json()).error,'FIRECRAWL_NOT_CONFIGURED');
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
