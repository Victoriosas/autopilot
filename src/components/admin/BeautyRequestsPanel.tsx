import React, { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { BeautyEvaluationPanel } from './BeautyEvaluationPanel';

type Status='pending'|'reviewing'|'confirmed'|'completed'|'cancelled';
type Row={id:string;first_name:string;last_name:string;contact:string;zone:string;service:string;catalog_service_id?:string;catalog_version?:number;catalog_snapshot?:{title:string;duration_minutes:number;price_uyu:number;conditions:string;availability:string};availability:string;status:Status;created_at:string};
const labels:Record<Status,string>={pending:'Nueva solicitud',reviewing:'En revisión',confirmed:'Turno confirmado',completed:'Servicio realizado',cancelled:'Cancelada'};
const transitions:Record<Status,Status[]>={pending:['reviewing','cancelled'],reviewing:['confirmed','cancelled'],confirmed:['completed','cancelled'],completed:[],cancelled:[]};
export function BeautyRequestsPanel(){
 const [rows,setRows]=useState<Row[]>([]),[error,setError]=useState(''),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[offset,setOffset]=useState(0);
 const [evaluationRequest,setEvaluationRequest]=useState<string|null>(null);
 async function load(page=offset){
  setBusy(true);setError('');setRows([]);setLoaded(false);
  try{const r=await apiFetch('/api/beauty/admin/requests?offset='+page);if(!r.ok)throw new Error();setRows((await r.json()).requests);setOffset(page);setLoaded(true);}
  catch{setError('No se pudieron cargar las solicitudes. Revisá tu sesión de administración y la configuración de Beauty.');}
  finally{setBusy(false);}
 }
 async function change(row:Row,status:Status){
  if(status==='confirmed'&&!window.confirm('¿Sofía y la clienta acordaron servicio, presupuesto, traslado, fecha y horario? Este cambio no envía una confirmación al cliente.'))return;
  setBusy(true);setError('');
  try{const r=await apiFetch('/api/beauty/admin/requests/'+row.id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({from:row.status,status})});if(!r.ok)throw new Error();await load();}
  catch{setError('No se guardó el cambio. Recargá antes de intentarlo otra vez.');}finally{setBusy(false);}
 }
 return <section className="my-6 rounded-xl border border-neutral-700 bg-neutral-900 p-5 text-white" aria-labelledby="beauty-admin-title">
 <h2 id="beauty-admin-title" className="text-xl font-semibold">Victoriosas Beauty · Solicitudes</h2>
 <p className="my-2 text-sm text-neutral-300">Una consulta recibida no es un turno confirmado. Acceso privado; no se envían mensajes ni se crean eventos automáticamente.</p>
 <button disabled={busy} onClick={()=>load()} className="rounded border px-3 py-2">{busy?'Cargando…':'Cargar solicitudes'}</button>
 {error&&<p role="alert" className="mt-3 text-red-300">{error}</p>}
 {loaded&&rows.length===0&&<p role="status" className="mt-3">No hay solicitudes en esta página.</p>}
 <ul className="divide-y divide-neutral-700">{rows.map(row=><li key={row.id} className="py-4"><h3>{row.first_name} {row.last_name} · {row.zone}</h3><p>{row.service} · {labels[row.status]}</p><p>{row.catalog_snapshot?.title||row.catalog_service_id}{row.catalog_version?` · Versión ${row.catalog_version}`:""}</p>{row.catalog_snapshot&&<p>{row.catalog_snapshot.duration_minutes} min · UYU {row.catalog_snapshot.price_uyu} · {row.catalog_snapshot.conditions} · {row.catalog_snapshot.availability}</p>}<p>Contacto: {row.contact} · Preferencia: {row.availability||'A coordinar'}</p><p className="break-all text-xs text-neutral-400">Referencia: {row.id}</p><div className="mt-2 flex flex-wrap gap-2">{transitions[row.status].map(status=><button className="rounded border px-3 py-2" key={status} disabled={busy} onClick={()=>change(row,status)}>{labels[status]}</button>)}<button type="button" disabled={!!evaluationRequest} className="rounded border px-3 py-2" onClick={()=>setEvaluationRequest(row.id)}>Abrir evaluación privada</button></div></li>)}</ul>
 {evaluationRequest&&<div><p className="mt-4 text-sm">La evaluación requiere permiso profesional adicional. Cerrá la ficha antes de seleccionar otra solicitud.</p><BeautyEvaluationPanel requestId={evaluationRequest}/><button type="button" className="rounded border px-3 py-2" onClick={()=>{if(window.confirm('¿Cerrar el módulo privado y descartar cualquier cambio sin guardar?'))setEvaluationRequest(null);}}>Cerrar módulo privado</button></div>}
 {loaded&&<div className="mt-4 flex gap-3"><button disabled={busy||offset===0} onClick={()=>load(Math.max(0,offset-50))}>Anterior</button><span>Página {offset/50+1}</span><button disabled={busy||rows.length<50} onClick={()=>load(offset+50)}>Siguiente</button></div>}
 </section>;
}
