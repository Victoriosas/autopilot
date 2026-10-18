(() => {
 const form=document.getElementById('consulta-form'), output=document.getElementById('envio'), summary=document.getElementById('resumen');
 const status=document.getElementById('estado-ficha'), registry=document.getElementById('estado-registro'), register=document.getElementById('registrar'), receipt=document.getElementById('recibo');
 const copyStatus=document.getElementById('estado-copia');
 const sourceValue=new URLSearchParams(location.search).get('origen');
 const source=['instagram','facebook','whatsapp','recomendacion'].includes(sourceValue)?sourceValue:'web';
 const serviceSelect=document.getElementById('servicio'),catalogSection=document.getElementById('catalogo-publico'),catalogStatus=document.getElementById('estado-catalogo'),catalogCards=document.getElementById('catalogo-servicios');
 let ready=false,requestsReady=false,catalogMode='loading',catalogRows=[],payload=null,reference='',pending=false,receiptText='';
 function updateReady(){ready=requestsReady&&catalogMode==='active'&&catalogRows.length>0;Array.from(form.elements).forEach(control=>{control.disabled=!ready||pending;});register.disabled=!ready||pending||!payload||!receipt.hidden;}
 function element(tag,text){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;}
 // Only the verified managed catalog may expose services and approved prices.
 document.getElementById('servicios').hidden=true;document.getElementById('propuesta-precios').hidden=true;
 catalogSection.hidden=false;updateReady();
 fetch('/api/beauty/catalog',{cache:'no-store',signal:AbortSignal.timeout(15000)}).then(async response=>{
  if(!response.ok)throw new Error();const body=await response.json();
  if(body.catalogEnabled===false){catalogMode='disabled';catalogRows=[];catalogCards.replaceChildren();serviceSelect.replaceChildren();catalogStatus.textContent='El catálogo está deshabilitado. Consultá directamente por WhatsApp.';updateReady();return;}
  if(body.catalogEnabled!==true||!Array.isArray(body.services))throw new Error();
  const ids=new Set();
  const valid=body.services.every(row=>row&&typeof row.id==='string'&&/^[a-z][a-z0-9-]{1,63}$/.test(row.id)&&!ids.has(row.id)&&ids.add(row.id)&&['facial','massage','ritual','consultation'].includes(row.request_service)&&['title','description','conditions','availability'].every(key=>typeof row[key]==='string')&&row.title.trim()&&Number.isInteger(row.duration_minutes)&&row.duration_minutes>0&&typeof row.price_uyu==='number'&&Number.isFinite(row.price_uyu)&&row.price_uyu>0);
  if(!valid)throw new Error();catalogMode='active';catalogRows=body.services;
  const placeholder=element('option','Elegí un servicio');placeholder.value='';serviceSelect.replaceChildren(placeholder);catalogCards.replaceChildren();
  catalogRows.forEach(row=>{
   const option=element('option',row.title);option.value=row.id;serviceSelect.append(option);
   const article=element('article');article.append(element('h3',row.title),element('p',row.description),element('p',`$${row.price_uyu.toLocaleString('es-UY')} UYU · ${row.duration_minutes} minutos`),element('p',row.conditions),element('p',row.availability));
   const link=element('a','Consultar por este servicio');link.className='button';link.href='#ficha';link.addEventListener('click',event=>{if(!ready||pending){event.preventDefault();return;}serviceSelect.value=row.id;invalidate();});article.append(link);catalogCards.append(article);
  });
  serviceSelect.disabled=catalogRows.length===0;catalogStatus.textContent=catalogRows.length?'Servicios disponibles para consulta. El turno y el precio total con traslado se confirman personalmente.':'No hay servicios publicados por el momento. Podés consultar directamente por WhatsApp.';updateReady();
 }).catch(()=>{catalogMode='error';catalogRows=[];catalogCards.replaceChildren();serviceSelect.replaceChildren();serviceSelect.disabled=true;catalogStatus.textContent='No pudimos comprobar el catálogo. Consultá directamente por WhatsApp; no se registrarán solicitudes con tarifas sin verificar.';updateReady();});
 fetch('/api/beauty/config',{cache:'no-store',signal:AbortSignal.timeout(15000)}).then(r=>r.ok?r.json():null).then(config=>{
  requestsReady=config?.requestsEnabled===true;
  updateReady();
  if(!ready)registry.textContent='El registro todavía no está habilitado. Podés consultar por WhatsApp sin registrar datos en la web.';
 }).catch(()=>{registry.textContent='No pudimos comprobar el registro. Usá la consulta directa de WhatsApp.';});
 function invalidate(){
  if(pending)return;
  payload=null;reference='';receiptText='';output.hidden=true;receipt.hidden=true;summary.textContent='';copyStatus.textContent='';status.textContent='';
  document.getElementById('enviar-whatsapp').removeAttribute('href');register.disabled=!ready;
 }
 document.querySelectorAll('[data-service]').forEach(link=>link.addEventListener('click',event=>{if(!ready||pending){event.preventDefault();return;}document.getElementById('servicio').value=link.dataset.service;invalidate();}));
 form.addEventListener('input',invalidate);form.addEventListener('change',invalidate);
 form.addEventListener('reset',()=>{invalidate();if(!pending)status.textContent='Ficha vaciada en este navegador. Esto no elimina una solicitud ya registrada; contactá a Sofía indicando su referencia si necesitás retirarla.';});
 form.addEventListener('submit',event=>{
  event.preventDefault();if(!ready||pending){status.textContent='El registro no está disponible. Consultá directamente por WhatsApp.';return;}if(!form.reportValidity())return;
  if(catalogMode==='loading'||catalogMode==='error'||catalogMode==='active'&&!catalogRows.length){status.textContent='El catálogo no está disponible. Consultá directamente por WhatsApp.';return;}
  const data=new FormData(form),value=k=>String(data.get(k)||'').trim();
  if(!crypto.randomUUID){status.textContent='Necesitás un navegador actualizado y una conexión segura. Podés consultar directamente por WhatsApp.';return;}
  reference=reference||crypto.randomUUID();
  const selected=catalogRows.find(row=>row.id===value('servicio'));
  if(!selected){status.textContent='Elegí un servicio del catálogo disponible.';return;}
  payload={id:reference,firstName:value('nombre'),lastName:value('apellido'),contact:value('contacto'),zone:value('barrio'),service:selected.request_service,catalogServiceId:selected.id,availability:value('horario'),source,consent:document.getElementById('consentimiento').checked,consentVersion:'beauty-v1'};
  summary.textContent=['Nombre: '+payload.firstName+' '+payload.lastName,'Contacto: '+payload.contact,'Zona: '+payload.zone,'Servicio: '+selected.title,'Preferencia: '+(payload.availability||'A coordinar')].join('\n');
  receipt.hidden=true;document.getElementById('enviar-whatsapp').removeAttribute('href');receiptText='';copyStatus.textContent='';output.hidden=false;register.disabled=!ready;
  registry.textContent=ready?'Todavía no se guardó. Revisá y pulsá Registrar solicitud.':'El registro está deshabilitado. La consulta directa de WhatsApp sigue disponible.';
  status.textContent='Resumen preparado para revisión.';summary.focus();
 });
 register.addEventListener('click',async()=>{
  if(!ready||!payload||pending)return;
  pending=true;register.disabled=true;
  const controls=Array.from(form.elements);controls.forEach(control=>{control.disabled=true;});
  document.querySelectorAll('[data-service]').forEach(link=>link.setAttribute('aria-disabled','true'));
  registry.textContent='Guardando solicitud…';
  try{
   const response=await fetch('/api/beauty/requests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
   const body=await response.json();
   if(!response.ok||body.id!==reference||!['pending','reviewing','confirmed','completed','cancelled'].includes(body.status))throw new Error();
   receiptText=`Hola Sofía, registré mi consulta en Victoriosas. Referencia: ${reference}. Quisiera coordinar los próximos pasos.`;
   document.getElementById('enviar-whatsapp').href='https://wa.me/59897045305?text='+encodeURIComponent(receiptText);
   registry.textContent='Solicitud registrada. Referencia: '+reference+'. Estado: '+({pending:'pendiente',reviewing:'en revisión',confirmed:'confirmado',completed:'realizado',cancelled:'cancelado'}[body.status])+'. No se envió ningún mensaje.';
   receipt.hidden=false;register.disabled=true;
  }catch{
   registry.textContent='No pudimos confirmar el registro. No asumas que se recibió. Podés reintentar con la misma referencia o usar WhatsApp directamente.';register.disabled=false;
  }finally{pending=false;controls.forEach(control=>{control.disabled=false;});document.querySelectorAll('[data-service]').forEach(link=>link.removeAttribute('aria-disabled'));}
 });
 document.getElementById('copiar-ficha').addEventListener('click',async()=>{
  if(!receiptText)return;
  try{await navigator.clipboard.writeText(receiptText);copyStatus.textContent='Referencia copiada; no incluye los datos de tu ficha.';}
  catch{copyStatus.textContent='No se pudo copiar. Tu referencia es: '+reference;}
 });
})();
