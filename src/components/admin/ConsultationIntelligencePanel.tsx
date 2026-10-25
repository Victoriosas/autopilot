import React,{useEffect,useRef,useState} from 'react';
import type { IntelligenceAnalysis } from '../../storefront/consultationIntelligence';
import type { prepareIntelligenceOperations } from '../../storefront/consultationIntelligenceOperations';
// Import browser auth only on interaction; SSR/tests do not initialize a remote client.
const apiFetch=async(path:string,options?:RequestInit)=>(await import('../../lib/api')).apiFetch(path,options);

const topics:Record<string,string>={price:'Precio',service:'Información del servicio',duration:'Duración',availability:'Disponibilidad',location:'Lugar de atención',gift:'Regalo',complaint:'Reclamo',unknown:'Pregunta por aclarar'};
export function ConsultationIntelligencePanel({requestId,enabled}:{requestId:string;enabled:boolean}){
 const [result,setResult]=useState<{id:string;analysis:IntelligenceAnalysis}|null>(null);
 const [choice,setChoice]=useState(0),[text,setText]=useState(''),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
 const [operations,setOperations]=useState<ReturnType<typeof prepareIntelligenceOperations>|null>(null);
 const [eventKind,setEventKind]=useState('proposal_confirmed'),[occurredAt,setOccurredAt]=useState(''),[consentReference,setConsentReference]=useState('');
 const alive=useRef(true),sequence=useRef(0);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;sequence.current++;};},[]);
 const path='/api/beauty/inquiries/admin/'+encodeURIComponent(requestId)+'/intelligence';
 async function analyze(){
  const version=++sequence.current;setBusy(true);setStatus('');setResult(null);setText('');
  try{
   const response=await apiFetch(path,{method:'POST',headers:{'content-type':'application/json','x-consultation-approval':requestId},body:'{}'});
   if(response.status===202){if(alive.current&&version===sequence.current)setStatus('Análisis en proceso. Volvé a consultar para recuperar el resultado.');return;}
   if(!response.ok)throw Error();const payload=await response.json();
   if(!payload.id||!payload.analysis||payload.analysis.mode!=='shadow'||payload.analysis.drafts?.length!==3)throw Error();
   if(alive.current&&version===sequence.current){setResult(payload);setChoice(0);setText(payload.analysis.drafts[0].text);}
  }catch{if(alive.current&&version===sequence.current)setStatus('No se pudo recuperar un análisis confirmado. Revisá la configuración o intentá actualizar.');}
  finally{if(alive.current&&version===sequence.current)setBusy(false);}
 }
 async function review(action:'approve'|'reject'){
  if(!result)return;const version=++sequence.current;setBusy(true);setStatus('');
  try{
   const response=await apiFetch(path+'/'+encodeURIComponent(result.id)+'/review',{method:'POST',headers:{'content-type':'application/json','x-consultation-approval':requestId},body:JSON.stringify({text,action})});
   if(!response.ok)throw Error();const payload=await response.json();
   if(!['approved_for_review_only','rejected'].includes(payload.status))throw Error();
   if(alive.current&&version===sequence.current)setStatus(payload.status==='rejected'?'Borrador rechazado y registrado.':'Validación registrada para este texto. No se envió ninguna respuesta.');
  }catch{if(alive.current&&version===sequence.current)setStatus('No se confirmó la revisión. Una edición, cambio de información o vencimiento exige volver a validar.');}
  finally{if(alive.current&&version===sequence.current)setBusy(false);}
 }
 async function loadOperations(){try{const response=await apiFetch(path+'/operations');if(!response.ok)throw Error();const data=await response.json();if(alive.current)setOperations(data);}catch{if(alive.current)setStatus('No se pudo confirmar el historial de seguimiento.');}}
 async function recordEvent(kind=eventKind,sourceKey?:string){
  if(!result)return;setBusy(true);setStatus('');try{
   const payload={occurredAt:kind==='followup_proposed'?new Date().toISOString():new Date(occurredAt).toISOString(),...(kind==='consent_recorded'?{consentReference}:{}),...(sourceKey?{sourceKey}:{})};
   const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(requestId+kind+JSON.stringify(payload)));
   const key=Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,'0')).join('');
   const response=await apiFetch(path+'/'+result.id+'/event',{method:'POST',headers:{'content-type':'application/json','x-consultation-approval':requestId},body:JSON.stringify({kind,key,payload})});
   if(!response.ok||!(await response.json()).recorded)throw Error();if(alive.current)setStatus('Evento registrado. No se envió ningún mensaje.');await loadOperations();
  }catch{if(alive.current)setStatus('No se pudo confirmar el evento. Revisá fecha, consentimiento y estado.');}finally{if(alive.current)setBusy(false);}
 }
 return <div className="mt-4 rounded-lg border border-neutral-600 bg-neutral-950 p-4">
  <h4 className="font-semibold">Asistencia con evidencia · Modo sombra</h4>
  <p className="my-2 text-sm">Analiza y prepara borradores; no envía mensajes. Validar un texto no lo marca como respondido.</p>
  <button type="button" className="min-h-11 rounded border border-amber-500 px-3 py-2" disabled={!enabled||busy} onClick={()=>void analyze()}>{busy?'Procesando…':'Analizar con evidencia'}</button>
  {!enabled&&<p className="mt-2 text-sm">Pendiente de habilitar el modo sombra y verificar su configuración.</p>}
  {result&&<div className="mt-3 space-y-3">
   <p>Revisión: {result.analysis.guardian.status==='approved'?'Controles aprobados para revisión humana':'Derivación a Victoria'}. Envío deshabilitado.</p>
   <ul className="list-disc pl-5">{result.analysis.understanding.questions.map(question=><li key={question.id}>{topics[question.topic]}: {result.analysis.unanswered.includes(question.id)?'pendiente; falta información aprobada':'con respaldo disponible'}</li>)}</ul>
   {result.analysis.understanding.risks.length>0&&<p role="status">La consulta contiene riesgos o ambigüedades y requiere intervención de Victoria.</p>}
   <details><summary className="cursor-pointer py-2">Ver respaldo y límites</summary>
    {result.analysis.evidence.map(fact=><div key={fact.id} className="my-2 rounded bg-neutral-800 p-3"><p className="whitespace-pre-wrap">{fact.fragment}</p><p className="mt-1 text-sm">Fuente: {fact.service?'Ficha publicada del servicio':'Política publicada de atención'} · Versión {fact.version} · {fact.owner}</p></div>)}
    {!result.analysis.evidence.length&&<p>No hay evidencia suficiente para responder.</p>}
    <p className="text-sm">La información general no confirma aptitud personal, tarifas ni agenda. Las preguntas pendientes quedan visibles.</p>
   </details>
   <div className="flex flex-wrap gap-2" role="group" aria-label="Alternativas de respuesta">{result.analysis.drafts.map((draft,index)=><button type="button" key={draft.id} aria-pressed={choice===index} disabled={busy} className="min-h-11 rounded border border-neutral-500 px-3 py-2" onClick={()=>{setChoice(index);setText(draft.text);setStatus('');}}>{draft.title}</button>)}</div>
   <label className="block">Texto para revisar<textarea className="mt-2 min-h-40 w-full rounded border border-neutral-500 bg-neutral-900 p-3" maxLength={6000} disabled={busy} value={text} onChange={event=>{setText(event.target.value);setStatus('Edición sin validar. El cambio requiere una nueva revisión.');}}/></label>
   <div className="flex flex-wrap gap-2"><button type="button" disabled={busy||result.analysis.guardian.status!=='approved'} className="min-h-11 rounded border border-emerald-500 px-3 py-2" onClick={()=>void review('approve')}>Validar texto sin enviar</button><button type="button" disabled={busy} className="min-h-11 rounded border border-neutral-500 px-3 py-2" onClick={()=>void review('reject')}>Rechazar borrador</button></div>
   <details><summary className="cursor-pointer py-2">Seguimiento con consentimiento registrado</summary>
    <p className="my-2 text-sm">Registrá únicamente hechos verificados. El consentimiento del formulario no autoriza por sí solo seguimientos comerciales.</p>
    <div className="flex flex-wrap gap-3"><label>Hecho confirmado<select className="block min-h-11 max-w-full rounded bg-neutral-800 p-2" value={eventKind} onChange={e=>setEventKind(e.target.value)}><option value="proposal_confirmed">Propuesta enviada personalmente</option><option value="session_confirmed">Primera sesión realizada</option><option value="consent_recorded">Consentimiento específico documentado</option><option value="opt_out">Solicitud de baja</option></select></label>
     <label>Fecha del hecho<input className="block min-h-11 max-w-full rounded bg-neutral-800 p-2" type="datetime-local" value={occurredAt} onChange={e=>setOccurredAt(e.target.value)}/></label></div>
    {eventKind==='consent_recorded'&&<label className="my-2 block">Referencia verificable del consentimiento (UUID)<input className="block min-h-11 w-full rounded bg-neutral-800 p-2" value={consentReference} onChange={e=>setConsentReference(e.target.value)} maxLength={36}/></label>}
    <div className="my-3 flex flex-wrap gap-2"><button type="button" disabled={busy||!occurredAt} className="min-h-11 rounded border px-3 py-2" onClick={()=>void recordEvent()}>Registrar hecho verificado</button><button type="button" disabled={busy} className="min-h-11 rounded border px-3 py-2" onClick={()=>void loadOperations()}>Consultar próximos seguimientos</button></div>
    {operations&&<div><p>{operations.consentRecorded?'Consentimiento específico registrado.':'Sin consentimiento específico: no se propone seguimiento.'}</p>{operations.followups.map(draft=><div key={draft.key} className="my-3 rounded border p-3"><p className="whitespace-pre-wrap">{draft.text}</p><p>Borrador para revisión humana. No se envía desde este panel.</p><button type="button" disabled={busy} className="min-h-11 rounded border px-3 py-2" onClick={()=>void recordEvent('followup_proposed',draft.sourceKey)}>Registrar propuesta de seguimiento</button></div>)}<p className="mt-2 text-sm">{operations.reactivationReason}</p></div>}
   </details>
  </div>}
  {status&&<p className="mt-3" role="status">{status}</p>}
 </div>;
}
