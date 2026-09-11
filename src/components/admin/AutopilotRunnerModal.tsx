import React, { useState } from 'react';
import { 
  X, 
  Play, 
  Bot, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Cpu, 
  ShieldCheck, 
  Zap,
  Terminal
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface AutopilotRunnerModalProps {
  onClose: () => void;
}

export const AutopilotRunnerModal: React.FC<AutopilotRunnerModalProps> = ({ onClose }) => {
  const { runFullAutopilotBatch, isAutopilotRunning, activeLogs } = useApp();
  const [targetCategory, setTargetCategory] = useState('Relojería');
  const [maxBatch, setMaxBatch] = useState(2);
  const [autoPublish, setAutoPublish] = useState(false);
  const [targetMargin, setTargetMargin] = useState(55);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleStartRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsExecuting(true);
    try {
      await runFullAutopilotBatch({
        category: targetCategory,
        maxCandidates: maxBatch,
        autoPublishApproved: autoPublish,
        targetMarginPct: targetMargin
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-xl overflow-y-auto animate-fadeIn">
      <div 
        className="relative w-full max-w-3xl bg-[#0d111d]/90 border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-8 backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-white">
                Consola de Ejecución del Autopilot
              </h2>
              <p className="text-xs text-slate-400">
                Lanza el ciclo completo de 12 etapas (Descubrimiento → Análisis IA → Scoring → Publicación)
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

        <div className="grid grid-cols-1 md:grid-cols-12 gap-0 divide-y md:divide-y-0 md:divide-x divide-white/10">
          {/* Controls Column */}
          <form onSubmit={handleStartRun} className="p-6 md:col-span-6 space-y-5 text-xs">
            <h3 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-400" />
              <span>Parámetros de la Misión</span>
            </h3>

            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">Categoría a Procesar</label>
              <select
                value={targetCategory}
                onChange={(e) => setTargetCategory(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 backdrop-blur-md"
              >
                <option value="Relojería" className="bg-[#0d111d] text-slate-200">Relojería & Cronógrafos</option>
                <option value="Audio & Sonido" className="bg-[#0d111d] text-slate-200">Audio & Auriculares Hi-Fi</option>
                <option value="Hogar & Confort" className="bg-[#0d111d] text-slate-200">Hogar & Iluminación</option>
                <option value="Accesorios Tech" className="bg-[#0d111d] text-slate-200">Accesorios Tech & Ergonomía</option>
                <option value="Cuidado Personal" className="bg-[#0d111d] text-slate-200">Cuidado Personal</option>
              </select>
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 backdrop-blur-md">
              <div className="flex justify-between text-slate-300">
                <span>Candidatos a Procesar en Lote:</span>
                <span className="font-mono text-indigo-300 font-bold">{maxBatch} ítems</span>
              </div>
              <input
                type="range"
                min="1"
                max="4"
                step="1"
                value={maxBatch}
                onChange={(e) => setMaxBatch(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 backdrop-blur-md">
              <div className="flex justify-between text-slate-300">
                <span>Margen Objetivo Mínimo:</span>
                <span className="font-mono text-emerald-400 font-bold">{targetMargin}%</span>
              </div>
              <input
                type="range"
                min="35"
                max="75"
                step="5"
                value={targetMargin}
                onChange={(e) => setTargetMargin(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-2 backdrop-blur-md">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoPublish}
                  onChange={(e) => setAutoPublish(e.target.checked)}
                  className="mt-0.5 accent-indigo-500 rounded"
                />
                <div>
                  <span className="font-semibold text-slate-200 block">Auto-publicar si Score &gt; 85</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Los productos con Tier S o A pasarán directamente a la tienda pública.
                  </span>
                </div>
              </label>
            </div>

            <button
              type="submit"
              disabled={isExecuting || isAutopilotRunning}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-600/25 active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isExecuting || isAutopilotRunning ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Autopilot en Ejecución...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Iniciar Pipeline Inteligente</span>
                </>
              )}
            </button>
          </form>

          {/* Live Log Streaming Console */}
          <div className="p-6 md:col-span-6 bg-white/[0.01] flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-white/10 text-xs">
                <span className="font-mono text-slate-300 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                  Terminal de Eventos en Vivo
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              </div>

              <div className="mt-3 bg-black/40 p-3 rounded-xl border border-white/10 font-mono text-[11px] space-y-1.5 h-64 overflow-y-auto backdrop-blur-md">
                {activeLogs.length === 0 ? (
                  <div className="text-slate-500 text-center py-20">
                    Sistema listo. Inicia el pipeline para observar las etapas en tiempo real.
                  </div>
                ) : (
                  activeLogs.map((log, index) => (
                    <div key={index} className="text-slate-300 leading-tight">
                      <span className="text-slate-500">[{new Date().toLocaleTimeString()}]</span>{' '}
                      <span className="text-emerald-400">⚡</span> {log}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="text-[10px] text-slate-500 space-y-1">
              <p>• Motor IA: Gemini 2.5 Flash en Cloud Run Backend.</p>
              <p>• Persistencia: Google Cloud Firestore con trazabilidad inmutable.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
