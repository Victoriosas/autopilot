import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('browser logic preserves receipt on retry, blocks edits while pending and shares no form data',async()=>{
 const nodes:Record<string,any>={};
 for(const id of ['consulta-form','envio','resumen','estado-ficha','estado-registro','registrar','recibo','estado-copia','servicio','consentimiento','enviar-whatsapp','copiar-ficha']) nodes[id]={textContent:'',value:'',checked:true,disabled:false,hidden:true,events:{} as any,addEventListener(event:string,fn:any){this.events[event]=fn;},setAttribute(k:string,v:string){this[k]=v;},removeAttribute(k:string){delete this[k];},focus(){},reportValidity(){return true;}};
 nodes['consulta-form'].elements=[];
 const link={...nodes['servicio'],events:{} as any,dataset:{service:'Ritual rostro y cuerpo'}};
 const values:Record<string,string>={nombre:'Synthetic',apellido:'Client',contacto:'fixture@example.test',barrio:'Solymar',servicio:'Limpieza de cutis y facial cosmético',horario:'Lunes'};
 let uuidCalls=0,resolvePost:any,copied='',request:any;
 const context={document:{getElementById:(id:string)=>nodes[id],querySelectorAll:()=>[link]},location:{search:'?origen=instagram'},URLSearchParams,AbortSignal,encodeURIComponent,crypto:{randomUUID:()=>{uuidCalls++;return '8f7c7698-cdbe-4a77-8a86-5a1d090284b5';}},FormData:class{get(k:string){return values[k];}},navigator:{clipboard:{writeText:async(text:string)=>{copied=text;}}},fetch:async(path:string,options:any)=>{
  if(path.endsWith('config'))return{ok:true,json:async()=>({requestsEnabled:true})};
  request=JSON.parse(options.body);return new Promise(resolve=>{resolvePost=resolve;});
 }};
 vm.runInNewContext(readFileSync('public/beauty-services.js','utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));
 const submit=()=>nodes['consulta-form'].events.submit({preventDefault(){}});
 submit();submit();assert.equal(uuidCalls,1);
 const saving=nodes.registrar.events.click();
 let blocked=false;link.events.click({preventDefault(){blocked=true;}});assert.equal(blocked,true);assert.equal(nodes.servicio.value,'');
 resolvePost({ok:false,json:async()=>({error:'BEAUTY_UNAVAILABLE'})});await saving;
 assert.equal(nodes.recibo.hidden,true);assert.match(nodes['estado-registro'].textContent,/No pudimos confirmar/);
 const retry=nodes.registrar.events.click();resolvePost({ok:true,json:async()=>({id:request.id,status:'pending'})});await retry;
 assert.equal(uuidCalls,1);assert.equal(nodes.recibo.hidden,false);
 const shared=decodeURIComponent(nodes['enviar-whatsapp'].href);
 assert.ok(!shared.includes('fixture@example.test'));assert.ok(!shared.includes('Solymar'));assert.ok(!shared.includes('Synthetic'));
 assert.equal(request.source,'instagram');assert.ok(!('skin' in request));
 await nodes['copiar-ficha'].events.click();assert.ok(copied.includes(request.id));assert.ok(!copied.includes('fixture@example.test'));
 nodes['consulta-form'].events.input();assert.equal(nodes.envio.hidden,true);assert.equal(nodes['enviar-whatsapp'].href,undefined);
});
