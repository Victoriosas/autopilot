import React from 'react';
import { 
  X, 
  History, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Layers, 
  Cpu, 
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface AutopilotHistoryModalProps {
  onClose: () => void;
}

export const AutopilotHistoryModal: React.FC<AutopilotHistoryModalProps> = ({ onClose }) => {
  const { runs } = useApp();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-xl overflow-y-auto animate-fadeIn">
      <div 
        className="relative w-full max-w-4xl bg-[#0d111d]/90 border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-8 backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-white">
                Historial de Ejecuciones del Autopilot
              </h2>
              <p className="text-xs text-slate-400">
                Auditoría de misiones ejecutadas, métricas de aprobación y logs de pipeline
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of Runs */}
        <div className="p-6 max-h-[65vh] overflow-y-auto space-y-4 text-xs">
          {runs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No hay ejecuciones registradas en Firestore todavía.
            </div>
          ) : (
            runs.map((run) => (
              <div
                key={run.id}
                className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3 backdrop-blur-md"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white font-mono">
                      Misión #{run.id.slice(-6).toUpperCase()}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-slate-300 border border-white/10">
                      {run.triggerType === 'manual' ? 'Lanzamiento Manual' : 'Cron Automatizado'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(run.startedAt).toLocaleString('es-ES')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {run.status === 'completed' ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Completada con Éxito
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-rose-400 font-semibold text-[11px] px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20">
                        <XCircle className="w-3.5 h-3.5" />
                        Fallida
                      </span>
                    )}
                  </div>
                </div>

                {/* Metrics Deck */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-300 font-mono text-[11px]">
                  <div className="p-3 bg-black/30 rounded-xl border border-white/5">
                    <span className="text-slate-400 text-[10px] block">Descubiertos</span>
                    <span className="font-bold text-white text-sm">{run.itemsDiscovered} productos</span>
                  </div>
                  <div className="p-3 bg-black/30 rounded-xl border border-white/5">
                    <span className="text-slate-400 text-[10px] block">Aprobados IA</span>
                    <span className="font-bold text-indigo-400 text-sm">{run.itemsApproved} candidatos</span>
                  </div>
                  <div className="p-3 bg-black/30 rounded-xl border border-white/5">
                    <span className="text-slate-400 text-[10px] block">Publicados Tienda</span>
                    <span className="font-bold text-emerald-400 text-sm">{run.itemsPublished} en vivo</span>
                  </div>
                  <div className="p-3 bg-black/30 rounded-xl border border-white/5">
                    <span className="text-slate-400 text-[10px] block">Rechazados / Descarte</span>
                    <span className="font-bold text-rose-400 text-sm">{run.itemsRejected} filtrados</span>
                  </div>
                </div>

                {/* Logs snippet */}
                {run.logs && run.logs.length > 0 && (
                  <div className="p-3 bg-black/40 rounded-xl border border-white/5 font-mono text-[10px] text-slate-300 space-y-1 backdrop-blur-sm">
                    <div className="text-slate-400 font-semibold">Resumen de Logs:</div>
                    {run.logs.slice(0, 3).map((log, i) => (
                      <div key={i}>• {log}</div>
                    ))}
                    {run.logs.length > 3 && (
                      <div className="text-slate-500 italic">+ {run.logs.length - 3} eventos adicionales</div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-white/10 bg-white/[0.02] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
