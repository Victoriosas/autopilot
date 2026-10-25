import React,{useRef,useEffect,useState} from 'react';
export function ConsultationIntelligenceReport({enabled}:{enabled:boolean}){
 const [report,setReport]=useState<Record<string,any>|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);const alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 async function load(){setBusy(true);setError('');try{const {apiFetch}=await import('../../lib/api');const response=await apiFetch('/api/beauty/inquiries/admin/intelligence-report');if(!response.ok)throw Error();const data=await response.json();if(alive.current)setReport(data);}catch{if(alive.current)setError('No se pudo confirmar el informe.');}finally{if(alive.current)setBusy(false);}}
 return <div className="my-4 rounded border border-neutral-600 p-4"><button type="button" disabled={!enabled||busy} className="min-h-11 rounded border border-neutral-500 px-3 py-2" onClick={()=>void load()}>Ver informe semanal y borradores de contenido</button>
  {error&&<p role="alert">{error}</p>}{report&&<div className="mt-3 space-y-2"><p>Últimos {report.windowDays} días · Modo sombra</p>
   <p>Consultas: {report.consultations??'Sin confirmar'} · Análisis terminados: {report.analyzedRuns??'Sin confirmar'} de {report.runs??'Sin confirmar'} ejecuciones · Derivados: {report.needsReview??'Sin confirmar'}</p>
   <p>Procesamientos con plazo vencido: {report.staleLeases??'Sin confirmar'} · Respuestas aceptadas por proveedor: {report.replyAccepted??'Sin confirmar'} · Resultado incierto: {report.replyUncertain??'Sin confirmar'}</p>
   <p>Tiempo medio de análisis: {typeof report.meanProcessingMs==='number'?report.meanProcessingMs.toFixed(0)+' ms':'Sin datos suficientes'} (sobre análisis terminados).</p>
   <p>Entrega, lectura por destinataria, costo real, ventas y satisfacción: sin datos suficientes. Las reservas de presupuesto no son gasto confirmado.</p>
   <details><summary className="cursor-pointer py-2">Tres propuestas de contenido para revisar</summary><ul className="list-disc pl-5">{(report.content??[]).map((item:any)=><li key={item.id} className="my-3"><p>{item.text}</p><p className="text-sm">Borrador · Fuente aprobada versión {item.version} · Publicación pendiente de aprobación.</p></li>)}</ul></details>
  </div>}
 </div>;
}
