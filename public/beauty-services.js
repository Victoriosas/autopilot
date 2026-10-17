(() => {
 const form=document.getElementById('consulta-form'), output=document.getElementById('envio'), summary=document.getElementById('resumen');
 const status=document.getElementById('estado-ficha'), registry=document.getElementById('estado-registro'), register=document.getElementById('registrar'), receipt=document.getElementById('recibo');
 const copyStatus=document.getElementById('estado-copia');
 const services={'Limpieza de cutis y facial cosmético':'facial','Masaje de relajación':'massage','Ritual rostro y cuerpo':'ritual','Evaluación estética personalizada':'consultation','Quiero orientación para elegir':'consultation'};
 const sourceValue=new URLSearchParams(location.search).get('origen');
 const source=['instagram','facebook','whatsapp','recomendacion'].includes(sourceValue)?sourceValue:'web';
 let ready=false,payload=null,reference='',pending=false,receiptText='';
 fetch('/api/beauty/config',{cache:'no-store',signal:AbortSignal.timeout(15000)}).then(r=>r.ok?r.json():null).then(config=>{
  ready=config?.requestsEnabled===true;
  register.disabled=!ready;
  if(!ready)registry.textContent='El registro todavía no está habilitado. Podés consultar por WhatsApp sin registrar datos en la web.';
 }).catch(()=>{registry.textContent='No pudimos comprobar el registro. Usá la consulta directa de WhatsApp.';});
 function invalidate(){
  if(pending)return;
  payload=null;reference='';receiptText='';output.hidden=true;receipt.hidden=true;summary.textContent='';copyStatus.textContent='';status.textContent='';
  document.getElementById('enviar-whatsapp').removeAttribute('href');register.disabled=!ready;
 }
 document.querySelectorAll('[data-service]').forEach(link=>link.addEventListener('click',event=>{if(pending){event.preventDefault();return;}document.getElementById('servicio').value=link.dataset.service;invalidate();}));
 form.addEventListener('input',invalidate);form.addEventListener('change',invalidate);
 form.addEventListener('reset',()=>{invalidate();if(!pending)status.textContent='Ficha vaciada en este navegador. Esto no elimina una solicitud ya registrada; contactá a Sofía indicando su referencia si necesitás retirarla.';});
 form.addEventListener('submit',event=>{
  event.preventDefault();if(pending||!form.reportValidity())return;
  const data=new FormData(form),value=k=>String(data.get(k)||'').trim();
  if(!crypto.randomUUID){status.textContent='Necesitás un navegador actualizado y una conexión segura. Podés consultar directamente por WhatsApp.';return;}
  reference=reference||crypto.randomUUID();
  payload={id:reference,firstName:value('nombre'),lastName:value('apellido'),contact:value('contacto'),zone:value('barrio'),service:services[value('servicio')],availability:value('horario'),source,consent:document.getElementById('consentimiento').checked,consentVersion:'beauty-v1'};
  summary.textContent=['Nombre: '+payload.firstName+' '+payload.lastName,'Contacto: '+payload.contact,'Zona: '+payload.zone,'Servicio: '+value('servicio'),'Preferencia: '+(payload.availability||'A coordinar')].join('\n');
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
