import React,{useEffect,useState} from 'react';
import {apiFetch} from '../../lib/api';

import type {CloudStatusRow} from '../../autopilot/cloudStatusReader';

type AgentRow=CloudStatusRow;
type AgentPayload={source:'supabase';environment:'isolated'|'production'|'unconfigured';generatedAt:string;partial:boolean;agents:AgentRow[]};
const labels:Record<string,string>={director:'Director Autopilot',software:'Ingeniero de software',infrastructure:'Auditor de infraestructura',consultations:'Asistente de consultas',followup:'Seguimiento operativo',reports:'Informes y auditoría'};
export function SixAgentStatusPanel(){
 const [state,setState]=useState<AgentPayload|null>(null);
 const [error,setError]=useState(''),[loading,setLoading]=useState(false);
 async function reload(){
   setLoading(true);setError('');setState(null);
   try {const r=await apiFetch('/api/autopilot/v4/agents-status');
    if(!r.ok)throw new Error('unavailable');
    const value=await r.json() as AgentPayload;
    if(value.source!=='supabase'||!Array.isArray(value.agents)||value.agents.length!==6)throw new Error('invalid');
    setState(value);
   }catch{setError('Estado no disponible o migración pendiente. No se supone que los agentes estén activos.');}
   finally{setLoading(false);}
 }
 useEffect(()=>{void reload();},[]);
 return <section className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4" aria-label="Estado de los seis agentes">
  <div className="flex justify-between gap-3 items-center"><h2 className="text-lg font-semibold text-white">Cloud Director · Oficina de agentes</h2>
   <button type="button" onClick={()=>void reload()} disabled={loading} className="border border-white/30 px-3 py-2 rounded-lg text-sm text-white">{loading?'Consultando…':'Actualizar'}</button></div>
  {error&&<p role="status" className="text-amber-300">{error}</p>}
  {state&&<><p className="text-xs text-slate-400">Fuente: Supabase · {new Date(state.generatedAt).toLocaleString('es-UY',{timeZone:'America/Montevideo'})} · America/Montevideo · Agregados persistidos · Alcance: observaciones sin envíos</p>
   <p className="text-xs text-amber-200">Entorno: {state.environment==='isolated'?'Ensayo aislado · consultas sintéticas':state.environment==='production'?'Producción':'Sin configurar'}</p>
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{state.agents.map(a=><article key={a.id} className="rounded-xl border border-white/10 p-4 space-y-2 text-slate-200">
     <h3 className="font-semibold">{labels[a.id]??a.id}</h3>
     <p className="text-xs">Disponibilidad: {a.lastHeartbeat&&Date.now()-Date.parse(a.lastHeartbeat)<35*60*1000?'Heartbeat reciente':'Sin heartbeat reciente'}. Un heartbeat acredita una ejecución, no continuidad garantizada.</p>
     <p className="text-sm">Pendientes: {a.pending} · Claims con lease vigente: {a.running}</p>
     <p className="text-sm">Completadas con resultado y evento: {a.completed} · Bloqueadas: {a.blocked}</p>
     <p className="text-xs">Eventos de resultado: {a.results}</p>
     {a.lastResult&&<p className="text-xs">Último resultado: {a.lastResult.ok?'Registrado correctamente':'Falló'}{a.lastResult.code?` · ${a.lastResult.code}`:''}{a.lastResult.count!==null?` · Total observado: ${a.lastResult.count}`:''} · SHA {a.lastResult.sha.slice(0,8)}</p>}
     <p className="text-xs">Consumo de infraestructura: no medido. Desarrollo, respuestas y comunicaciones requieren su autorización propia.</p>
     <p className="text-xs text-slate-400">Último heartbeat persistido: {a.lastHeartbeat?new Date(a.lastHeartbeat).toLocaleString('es-UY',{timeZone:'America/Montevideo'}):'Sin registros'}</p>
    </article>)}</div></>}
 </section>;
}
