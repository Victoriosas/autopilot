import {AffiliateResearchPanel} from './AffiliateResearchPanel';
import React,{useState} from 'react';
import {apiFetch} from '../../lib/api';

export function ManualCatalogPanel() {
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[drafts,setDrafts]=useState<any[]>([]);
 const [reviewed,setReviewed]=useState<Record<string,boolean>>({});
 async function load(){
  try{const r=await apiFetch('/api/autopilot/v4/manual-catalog');if(!r.ok)throw Error();setDrafts((await r.json()).products);setReviewed({});}
  catch{setMessage('No se pudo cargar la selección. Verificá tu sesión administradora.');}
 }
 async function save(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();const form=event.currentTarget,data=new FormData(form);setBusy(true);setMessage('');
  try{
   const body=Object.fromEntries(data.entries());const r=await apiFetch('/api/autopilot/v4/manual-catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,imagePermission:data.get('imagePermission')==='on'})});
   if(!r.ok)throw Error();
   setMessage('Borrador guardado. Revisá la ficha y las condiciones antes de publicarlo.');form.reset();await load();
  }catch{setMessage('No se guardó el borrador. Revisá los campos, el permiso de imagen y la sesión administradora.');}
  finally{setBusy(false);}
 }
 async function publish(id:string,version:string){
  if(!reviewed[id])return;setBusy(true);
  try{const r=await apiFetch('/api/autopilot/v4/manual-catalog/'+id+'/publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reviewed:true,version})});if(!r.ok)throw Error();setMessage('Ficha publicada sin carrito ni cobro en Victoriosa. Recargá el catálogo para verla.');await load();}
  catch{setMessage('No se confirmó la publicación. Recargá la selección y revisá la ficha.');}
  finally{setBusy(false);}
 }
 return <details className="rounded-2xl border border-white/15 bg-white/5 p-5 text-slate-200">
  <summary className="min-h-11 cursor-pointer font-semibold">Catálogo por consulta y recomendaciones</summary>
  <p className="my-3 text-sm text-slate-400">Cargá una ficha real sin conectar al proveedor. Se guarda como borrador, sin precio ni stock propios. El enlace de afiliado requiere una cuenta aprobada por ese comercio.</p>
  <AffiliateResearchPanel />
  <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
   {[
    ['title','Título',160],['category','Categoría',100],['merchant','Comercio o responsable',100],
    ['url','Enlace afiliado o WhatsApp internacional (https://wa.me/...)',2048],
    ['source','Página fuente del producto',2048],['image','URL de imagen autorizada (opcional)',2048]
   ].map(([name,label,max])=><label key={name} className="text-sm">{label}<input name={String(name)} type={['url','source','image'].includes(String(name))?'url':'text'} required={name!=='image'} maxLength={Number(max)} className="mt-1 block min-h-11 w-full rounded-lg bg-slate-900 p-3 text-white" /></label>)}
   <label className="text-sm">Modalidad<select name="mode" className="mt-1 block min-h-11 w-full rounded-lg bg-slate-900 p-3"><option value="inquiry">Consulta de disponibilidad</option><option value="affiliate">Enlace de afiliado</option></select></label>
   <label className="text-sm sm:col-span-2">Descripción comprobada<textarea name="description" required maxLength={3000} className="mt-1 block w-full rounded-lg bg-slate-900 p-3" /></label>
   <label className="inline-flex min-h-11 items-center gap-2 text-sm sm:col-span-2"><input name="imagePermission" type="checkbox" />Tengo permiso para usar la imagen indicada.</label>
   <button disabled={busy} className="min-h-11 rounded-lg bg-indigo-600 px-4 py-3 font-semibold disabled:opacity-50">Guardar borrador</button>
  </form>
  <p role="status" className="my-3 text-sm">{message}</p>
  <button type="button" disabled={busy} onClick={load} className="min-h-11 underline">Cargar selección para revisar</button>
  <ul className="space-y-4">{drafts.map(p=><li key={p.id} className="rounded-lg border border-white/10 p-3">
   <h3 className="font-semibold">{p.title}</h3><p className="my-1 text-sm">{p.description}</p>
   <p className="break-all text-xs">{p.traceability?.offer?.merchant} · {p.traceability?.offer?.mode} · {p.traceability?.offer?.url}</p>
   {p.status==='draft_ready'?<><label className="my-2 flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={!!reviewed[p.id]} onChange={e=>setReviewed({...reviewed,[p.id]:e.target.checked})} />Verifiqué fuente, contenido, permiso de imagen y destino. Para afiliación, mi cuenta y este enlace están aprobados por el comercio.</label>
   <button type="button" disabled={busy||!reviewed[p.id]} onClick={()=>publish(p.id,p.updated_at)} className="min-h-11 rounded-lg bg-indigo-600 px-4 disabled:opacity-50">Publicar ficha revisada</button></>:<p className="text-sm">Estado: {p.status}</p>}
  </li>)}</ul>
 </details>;
}
