import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Play,
  Bot,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Search,
  Globe2,
  Calculator,
  Scale,
  PackageSearch,
  ExternalLink,
  RefreshCw,
  FlaskConical,
  CircleDollarSign,
  Truck,
  Boxes,
  Sparkles,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface AutopilotRunnerModalProps {
  onClose: () => void;
}

type ShadowItem = {
  id: string;
  identity: string;
  status: string;
  title: string;
  image?: string | null;
  sourceUrl?: string | null;
  variantId?: string | null;
  stock?: number | null;
  supplierCost?: number | null;
  shippingCost?: number | null;
  currency?: string | null;
  destination?: string | null;
  shippingVerified?: boolean;
  victoriosaFit?: any;
  marketEvidence?: any;
  quote?: any;
  reasons?: string[];
  council?: any;
  draftId?: string | null;
  errorCode?: string | null;
};

type ShadowInspection = {
  run?: any;
  runs?: any[];
  items?: ShadowItem[];
};

type RunResponse = {
  run_id?: string;
  status?: string;
  mode?: string;
  shadow?: boolean;
  policyVersion?: string;
  safety?: any;
  inspection?: ShadowInspection;
  error?: string;
};

const PIPELINE_STEPS = [
  { label: 'CJ Discovery', icon: PackageSearch, note: 'Busca productos reales en CJ.' },
  { label: 'Evidencia', icon: Truck, note: 'Variante, stock y envío a Uruguay.' },
  { label: 'Filtro Victoriosa', icon: ShieldCheck, note: 'Marca, riesgo y regulación.' },
  { label: 'Market Evidence', icon: Globe2, note: 'Comparables y precio de mercado.' },
  { label: 'Pricing', icon: Calculator, note: 'Costos, fees, reservas y margen.' },
  { label: 'Council', icon: Scale, note: 'Revisión final del candidato.' },
  { label: 'Shadow', icon: FlaskConical, note: 'Simula. No publica ni compra.' },
];

function money(value: unknown, currency = 'UYU') {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
}

function statusLabel(status?: string) {
  const map: Record<string, string> = {
    completed: 'Completado',
    completed_no_candidates: 'Completado sin candidato final',
    queued: 'En cola / reanudable',
    running: 'Ejecutando',
    resuming: 'Reanudando',
    needs_evidence: 'Necesita evidencia',
    evidence_rejected: 'Rechazado por evidencia/filtro',
    pricing_rejected: 'Rechazado por pricing',
    council_rejected: 'Rechazado por Council',
    shadow_completed: 'Aprobaría en Shadow',
    failed_terminal: 'Fallo terminal',
    failed_retryable: 'Fallo reintentable',
  };
  return map[status || ''] || status || 'Sin datos';
}

function badgeClass(status?: string) {
  if (status === 'shadow_completed' || status === 'completed') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  if (status?.includes('rejected') || status?.includes('failed')) return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
  if (status === 'needs_evidence' || status === 'completed_no_candidates') return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  return 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300';
}

async function jsonRequest(path: string, options: RequestInit = {}) {
  const response = await apiFetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `HTTP_${response.status}`);
  return data;
}

export const AutopilotRunnerModal: React.FC<AutopilotRunnerModalProps> = ({ onClose }) => {
  const [keyword, setKeyword] = useState('facial headband');
  const [maxCandidates, setMaxCandidates] = useState(3);
  const [running, setRunning] = useState(false);
  const [loadingLast, setLoadingLast] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResponse | null>(null);
  const [inspection, setInspection] = useState<ShadowInspection | null>(null);

  const items = inspection?.items || result?.inspection?.items || [];
  const run = inspection?.run || result?.inspection?.run || null;

  const counts = useMemo(() => ({
    total: items.length,
    eligible: items.filter(i => i.victoriosaFit?.decision === 'eligible').length,
    rejected: items.filter(i => i.status === 'evidence_rejected' || i.status === 'pricing_rejected' || i.status === 'council_rejected').length,
    wouldPublish: items.filter(i => i.status === 'shadow_completed').length,
  }), [items]);

  const loadLastRun = async () => {
    setLoadingLast(true);
    setError(null);
    try {
      const data = await jsonRequest('/api/autopilot/v4/sourcing/admin-shadow-status');
      setInspection(data);
    } catch (err: any) {
      setError(err.message === 'ADMIN_ROLE_REQUIRED'
        ? 'Tu sesión no tiene rol admin en Supabase.'
        : `No pude leer el motor V4: ${err.message}`);
    } finally {
      setLoadingLast(false);
    }
  };

  useEffect(() => { void loadLastRun(); }, []);

  const runShadow = async (event: React.FormEvent) => {
    event.preventDefault();
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const data = await jsonRequest('/api/autopilot/v4/sourcing/admin-shadow-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, maxCandidates }),
      }) as RunResponse;
      setResult(data);
      if (data.inspection) setInspection(data.inspection);
    } catch (err: any) {
      const message: Record<string, string> = {
        ADMIN_AUTH_REQUIRED: 'Inicia sesión como administrador para ejecutar el motor.',
        ADMIN_ROLE_REQUIRED: 'Tu cuenta no tiene rol admin en Supabase.',
        PRODUCTION_SHADOW_SAFETY_NOT_READY: 'La compuerta de seguridad Shadow no está lista. No se ejecutó nada.',
        CJ_API_NOT_CONFIGURED: 'CJ_API_KEY no está disponible en Vercel.',
        ADMIN_SHADOW_RUN_INCOMPLETE: 'El ciclo quedó incompleto. Puedes revisar el último checkpoint con “Actualizar estado”.',
      };
      setError(message[err.message] || `No se pudo ejecutar Shadow V4: ${err.message}`);
      await loadLastRun();
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xl overflow-y-auto">
      <div className="relative w-full max-w-6xl bg-[#0b0f18]/95 border border-white/10 rounded-2xl shadow-2xl my-4 sm:my-8 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-serif font-bold text-lg text-white">Autopilot V4 · Laboratorio Shadow</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">CJ REAL</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-amber-500/30 bg-amber-500/10 text-amber-300">SIN COMPRAS</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Observa el motor real: sourcing → evidencia → mercado → pricing → Council, sin publicar.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SafetyCard icon={ShieldCheck} label="Modo" value="SHADOW" good />
            <SafetyCard icon={CircleDollarSign} label="Compras" value="BLOQUEADAS" good />
            <SafetyCard icon={CheckCircle2} label="Auto-publicación" value="BLOQUEADA" good />
            <SafetyCard icon={Boxes} label="Máximo por prueba" value={`${maxCandidates} productos`} />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {PIPELINE_STEPS.map(({ label, icon: Icon, note }, index) => (
                <div key={label} className={`rounded-xl border p-3 min-h-24 ${running ? 'border-indigo-500/25 bg-indigo-500/[0.06]' : 'border-white/10 bg-black/10'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <Icon className={`w-4 h-4 ${running ? 'text-indigo-300' : 'text-slate-400'}`} />
                    <span className="text-[9px] font-mono text-slate-600">0{index + 1}</span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-200">{label}</div>
                  <div className="text-[9px] leading-4 text-slate-500 mt-1">{note}</div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={runShadow} className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.04] p-4 sm:p-5">
            <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
              <div className="flex-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-2 mb-2"><Search className="w-3.5 h-3.5 text-indigo-300" /> Qué querés que busque en CJ</label>
                <input
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  maxLength={80}
                  placeholder="ej: pearl headband, facial massager, makeup organizer"
                  className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none focus:border-indigo-500/60"
                />
                <p className="text-[10px] text-slate-500 mt-2">Usá términos de belleza/accesorios en inglés porque CJ devuelve mejores resultados.</p>
              </div>
              <div className="w-full lg:w-44">
                <label className="text-xs font-semibold text-slate-300 block mb-2">Candidatos</label>
                <select value={maxCandidates} onChange={e => setMaxCandidates(Number(e.target.value))} className="w-full px-3 py-3 bg-[#0b0f18] border border-white/10 rounded-xl text-sm text-white">
                  <option value={1}>1 producto</option>
                  <option value={2}>2 productos</option>
                  <option value={3}>3 productos</option>
                </select>
              </div>
              <button type="submit" disabled={running || !keyword.trim()} className="h-12 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-600/20">
                {running ? <><RefreshCw className="w-4 h-4 animate-spin" /> Investigando mercado...</> : <><Play className="w-4 h-4 fill-current" /> Probar Autopilot V4</>}
              </button>
            </div>
          </form>

          {running && (
            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.04] p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
              <div>
                <div className="text-sm font-semibold text-white">El motor está trabajando con datos reales</div>
                <div className="text-xs text-slate-400 mt-1">CJ, flete a UY y Market Evidence pueden tardar varios segundos. Esta prueba está limitada a 40 s y no compra ni publica.</div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 flex items-start gap-2"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}</div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white">Última ejecución V4</h3>
              <p className="text-[10px] text-slate-500 mt-1">Los resultados salen de las tablas durables de Supabase, no de datos demo.</p>
            </div>
            <button onClick={() => void loadLastRun()} disabled={loadingLast || running} className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-50 flex items-center gap-2"><RefreshCw className={`w-3.5 h-3.5 ${loadingLast ? 'animate-spin' : ''}`} /> Actualizar estado</button>
          </div>

          {run ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Metric label="Estado" value={statusLabel(run.status)} />
                <Metric label="Encontrados" value={run.metrics?.productsFetched ?? counts.total} />
                <Metric label="Evaluados" value={run.metrics?.opportunitiesEvaluated ?? 0} />
                <Metric label="Shadow aprobaría" value={run.metrics?.shadowWouldPublish ?? counts.wouldPublish} accent />
              </div>

              <div className="space-y-3">
                {items.length === 0 ? (
                  <div className="p-8 rounded-2xl border border-white/10 bg-white/[0.02] text-center text-sm text-slate-500">La ejecución aún no tiene candidatos persistidos.</div>
                ) : items.map(item => <CandidateCard key={item.id} item={item} />)}
              </div>
            </>
          ) : (
            <div className="p-10 rounded-2xl border border-dashed border-white/10 text-center text-slate-500">
              <FlaskConical className="w-8 h-8 mx-auto mb-3 text-slate-600" />
              <p className="text-sm">Todavía no hay una ejecución V4 para mostrar.</p>
              <p className="text-xs mt-1">Escribí una búsqueda y presioná “Probar Autopilot V4”.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function SafetyCard({ icon: Icon, label, value, good = false }: { icon: any; label: string; value: string; good?: boolean }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3"><div className="flex items-center gap-2 text-[10px] text-slate-500"><Icon className={`w-3.5 h-3.5 ${good ? 'text-emerald-400' : 'text-indigo-400'}`} />{label}</div><div className={`mt-2 text-xs font-bold ${good ? 'text-emerald-300' : 'text-white'}`}>{value}</div></div>;
}

function Metric({ label, value, accent = false }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4"><div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div><div className={`text-sm font-bold mt-1 ${accent ? 'text-emerald-300' : 'text-white'}`}>{value}</div></div>;
}

function CandidateCard({ item }: { item: ShadowItem }) {
  const market = item.marketEvidence;
  const quote = item.quote;
  const pricing = quote?.pricing || {};
  const fit = item.victoriosaFit;
  const reasons = Array.isArray(item.reasons) ? item.reasons : [];
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] overflow-hidden">
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4">
        <div className="w-full sm:w-20 h-20 rounded-xl bg-black/30 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
          {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover" /> : <PackageSearch className="w-6 h-6 text-slate-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-white leading-5">{item.title}</h4>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`px-2 py-1 rounded-full border text-[10px] font-bold ${badgeClass(item.status)}`}>{statusLabel(item.status)}</span>
                {fit?.segment && <span className="px-2 py-1 rounded-full border border-white/10 bg-white/5 text-[10px] text-slate-300">{fit.segment}</span>}
                {fit?.risk && <span className="text-[10px] text-slate-500">riesgo: {fit.risk}</span>}
              </div>
            </div>
            {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-[10px] text-indigo-300 hover:text-indigo-200 flex items-center gap-1">Fuente CJ <ExternalLink className="w-3 h-3" /></a>}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4">
            <Mini label="Stock" value={item.stock ?? '—'} />
            <Mini label="Costo CJ" value={money(item.supplierCost, item.currency || 'UYU')} />
            <Mini label="Envío UY" value={money(item.shippingCost, item.currency || 'UYU')} />
            <Mini label="Mercado" value={money(market?.marketPriceUyu, 'UYU')} />
            <Mini label="Precio sugerido" value={money(pricing?.suggestedPrice ?? pricing?.retailPrice, 'UYU')} />
          </div>

          <div className="grid md:grid-cols-3 gap-3 mt-4">
            <StageBox title="Filtro Victoriosa" ok={fit?.decision === 'eligible'}>
              {fit ? `${fit.decision || '—'} · ${fit.segment || 'sin segmento'}` : 'No alcanzó esta etapa'}
            </StageBox>
            <StageBox title="Market Evidence" ok={market?.status === 'ok'}>
              {market ? `${market.status} · ${market.comparableCount || 0} comparables · confianza ${market.confidence ?? '—'}` : 'No ejecutado'}
            </StageBox>
            <StageBox title="Council" ok={item.council?.decision === 'approve'}>
              {item.council ? `${item.council.decision || '—'}${item.council.ownerEscalationRequired ? ' · requiere humano' : ''}` : 'No alcanzó esta etapa'}
            </StageBox>
          </div>

          {market?.sources?.length > 0 && (
            <div className="mt-4 text-[10px] text-slate-500">
              <span className="font-semibold text-slate-400">Fuentes mercado:</span>{' '}
              {market.sources.slice(0, 3).map((source: any, index: number) => <React.Fragment key={`${source.url}-${index}`}><a href={source.url} target="_blank" rel="noreferrer" className="text-indigo-300 hover:underline">{source.title || `Fuente ${index + 1}`}</a>{index < Math.min(market.sources.length, 3) - 1 ? ' · ' : ''}</React.Fragment>)}
            </div>
          )}

          {(reasons.length > 0 || item.errorCode) && (
            <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-[10px] text-amber-200/90">
              <span className="font-bold">Por qué se detuvo:</span> {[...reasons, item.errorCode].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2"><div className="text-[9px] text-slate-600 uppercase">{label}</div><div className="text-[11px] text-slate-200 font-semibold mt-1 truncate">{value}</div></div>;
}

function StageBox({ title, ok, children }: { title: string; ok?: boolean; children: React.ReactNode }) {
  return <div className={`rounded-xl border p-3 ${ok ? 'border-emerald-500/20 bg-emerald-500/[0.05]' : 'border-white/10 bg-black/10'}`}><div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300">{ok ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Sparkles className="w-3 h-3 text-slate-500" />}{title}</div><div className="text-[10px] text-slate-500 mt-1.5 leading-4">{children}</div></div>;
}
