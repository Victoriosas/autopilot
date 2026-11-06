// Local-only synthetic UI smoke for Victoria's private 17-treatment review screen.
// Creates a disposable Vite entry and mocks every request; never touches Supabase/Resend.
import assert from 'node:assert/strict';
import express from 'express';
import React from 'react';
import { createServer as createViteServer } from 'vite';
import react from '@vitejs/plugin-react';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { once } from 'node:events';
import { consultationKnowledge } from '../src/storefront/consultationKnowledge';

const root = process.cwd();
const entryPath = join(root,'src','__f2_review_probe.tsx');
if (existsSync(entryPath)) throw Error('Refusing to replace another probe entry');
writeFileSync(entryPath, `import React from 'react'; import {createRoot} from 'react-dom/client'; import {ConsultationLabPanel} from './components/admin/ConsultationLabPanel'; createRoot(document.getElementById('root')!).render(<ConsultationLabPanel />);`);
let server: ReturnType<express.Express['listen']> | undefined;
let vite: Awaited<ReturnType<typeof createViteServer>> | undefined;
let browser: any;
let writes = 0;
let entries: any[] = [];
try {
  const app=express();
  app.use(express.json({limit:'16kb'}));
  app.get('/api/beauty/inquiries/admin/lab/knowledge', (_req,res)=>res.json({services:consultationKnowledge.services.map(s=>({slug:s.slug,name:s.name})),entries}));
  app.post('/api/beauty/inquiries/admin/lab/knowledge',(req,res)=>{
    writes++;
    const b=req.body;
    if(b.approvedForAI!==false || b.priceApproved!==false || typeof b.description!=='string' || b.slug!==consultationKnowledge.services[0].slug || b.version!==0)
      return res.status(400).json({error:'MOCK_UNEXPECTED_WRITE'});
    entries=[{...b,version:1}];
    return res.json({saved:true});
  });
  app.get('/__f2',(req,res)=>res.type('html').send('<html><head><meta charset="utf-8"></head><body><div id="root"></div><script type="module" src="/src/__f2_review_probe.tsx"></script></body></html>'));
  vite=await createViteServer({root,plugins:[react()],server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});
  app.use(vite.middlewares);
  server=app.listen(0,'127.0.0.1'); await once(server,'listening');
  const url='http://127.0.0.1:'+(server.address() as any).port;
  const {chromium}=await import(process.env.CONSULTATION_PLAYWRIGHT_MODULE||'playwright');
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  const page=await browser.newPage({viewport:{width:1180,height:900}});
  const errors:string[]=[];
  page.on('pageerror',(e:any)=>errors.push(e.message));
  await page.route('**/*',(route:any)=>{
    const req=route.request();
    const parsed=new URL(req.url());
    if(parsed.origin===url && ['GET','POST'].includes(req.method()))return route.continue();
    return route.abort('blockedbyclient');
  });
  const response=await page.goto(url+'/__f2',{waitUntil:'domcontentloaded',timeout:25000});
  assert.equal(response?.status(),200);
  const reviewSummary = page.locator('summary').filter({hasText:'Fichas privadas para Victoria'});
  if (!await reviewSummary.evaluate((element: HTMLElement) => (element.parentElement as HTMLDetailsElement).open)) await reviewSummary.click();
  await page.getByRole('button',{name:'Cargar los 17 tratamientos'}).click();
  await page.getByLabel('Avance de revisión profesional').getByRole('status').waitFor();
  assert.match(await page.getByLabel('Avance de revisión profesional').innerText(),/17 sin ficha/);
  assert.equal(await page.locator('#consultation-knowledge-service option').count(),18);
  const first=consultationKnowledge.services[0].slug,second=consultationKnowledge.services[1].slug;
  await page.locator('#consultation-knowledge-service').selectOption(first);
  assert.equal(await page.getByRole('button',{name:'Guardar versión privada'}).isDisabled(),true);
  await page.locator('#consultation-knowledge-description').fill('PRUEBA TÉCNICA F2, texto sin aprobación para IA.');
  assert.equal(await page.locator('input[type=checkbox]').first().isChecked(),false);
  assert.equal(await page.getByRole('button',{name:'Guardar versión privada'}).isEnabled(),true);
  page.once('dialog',(dialog:any)=>dialog.dismiss());
  await page.locator('#consultation-knowledge-service').selectOption(second);
  assert.equal(await page.locator('#consultation-knowledge-service').inputValue(),first,'Cancelled switch must preserve unsaved draft');
  await page.getByRole('button',{name:'Guardar versión privada'}).click();
  await page.getByText('Nueva versión privada guardada.',{exact:false}).waitFor();
  const summary=await page.getByLabel('Avance de revisión profesional').innerText();
  assert.match(summary,/16 sin ficha/);
  assert.match(summary,/1 borradores/);
  assert.match(summary,/0 descripciones aprobadas/);
  assert.equal(writes,1);
  assert.equal(entries[0].approvedForAI,false);
  assert.equal(entries[0].priceApproved,false);
  assert.equal(await page.locator('#consultation-knowledge-service').inputValue(),first);
  // Use a portable default; Codex/CI can override the screenshot destination.
  const screenshotPath = process.env.F2_SCREENSHOT_PATH || join(tmpdir(), 'victoriosas-f2-review-local-1180.png');
  await page.screenshot({path:screenshotPath,fullPage:false});
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({localOnly:true,screenshotPath,savedMocks:writes,services:17,missing:16,draft:1,approvedForAI:0,switchGuard:'passed',errors,emailsSent:0,remoteCalls:0}));
} finally {
  if(browser)await browser.close().catch(()=>{});
  if(vite)await vite.close().catch(()=>{});
  if(server){server.closeAllConnections(); await new Promise<void>(resolve=>server!.close(()=>resolve()));}
  unlinkSync(entryPath);
}
