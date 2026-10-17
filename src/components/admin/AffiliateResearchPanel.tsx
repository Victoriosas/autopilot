import React,{useState} from 'react';
import {apiFetch} from '../../lib/api';

export function AffiliateResearchPanel(){
 const [status,setStatus]=useState<any>(null),[rows,setRows]=useState<any[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function load(){
  setBusy(true);
  try{const r=await apiFetch('/api/integrations/affiliate-research/status');if(!r.ok)throw Error();setStatus(await r.json());setMessage('Configuracion consultada. Configurado indica enlace declarado; no confirma aprobacion por el comercio.');}
  catch{setMessage('No se pudo consultar. Verifica tu sesion administradora.');}finally{setBusy(false);}
 }
 async function search(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();const query=new FormData(e.currentTarget).get('query');setBusy(true);setRows([]);
  try{
   const r=await apiFetch('/api/integrations/affiliate-research/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query})});
   const data=await r.json();if(!r.ok){setMessage(data.error==='FIRECRAWL_NOT_CONFIGURED'?'Falta configurar la clave Firecrawl del servidor.':'La busqueda no pudo completarse.');return;}
   setRows(data.candidates);setMessage(data.notice);
  }catch{setMessage('No se pudo completar la busqueda.');}finally{setBusy(false);}
 }
 const labels:Record<string,string>={missing_link:'Falta enlace aprobado',invalid_link:'Enlace invalido',approval_required:'Falta confirmar aprobacion',configured:'Enlace configurado'};
 return <section className="my-4 rounded-xl border border-white/15 p-4 text-slate-200">
  <h3 className="font-semibold">Investigacion y afiliacion</h3>
  <button type="button" onClick={load} disabled={busy} className="min-h-11 underline">Comprobar conexiones</button>
  {status&&<><p>Firecrawl: {status.firecrawl.configured?'Clave configurada':'Falta clave del servidor'}</p>
   <ul>{status.programs.map((p:any)=><li key={p.id}>{p.name}: {labels[p.state]} · <a href={p.signup} target="_blank" rel="noopener noreferrer" className="inline-block min-h-11 underline">Programa oficial</a>{p.url&&<a href={p.url} target="_blank" rel="sponsored noopener noreferrer" className="ml-3 inline-block min-h-11 underline">Ver enlace configurado</a>}</li>)}</ul></>}
  <form onSubmit={search} className="my-3 flex flex-wrap gap-3">
   <label>Producto a investigar<input name="query" required minLength={3} maxLength={200} className="ml-2 min-h-11 rounded bg-slate-900 p-2" /></label>
   <button disabled={busy} className="min-h-11 rounded bg-indigo-600 px-3 disabled:opacity-50">Buscar hasta 5 fuentes</button>
  </form>
  <p className="text-sm">La busqueda consume creditos Firecrawl. Revisa cada fuente y usa el formulario de abajo para crear un borrador con tu enlace afiliado aprobado.</p>
  <p role="status" className="my-2">{message}</p>
  <ul>{rows.map((r:any)=><li key={r.url} className="my-3"><a href={r.url} target="_blank" rel="noopener noreferrer" className="underline">{r.title||r.url}</a><p className="text-sm">{r.description}</p></li>)}</ul>
 </section>;
}
