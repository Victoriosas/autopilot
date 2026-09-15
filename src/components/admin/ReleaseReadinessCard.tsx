import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../../lib/api';

type Readiness={
  state:'safe_shadow'|'blocked_for_commerce'|'ready_for_manual_release';
  blockers:string[];
  providers:{cj:boolean;marketEvidence:{mercadoLibre:boolean;gemini:boolean;openRouter:boolean;openRouterCircuitOpen:boolean};payments:{mercadoPago:boolean;paypal:boolean}};
  catalog:{published:number;productionEligible:number;shadowDrafts:number};
  generatedAt:string;
};

const labels:Record<Readiness['state'],string>={
  safe_shadow:'Shadow seguro',
  blocked_for_commerce:'Comercio bloqueado',
  ready_for_manual_release:'Listo para liberación manual',
};

const blockerLabels:Record<string,string>={
  cj_read_provider:'CJ no está disponible',
  market_evidence_provider:'Falta un proveedor de Market Evidence',
  production_catalog:'No hay productos publicados elegibles para producción',
  payment_provider:'Falta un proveedor de pagos configurado',
  legacy_scheduler_off:'El sourcing legacy debe quedar desactivado',
  auto_publish_off:'La auto-publicación debe quedar desactivada',
  autonomous_purchase_off:'La compra autónoma debe quedar desactivada',
};

export const ReleaseReadinessCard:React.FC=()=>{
  const [data,setData]=useState<Readiness|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  const load=async()=>{
    setLoading(true);setError(null);
    try{
      const response=await apiFetch('/api/autopilot/v4/release-readiness');
      const body=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(body?.error||`HTTP_${response.status}`);
      setData(body);
    }catch(err:any){setError(err.message||'RELEASE_READINESS_UNAVAILABLE');}
    finally{setLoading(false);}
  };

  useEffect(()=>{void load();},[]);

  if(loading&&!data) return <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-xs text-slate-400 flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5 animate-spin"/> Calculando Release Gate...</div>;
  if(error&&!data) return <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-200">Release Gate no disponible: {error}</div>;
  if(!data) return null;

  const ready=data.state==='ready_for_manual_release';
  const blocked=data.state==='blocked_for_commerce';
  const Icon=ready?CheckCircle2:blocked?AlertTriangle:ShieldCheck;
  const market=data.providers.marketEvidence;
  return <div className={`mb-5 rounded-2xl border p-4 ${ready?'border-emerald-500/25 bg-emerald-500/[0.05]':blocked?'border-rose-500/25 bg-rose-500/[0.05]':'border-indigo-500/20 bg-indigo-500/[0.04]'}`}>
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-black/20 border border-white/10 flex items-center justify-center"><Icon className={`w-4 h-4 ${ready?'text-emerald-300':blocked?'text-rose-300':'text-indigo-300'}`}/></div>
        <div>
          <div className="text-xs font-bold text-white">Release Gate · {labels[data.state]}</div>
          <div className="text-[10px] text-slate-400 mt-1">Catálogo: {data.catalog.productionEligible} elegibles · {data.catalog.published} publicados · {data.catalog.shadowDrafts} drafts Shadow</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[9px]">
        <Pill ok={data.providers.cj} label="CJ"/>
        <Pill ok={market.mercadoLibre} label="Mercado Libre UY"/>
        <Pill ok={market.gemini} label="Gemini"/>
        <Pill ok={market.openRouter&&!market.openRouterCircuitOpen} label={market.openRouterCircuitOpen?'OpenRouter 402':'OpenRouter'}/>
        <Pill ok={data.providers.payments.mercadoPago} label="Mercado Pago"/>
        <Pill ok={data.providers.payments.paypal} label="PayPal"/>
        <button onClick={()=>void load()} disabled={loading} className="px-2 py-1 rounded-md border border-white/10 text-slate-400 hover:text-white disabled:opacity-50"><RefreshCw className={`w-3 h-3 ${loading?'animate-spin':''}`}/></button>
      </div>
    </div>
    {data.blockers.length>0&&<div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-2">
      {data.blockers.map(id=><span key={id} className="text-[9px] px-2 py-1 rounded-md border border-amber-500/15 bg-amber-500/[0.05] text-amber-200/80">{blockerLabels[id]||id}</span>)}
    </div>}
  </div>;
};

function Pill({ok,label}:{ok:boolean;label:string}){
  return <span className={`px-2 py-1 rounded-md border ${ok?'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300':'border-white/10 bg-black/10 text-slate-500'}`}>{ok?'●':'○'} {label}</span>;
}
