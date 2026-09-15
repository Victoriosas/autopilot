import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, PackageCheck, RefreshCw, Rocket, Search, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../../lib/api';

type Readiness={
  state:'safe_shadow'|'blocked_for_commerce'|'ready_for_manual_release';
  blockers:string[];
  providers:{cj:boolean;marketEvidence:{mercadoLibre:boolean;gemini:boolean;openRouter:boolean;openRouterCircuitOpen:boolean};payments:{mercadoPago:boolean;paypal:boolean}};
  catalog:{published:number;productionEligible:number;shadowDrafts:number};
  generatedAt:string;
};

type ReleaseItem={
  id:string;
  status:string;
  title:string;
  draftId?:string|null;
  marketEvidence?:any;
  quote?:any;
  reasons?:string[];
  council?:any;
};

type ReleaseRun={
  run_id?:string;
  status?:string;
  inspection?:{run?:any;items?:ReleaseItem[]};
  searchQuery?:{input?:string;keyword?:string};
};

const labels:Record<Readiness['state'],string>={
  safe_shadow:'Shadow seguro',
  blocked_for_commerce:'Comercio bloqueado',
  ready_for_manual_release:'Listo para liberación manual',
};

const blockerLabels:Record<string,string>={
  cj_read_provider:'CJ no está disponible',
  market_evidence_provider:'Falta un proveedor de Market Evidence',
  production_catalog:'Todavía no hay productos publicados elegibles',
  payment_provider:'Falta un proveedor de pagos configurado',
  legacy_scheduler_off:'El sourcing legacy debe quedar desactivado',
  auto_publish_settings_off:'La auto-publicación en settings debe quedar desactivada',
  auto_publish_runtime_off:'La auto-publicación runtime debe quedar desactivada',
  autonomous_purchase_off:'La compra autónoma debe quedar desactivada',
};

async function jsonRequest(path:string,options:RequestInit={}){
  const response=await apiFetch(path,options);
  const body=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(body?.error||`HTTP_${response.status}`);
  return body;
}

export const ReleaseReadinessCard:React.FC=()=>{
  const [data,setData]=useState<Readiness|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [query,setQuery]=useState('facial headband');
  const [revalidating,setRevalidating]=useState(false);
  const [publishing,setPublishing]=useState<string|null>(null);
  const [releaseRun,setReleaseRun]=useState<ReleaseRun|null>(null);
  const [releaseMessage,setReleaseMessage]=useState<string|null>(null);

  const load=async()=>{
    setLoading(true);setError(null);
    try{
      const body=await jsonRequest('/api/autopilot/v4/release-readiness');
      setData(body);
    }catch(err:any){setError(err.message||'RELEASE_READINESS_UNAVAILABLE');}
    finally{setLoading(false);}
  };

  useEffect(()=>{void load();},[]);

  const revalidate=async()=>{
    if(!query.trim()||revalidating) return;
    setRevalidating(true);setReleaseMessage(null);setError(null);
    try{
      const body=await jsonRequest('/api/autopilot/v4/sourcing/admin-release-candidate',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({keyword:query.trim(),maxCandidates:1}),
      }) as ReleaseRun;
      setReleaseRun(body);
      const ready=(body.inspection?.items||[]).filter(item=>item.status==='production_ready').length;
      setReleaseMessage(ready>0
        ? `${ready} candidato revalidado con evidencia fresca. Ya puede pasar a publicación manual.`
        : 'La revalidación terminó sin candidato publicable. El filtro no se relajó.');
      await load();
    }catch(err:any){
      const messages:Record<string,string>={
        MARKET_EVIDENCE_PROVIDER_NOT_CONFIGURED:'No hay proveedor de Market Evidence disponible.',
        PRODUCTION_RELEASE_CANDIDATE_SAFETY_NOT_READY:'Las compuertas de seguridad no permiten revalidación de producción.',
        ADMIN_RELEASE_CANDIDATE_RUN_INCOMPLETE:'La corrida quedó incompleta o reanudable. Revisá nuevamente antes de publicar.',
        CJ_READ_PROVIDER_NOT_CONFIGURED:'CJ no está disponible para revalidación.',
      };
      setError(messages[err.message]||`Revalidación fallida: ${err.message}`);
    }finally{setRevalidating(false);}
  };

  const publish=async(item:ReleaseItem)=>{
    if(!item.draftId||publishing) return;
    if(!window.confirm(`Publicar manualmente “${item.title}”?\n\nEsto crea el producto en el catálogo con la evidencia de producción actual. No compra al proveedor ni cobra a ningún cliente.`)) return;
    setPublishing(item.draftId);setError(null);setReleaseMessage(null);
    try{
      const body=await jsonRequest('/api/autopilot/v4/release-operations/publish',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({draftId:item.draftId}),
      });
      setReleaseRun(current=>current?{
        ...current,
        inspection:{...current.inspection,items:(current.inspection?.items||[]).map(value=>value.id===item.id?{...value,status:'published'}:value)},
      }:current);
      setReleaseMessage(`Publicado manualmente. Producto ${body?.product?.id||''} quedó en catálogo; no se ejecutó compra ni pago.`);
      await load();
    }catch(err:any){
      const messages:Record<string,string>={
        MANUAL_RELEASE_EVIDENCE_STALE_OR_INVALID:'La evidencia venció o dejó de ser válida. Revalidá nuevamente antes de publicar.',
        PRODUCTION_READY_COUNCIL_REQUIRED:'El candidato no tiene aprobación válida del Council.',
        SHADOW_PUBLICATION_DENIED:'Un draft Shadow nunca puede publicarse. Revalidalo en producción.',
        PRODUCTION_READY_DRAFT_REQUIRED:'El draft todavía no está listo para producción.',
      };
      setError(messages[err.message]||`Publicación manual fallida: ${err.message}`);
    }finally{setPublishing(null);}
  };

  if(loading&&!data) return <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-xs text-slate-400 flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5 animate-spin"/> Calculando Release Gate...</div>;
  if(error&&!data) return <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-200">Release Gate no disponible: {error}</div>;
  if(!data) return null;

  const ready=data.state==='ready_for_manual_release';
  const blocked=data.state==='blocked_for_commerce';
  const Icon=ready?CheckCircle2:blocked?AlertTriangle:ShieldCheck;
  const market=data.providers.marketEvidence;
  const releaseItems=releaseRun?.inspection?.items||[];
  const hasMarketProvider=market.mercadoLibre||market.gemini||(market.openRouter&&!market.openRouterCircuitOpen);
  const canRevalidate=data.providers.cj&&hasMarketProvider;

  return <div className="mb-5 space-y-3">
    <div className={`rounded-2xl border p-4 ${ready?'border-emerald-500/25 bg-emerald-500/[0.05]':blocked?'border-rose-500/25 bg-rose-500/[0.05]':'border-indigo-500/20 bg-indigo-500/[0.04]'}`}>
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
    </div>

    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center"><Rocket className="w-4 h-4 text-emerald-300"/></div>
        <div className="flex-1">
          <div className="text-xs font-bold text-white">Carril de liberación manual</div>
          <div className="text-[10px] text-slate-400 mt-1">Revalida CJ + mercado + pricing + Council con evidencia fresca. Si aprueba, queda <code className="text-emerald-300">production_ready</code> durante un máximo de 24 h. Publicar sigue requiriendo un clic de administrador.</div>
        </div>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500"/>
          <input value={query} onChange={e=>setQuery(e.target.value)} maxLength={120} placeholder="ej: vincha facial de spa" className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-black/20 border border-white/10 text-xs text-white placeholder:text-slate-600 outline-none focus:border-emerald-500/40"/>
        </div>
        <button onClick={()=>void revalidate()} disabled={!canRevalidate||revalidating||!query.trim()} className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2">
          {revalidating?<><RefreshCw className="w-3.5 h-3.5 animate-spin"/> Revalidando...</>:<><PackageCheck className="w-3.5 h-3.5"/> Revalidar para producción</>}
        </button>
      </div>

      {!canRevalidate&&<div className="mt-2 text-[9px] text-amber-300/80">Revalidación pausada hasta que CJ y al menos un proveedor de Market Evidence estén disponibles.</div>}
      {releaseMessage&&<div className="mt-3 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.05] px-3 py-2 text-[10px] text-emerald-200">{releaseMessage}</div>}
      {error&&<div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/[0.06] px-3 py-2 text-[10px] text-rose-200">{error}</div>}

      {releaseItems.length>0&&<div className="mt-4 space-y-2">
        {releaseItems.map(item=>{
          const productionReady=item.status==='production_ready';
          const published=item.status==='published';
          return <div key={item.id} className="rounded-xl border border-white/10 bg-black/10 p-3 flex flex-col md:flex-row md:items-center gap-3 justify-between">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-white truncate">{item.title||'Candidato'}</div>
              <div className="mt-1 flex flex-wrap gap-1.5 text-[9px]">
                <span className={`px-2 py-0.5 rounded-full border ${productionReady||published?'border-emerald-500/20 text-emerald-300':'border-amber-500/20 text-amber-300'}`}>{published?'Publicado':productionReady?'Listo para publicación manual':item.status}</span>
                {item.marketEvidence?.provider&&<span className="px-2 py-0.5 rounded-full border border-white/10 text-slate-400">mercado: {item.marketEvidence.provider}</span>}
                {item.marketEvidence?.confidence!==undefined&&<span className="px-2 py-0.5 rounded-full border border-white/10 text-slate-400">confianza {item.marketEvidence.confidence}</span>}
              </div>
              {item.reasons?.length?<div className="text-[9px] text-amber-200/70 mt-1.5">{item.reasons.join(' · ')}</div>:null}
            </div>
            {productionReady&&item.draftId&&<button onClick={()=>void publish(item)} disabled={Boolean(publishing)} className="shrink-0 px-3 py-2 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.08] text-[10px] font-bold text-emerald-200 hover:bg-emerald-500/[0.14] disabled:opacity-40">
              {publishing===item.draftId?'Publicando...':'Publicar manualmente'}
            </button>}
          </div>;
        })}
      </div>}

      <div className="mt-3 text-[9px] text-slate-500">Este carril no activa checkout, pagos, pedidos CJ ni compras a proveedor. Solo crea catálogo después de una publicación manual aprobada.</div>
    </div>
  </div>;
};

function Pill({ok,label}:{ok:boolean;label:string}){
  return <span className={`px-2 py-1 rounded-md border ${ok?'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300':'border-white/10 bg-black/10 text-slate-500'}`}>{ok?'●':'○'} {label}</span>;
}
