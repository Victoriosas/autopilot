// Actual React panel; synthetic API/auth only. All external browser traffic denied.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdirSync } from 'node:fs';
import express from 'express';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { MaterialAdminRow } from '../src/storefront/consultationMaterialAdmin';

const id='11111111-1111-4111-8111-111111111111';
const seed=(): MaterialAdminRow=>({id,review_state:'pending',consent_state:'granted',delivery_decision:'no_send',available:true,
  created_at:'2026-11-12T00:00:00Z',updated_at:'2026-11-12T00:00:00.123456Z',expires_at:new Date(Date.now()+60000).toISOString(),
  metadata:{intent:'organization',channel:'email',consent_version:'consultation-v1',sources:[{id:'initial-step',source:'synthetic-source',version:'v1',sha256:'a'.repeat(64)}]},
  events:[{id:1,event:'created',occurred_at:'2026-11-12T00:00:00Z'}]});
let rows=[seed()], writes=0, fail=false, delay=0;
const app=express();app.use(express.json());
app.get('/api/beauty/inquiries/admin/:id/material',async(_req,res)=>{if(delay)await new Promise(r=>setTimeout(r,delay));res.json({rows,delivery_decision:'no_send'});});
app.post('/api/beauty/inquiries/admin/:id/material/:action',(req,res)=>{
  assert.equal(req.get('authorization'),'Bearer synthetic-admin');assert.equal(req.get('x-consultation-approval'),id);writes++;
  if(req.params.action==='purge'){rows=[];return res.json({erased:1,delivery_decision:'no_send'});}
  assert.equal(req.body.updated_at,rows[0].updated_at);
  rows[0]={...rows[0],review_state:req.body.state,updated_at:new Date().toISOString(),...(req.body.state==='revoked'?{consent_state:'revoked',available:false,metadata:null}:{}),events:[...rows[0].events,{id:rows[0].events.length+1,event:req.body.state,occurred_at:new Date().toISOString()}]};
  if(fail)return res.status(503).json({error:'synthetic acknowledgement loss'});
  res.json({saved:true,delivery_decision:'no_send'});
});
let server:ReturnType<typeof app.listen>|undefined,browser:any;
const vite=await createServer({configFile:false,root:process.cwd(),plugins:[react(),tailwindcss(),{
  name:'synthetic-material-panel',
  enforce:'pre',
  resolveId(source){if(source==='/__material_entry.js')return source;if(source==='../../lib/supabase'||source==='./supabase')return '\0material-auth';},
  load(source){
    if(source==='\0material-auth')return `
      const callbacks=[];
      window.syntheticSignOut=()=>callbacks.forEach(fn=>fn('SIGNED_OUT'));
      const auth={
        getSession:async()=>({data:{session:{access_token:'synthetic-admin'}}}),
        onAuthStateChange(fn){callbacks.push(fn);return {data:{subscription:{unsubscribe(){}}}};}
      };
      export default {auth};`;
    if(source==='/__material_entry.js')return `import React from 'react';import {createRoot} from 'react-dom/client';import {ConsultationMaterialPanel} from '/src/components/admin/ConsultationMaterialPanel.tsx';createRoot(document.getElementById('root')).render(React.createElement(ConsultationMaterialPanel,{requestId:'${id}'}));`;
  },
}],server:{middlewareMode:true,hmr:{host:'127.0.0.1',port:25464}},appType:'custom'});
app.get('/__material',async(_req,res)=>res.type('html').send(await vite.transformIndexHtml('/__material','<html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/index.css"></head><body><main id="root"></main><script type="module" src="/__material_entry.js"></script></body></html>')));
app.use(vite.middlewares);
try{
  server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const origin=`http://127.0.0.1:${(server.address() as any).port}`;
  const {chromium}=await import(process.env.CONSULTATION_PLAYWRIGHT_MODULE || 'playwright');
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});mkdirSync('output/cycle-d',{recursive:true});
  for(const mobile of [false,true]){
    rows=[seed()];fail=false;delay=0;writes=0;
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},hasTouch:mobile,isMobile:mobile});
    const page=await context.newPage();const errors:string[]=[];page.on('pageerror',(e:Error)=>{errors.push(e.message);console.error(e.message);});
    page.on('console',(msg:any)=>{if(msg.type()==='error')console.error('Browser console:',msg.text());});
    page.on('response',(response:any)=>{if(response.status()>=400)console.error('Browser HTTP:',response.status(),new URL(response.url()).pathname);});
    await page.route('**/*',(route:any)=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    await page.goto(origin+'/__material');
    const refresh=page.getByRole('button',{name:'Actualizar material',exact:true});await refresh.click();await page.getByText(/synthetic-source/).waitFor();
    assert.ok(await page.getByText(/Versión v1/).isVisible());
    await page.screenshot({path:`output/cycle-d/material-${mobile?'mobile':'desktop'}.png`,fullPage:true});
    page.once('dialog',(d:any)=>d.dismiss());await page.getByRole('button',{name:'Revocar y borrar contenido'}).click();assert.equal(writes,0);
    fail=true;page.once('dialog',(d:any)=>d.accept());await page.getByRole('button',{name:'Marcar revisada'}).click();
    await page.getByText(/Estado no confirmado/).waitFor();assert.equal(writes,1);assert.equal(await page.getByText(/synthetic-source/).count(),0);
    fail=false;await refresh.click();await page.getByText(/Estado: Revisada/).waitFor();
    page.once('dialog',(d:any)=>d.accept());await page.getByRole('button',{name:'Revocar y borrar contenido'}).click();await page.getByText(/Estado: Revocada/).waitFor();
    assert.equal(writes,2);assert.equal(await page.getByText(/synthetic-source/).count(),0);
    page.once('dialog',(d:any)=>d.accept());await page.getByRole('button',{name:'Purgar material no vigente de esta consulta'}).click();await page.getByText(/No hay solicitudes/).waitFor();assert.equal(writes,3);
    rows=[{...seed(),expires_at:new Date(Date.now()+2200).toISOString()}];await refresh.click();await page.getByText(/synthetic-source/).waitFor();await page.getByText(/· Vencida/).waitFor();
    assert.equal(await page.getByText(/synthetic-source/).count(),0);assert.equal(await page.getByRole('button',{name:'Marcar revisada'}).isDisabled(),true);
    if(!mobile){delay=16000;await refresh.click();await page.getByText(/Estado no confirmado/).waitFor({timeout:20000});assert.equal(await refresh.isEnabled(),true);}
    rows=[seed()];delay=500;await refresh.click();await page.evaluate(()=> (window as any).syntheticSignOut());await page.getByText(/Sesión cambiada/).waitFor();await page.waitForTimeout(650);assert.equal(await page.getByText(/synthetic-source/).count(),0);
    assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await context.close();
  }
  console.log('Cycle D browser desktop/touch mobile: metadata, cancellation, acknowledgement loss, reconciliation, revoke, purge, expiry and lost session passed; external network denied.');
}finally{await browser?.close();await vite.close();if(server){server.closeAllConnections();await new Promise<void>(r=>server!.close(()=>r()));}}
