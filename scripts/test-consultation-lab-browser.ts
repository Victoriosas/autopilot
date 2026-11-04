// Synthetic-only browser harness. Uses real local Supabase and the actual UI
// components, with every owner notification intercepted by the Resend adapter.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import { once } from 'node:events';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { createServer as createViteServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createConsultationRouter } from '../src/storefront/consultationRouter';
import { createConsultationDelivery } from '../src/storefront/consultationDelivery';

assert.equal(process.env.BEAUTY_SYNTHETIC_SUPABASE, 'true');
const config = JSON.parse(readFileSync(process.env.SUPABASE_LOCAL_STATUS_FILE!, 'utf8'));
assert.equal(config.API_URL, 'http://127.0.0.1:54321');
const publicKey = config.ANON_KEY || config.PUBLISHABLE_KEY;
const serviceKey = config.SERVICE_ROLE_KEY || config.SECRET_KEY;
Object.assign(process.env, { SUPABASE_URL:config.API_URL, SUPABASE_ANON_KEY:publicKey, SUPABASE_SERVICE_ROLE_KEY:serviceKey,
  CONSULTATION_AUTO_REPLY_ENABLED:'true', CONSULTATION_REPLY_SENDING_ENABLED:'true', AUTOPILOT_RUNTIME:'synthetic-test',
  CONSULTATION_MAIL_PROVIDER:'resend',CONSULTATION_MAIL_FROM:'consultas@victoriosas.online',RESEND_API_KEY:'synthetic-not-a-credential' });
const service = createClient(config.API_URL,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const caller = createClient(config.API_URL,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
const email='lab-'+randomUUID()+'@example.test', password='Synthetic-'+randomUUID()+'-9a!';
const created = await service.auth.admin.createUser({email,password,email_confirm:true});
assert.equal(created.error,null);const actor=created.data.user!.id;
let server: ReturnType<typeof express.application.listen> | undefined;
let vite: Awaited<ReturnType<typeof createViteServer>> | undefined;
let browser: any;
let notifications=0;
let replies=0;
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.href==='https://api.resend.com/emails'){
    assert.equal(init?.method,'POST');replies++;
    return new Response(JSON.stringify({id:'synthetic-reply-'+replies}),{status:200});
  }
  assert.equal(url.hostname,'127.0.0.1','only disposable services or simulated Resend are allowed');
  return originalFetch(input,init);
};
try {
  assert.equal((await service.from('profiles').upsert({id:actor,role:'admin'})).error,null);
  const login=await caller.auth.signInWithPassword({email,password});assert.equal(login.error,null);
  const session=login.data.session!;
  const delivery=createConsultationDelivery({env:{CONSULTATION_MAIL_ENABLED:'true',CONSULTATION_MAIL_PROVIDER:'resend',
    RESEND_API_KEY:'synthetic-not-a-credential',CONSULTATION_MAIL_FROM:'consultas@victoriosas.online',CONSULTATION_MAIL_TO:'victoriosas.online@gmail.com'},
    fetch:async(url,init)=>{assert.equal(url,'https://api.resend.com/emails');
      const payload=JSON.parse(init!.body as string);assert.ok(!payload.text.includes('Caso sintético'));notifications++;
      return new Response(JSON.stringify({id:'synthetic-notice-'+notifications}));},
  });
  const app=express();
  const abuseSecret=randomUUID(); // Isolates repeated synthetic runs, preserving replay and throttling within each run.
  app.use('/api/beauty/inquiries',createConsultationRouter({enabled:()=>true,origin:()=> 'https://victoriosas.online',abuseKey:()=> abuseSecret,delivery}));
  vite=await createViteServer({configFile:false,root:process.cwd(),plugins:[react(),tailwindcss(),{
    name:'synthetic-consultation-entry',
    resolveId(id){if(id==='/__consultation_test_entry.js')return '\0consultation-test-entry';},
    load(id){if(id!=='\0consultation-test-entry')return;
      return `import React from 'react';import {createRoot} from 'react-dom/client';
        import '/src/index.css';import supabase from '/src/lib/supabase.ts';
        import {ConsultationForm} from '/src/components/public/ConsultationForm.tsx';
        import {ConsultationLabPanel} from '/src/components/admin/ConsultationLabPanel.tsx';
        import {ConsultationInbox} from '/src/components/admin/ConsultationInbox.tsx';
        await supabase.auth.setSession(${JSON.stringify({access_token:session.access_token,refresh_token:session.refresh_token})});
        createRoot(document.getElementById('root')).render(new URLSearchParams(location.search).has('inbox')?React.createElement(ConsultationInbox):React.createElement('main',{className:'bg-neutral-950 text-white p-6'},React.createElement(ConsultationForm),React.createElement(ConsultationLabPanel)));`;
    },
  }],define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('https://victoriosas.online/__supabase'),'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify(publicKey)},
    server:{middlewareMode:true,hmr:false},appType:'custom'});
  app.get('/__consultation_test',async(_req,res)=>res.type('html').send(await vite!.transformIndexHtml('/__consultation_test','<html lang="es"><head><meta charset="utf-8"></head><body><div id="root"></div><script type="module" src="/__consultation_test_entry.js"></script></body></html>')));
  app.use(vite.middlewares);server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const local=`http://127.0.0.1:${(server.address() as any).port}`;
  const {chromium}=await import(process.env.CONSULTATION_PLAYWRIGHT_MODULE || 'playwright');
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true});
  const page=await browser.newPage({viewport:{width:1100,height:900}});
  page.on('requestfailed',(request:any)=>console.log('Synthetic browser request failed:',new URL(request.url()).pathname));
  // Production URL is a browser origin fixture only: EVERY request is intercepted.
  // No request to Victoriosas production, camelRun or Resend can leave this page.
  await page.route('**/*',async(route:any)=>{
    const url=new URL(route.request().url());
    if(url.origin==='https://victoriosas.online') {
      const destination=url.pathname.startsWith('/__supabase/')?config.API_URL+url.pathname.slice('/__supabase'.length)+url.search:local+url.pathname+url.search;
      return route.fulfill({response:await route.fetch({url:destination})});
    }
    return route.abort('blockedbyclient');
  });
  await page.goto('https://victoriosas.online/__consultation_test');
  console.log('Synthetic browser mounted.');
  const submit=page.getByRole('button',{name:'Enviar consulta',exact:true});await submit.waitFor();
  await page.waitForFunction(()=>!(document.querySelector('button[type=submit]') as HTMLButtonElement)?.disabled);
  await page.locator('[name=fullName]').fill('Caso sintético');await page.locator('[name=phone]').fill('00000000');
  await page.locator('[name=message]').fill('Quisiera información sobre limpieza profunda.');
  await page.locator('[name=email]').fill('fixture@example.test');
  await page.locator('[name=consent]').check();await page.locator('[name=aiConsent]').check();
  const submission=page.waitForResponse((r:any)=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/beauty/inquiries');
  await submit.click();const receipt=await submission;assert.equal(receipt.status(),202);
  console.log('Synthetic form accepted.');
  const body=receipt.request().postDataJSON();
  const replay=await fetch(local+'/api/beauty/inquiries',{method:'POST',headers:{origin:'https://victoriosas.online','content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal(replay.status,202);assert.equal(notifications,1);
  assert.equal(replies,0,'historical automatic flags cannot send a customer reply');
  const persisted=await caller.from('consultation_requests').select('id,input').eq('id',body.id);assert.equal(persisted.data!.length,1);
  await page.getByText('Fichas privadas para Victoria',{exact:true}).click();
  await page.getByRole('button',{name:'Cargar los 17 tratamientos',exact:true}).click();
  await page.getByLabel('Tratamiento',{exact:true}).selectOption('limpieza-profunda');
  const approvedDescription='Ficha sintética: información general revisada exclusivamente para esta prueba.';
  await page.getByLabel('Descripción para IA',{exact:true}).fill(approvedDescription);
  await page.getByLabel('Victoria aprobó expresamente la descripción para IA',{exact:true}).check();
  const knowledgeSaved=page.waitForResponse((r:any)=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/beauty/inquiries/admin/lab/knowledge');
  await page.getByRole('button',{name:'Guardar versión privada',exact:true}).click();
  assert.equal((await knowledgeSaved).status(),200);
  await page.getByText('Nueva versión privada guardada.',{exact:false}).waitFor();
  await page.getByText('Fichas privadas para Victoria',{exact:true}).click();
  const labButton=page.getByRole('button',{name:'Probar IA (simulación)',exact:true});
  const labResponse=page.waitForResponse((r:any)=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/beauty/inquiries/admin/lab');
  await labButton.click();const labReply=await labResponse;
  console.log('Synthetic laboratory HTTP status:',labReply.status());
  assert.equal(labReply.status(),200,await labReply.text());
  const labResult=await labReply.json();assert.equal(labResult.analysis.evidence[0].fragment,approvedDescription);
  await page.getByText('Borrador no enviado · Revisión humana obligatoria', {exact:false}).waitFor();
  assert.equal(notifications,1);
  mkdirSync('output/consultation-lab',{recursive:true});
  await page.screenshot({path:'output/consultation-lab/synthetic-browser.png',fullPage:true});
  // Reproduces why enabled=true alone does not prove the browser's complete
  // privacy/retention contract. This is NOT evidence of the production cause.
  await page.route('**/api/beauty/inquiries/config',async(route:any)=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({enabled:true})}));
  await page.reload();await page.getByText('El formulario está temporalmente sin conexión.',{exact:false}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Enviar consulta',exact:true}).isDisabled(),true);
  await page.screenshot({path:'output/consultation-lab/config-contract-mismatch.png',fullPage:true});
  await page.unroute('**/api/beauty/inquiries/config');
  await page.goto('https://victoriosas.online/__consultation_test?inbox=1');
  const row=page.locator('li').filter({hasText:'Referencia: '+body.id});
  await row.getByRole('button',{name:'Preparar respuesta',exact:true}).click();
  const approve=row.getByRole('button',{name:'Aprobar y enviar por correo (Resend)',exact:true});
  await approve.waitFor();
  assert.equal(await row.getByRole('button',{name:'Copiar borrador de WhatsApp',exact:true}).count(),1);
  await row.getByText('Preferencia: WhatsApp',{exact:true}).waitFor();
  page.once('dialog',(dialog:any)=>dialog.dismiss());await approve.click();assert.equal(replies,0);
  page.once('dialog',(dialog:any)=>dialog.accept());
  const sent=page.waitForResponse((r:any)=>new URL(r.url()).pathname.endsWith('/approve-send'));
  await approve.click();assert.equal((await sent).status(),200);assert.equal(replies,1);
  const approveReply=(id:string,extra:Record<string,string>={})=>fetch(local+'/api/beauty/inquiries/admin/'+id+'/approve-send',{
    method:'POST',headers:{origin:'https://victoriosas.online',authorization:'Bearer '+session.access_token,'x-consultation-approval':id,...extra}});
  assert.equal((await approveReply(body.id)).status,409);assert.equal(replies,1);
  for(const responseChannel of ['phone','email'] as const){
    const input={...body,id:randomUUID(),responseChannel};
    assert.equal((await fetch(local+'/api/beauty/inquiries',{method:'POST',headers:{origin:'https://victoriosas.online','content-type':'application/json'},body:JSON.stringify(input)})).status,202);
    assert.equal((await approveReply(input.id,{authorization:''})).status,401);
    assert.equal((await approveReply(input.id,{origin:'https://invalid.example.test'})).status,403);
    assert.equal((await approveReply(input.id,{'x-consultation-approval':''})).status,400);
    assert.equal((await approveReply(input.id)).status,200);
    assert.equal((await approveReply(input.id)).status,409);
    const saved=await caller.from('consultation_requests').select('input').eq('id',input.id).single();
    assert.equal(saved.error,null);assert.equal(saved.data!.input.responseChannel,responseChannel);
  }
  assert.equal(replies,3);
  const noEmail={...body,id:randomUUID(),email:''};
  assert.equal((await fetch(local+'/api/beauty/inquiries',{method:'POST',headers:{origin:'https://victoriosas.online','content-type':'application/json'},body:JSON.stringify(noEmail)})).status,202);
  assert.equal((await approveReply(noEmail.id)).status,409);assert.equal(replies,3);
  assert.equal(notifications,4,'each distinct synthetic consultation notifies the owner once');
  await page.reload();const withoutEmail=page.locator('li').filter({hasText:'Referencia: '+noEmail.id});
  await withoutEmail.getByRole('button',{name:'Preparar respuesta',exact:true}).click();
  await withoutEmail.getByText('No se proporcionó un email válido.',{exact:false}).waitFor();
  assert.equal(await withoutEmail.getByRole('button',{name:'Aprobar y enviar por correo (Resend)',exact:true}).count(),0);
  console.log(JSON.stringify({synthetic:true,form:'accepted',supabaseRows:persisted.data!.length,idempotentReplay:'accepted',ownerNoticesIntercepted:notifications,simulatedApprovedReplies:replies,realEmails:0,remoteModelCalls:0,lab:'simulation_no_send'}));
} finally {
  await browser?.close();await vite?.close();server?.closeAllConnections();if(server)await new Promise<void>(r=>server!.close(()=>r()));
  await service.auth.admin.deleteUser(actor);
  globalThis.fetch=originalFetch;
}
