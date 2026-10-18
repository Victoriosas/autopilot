import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function node(){return {children:[] as any[],textContent:'',value:'',hidden:true,disabled:false,checked:true,events:{} as any,dataset:{} as any,append(...items:any[]){this.children.push(...items);},replaceChildren(...items:any[]){this.children=items;},addEventListener(event:string,fn:any){this.events[event]=fn;},removeAttribute(k:string){delete (this as any)[k];},setAttribute(k:string,v:string){(this as any)[k]=v;},focus(){},reportValidity(){return true;}};}
async function browser(catalog:any,fail=false,requestsEnabled=true,configFail=false){
 const nodes:Record<string,any>={};for(const id of ['consulta-form','envio','resumen','estado-ficha','estado-registro','registrar','recibo','estado-copia','servicio','consentimiento','enviar-whatsapp','copiar-ficha','servicios','propuesta-precios','catalogo-publico','estado-catalogo','catalogo-servicios'])nodes[id]=node();nodes['consulta-form'].elements=[nodes.servicio,nodes.consentimiento,node()];
 const values:any={nombre:'Test',apellido:'Client',contacto:'test@example.test',barrio:'Carrasco',horario:'Monday'};let posted:any,reads=0;
 const context={document:{getElementById:(id:string)=>nodes[id],querySelectorAll:()=>[],createElement:()=>node()},location:{search:''},URLSearchParams,AbortSignal,encodeURIComponent,crypto:{randomUUID:()=> '8f7c7698-cdbe-4a77-8a86-5a1d090284b5'},FormData:class{get(k:string){reads++;return k==='servicio'?nodes.servicio.value:values[k];}},navigator:{clipboard:{}},fetch:async(path:string,options:any)=>{if(path.endsWith('config')){if(configFail)throw Error('unavailable');return{ok:true,json:async()=>({requestsEnabled})};}if(path.endsWith('catalog')){if(fail)throw Error('unavailable');return{ok:true,json:async()=>catalog};}posted=JSON.parse(options.body);return{ok:true,json:async()=>({id:posted.id,status:'pending'})};}};
 vm.runInNewContext(readFileSync('public/beauty-services.js','utf8'),context);await new Promise(resolve=>setImmediate(resolve));return {nodes,posted:()=>posted,reads:()=>reads,submit:()=>nodes['consulta-form'].events.submit({preventDefault(){}})};
}
const approved={id:'facial-personalizado',request_service:'facial',category:'facial',title:'Facial <img src=x>',description:'Cosmético personalizado',duration_minutes:75,price_uyu:3600,conditions:'Traslado aparte',availability:'Lunes',version:1};
test('public catalog renders DTO safely and submits catalog ID plus request service',async()=>{
 const b=await browser({catalogEnabled:true,services:[approved]});assert.equal(b.nodes['propuesta-precios'].hidden,true);assert.equal(b.nodes.servicios.hidden,true);assert.equal(b.nodes['catalogo-servicios'].children.length,1);assert.equal(b.nodes.servicio.children[1].value,approved.id);assert.equal(b.nodes['catalogo-servicios'].children[0].children[0].textContent,approved.title);
 b.nodes.servicio.value=approved.id;b.submit();await b.nodes.registrar.events.click();assert.equal(b.posted().catalogServiceId,approved.id);assert.equal(b.posted().service,'facial');assert.match(b.nodes.resumen.textContent,/Facial <img src=x>/);
});
test('empty, failed and malformed catalogs fail closed with no legacy price fallback',async()=>{
 for(const [catalog,fail] of [[{catalogEnabled:true,services:[]},false],[{},true],[{catalogEnabled:true,services:[{...approved,price_uyu:null}]},false]] as const){const b=await browser(catalog,fail);assert.equal(b.nodes['propuesta-precios'].hidden,true);assert.equal(b.nodes.servicios.hidden,true);assert.equal(b.nodes.registrar.disabled,true);b.nodes.servicio.value='Limpieza de cutis y facial cosmético';b.submit();await b.nodes.registrar.events.click();assert.equal(b.posted(),undefined);}
});
test('disabled catalog and disabled or failed registration never collect form data',async()=>{
 for(const [catalog,requests,configFail] of [[{catalogEnabled:false,services:[]},true,false],[{catalogEnabled:true,services:[approved]},false,false],[{catalogEnabled:true,services:[approved]},true,true]] as const){
  const b=await browser(catalog,false,requests,configFail);assert.equal(b.nodes['propuesta-precios'].hidden,true);assert.equal(b.nodes.servicios.hidden,true);assert.equal(b.nodes.registrar.disabled,true);
  assert.ok(b.nodes['consulta-form'].elements.every((control:any)=>control.disabled));b.nodes.servicio.value=approved.id;b.submit();await b.nodes.registrar.events.click();assert.equal(b.reads(),0);assert.equal(b.posted(),undefined);assert.equal(b.nodes.resumen.textContent,'');
 }
});
