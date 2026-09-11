import React, { useState } from 'react';
import { 
  X, 
  Settings, 
  Save, 
  ShieldCheck, 
  Percent, 
  Sliders, 
  Sparkles,
  Database
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface AutopilotSettingsModalProps {
  onClose: () => void;
}

export const AutopilotSettingsModal: React.FC<AutopilotSettingsModalProps> = ({ onClose }) => {
  const { settings, updateSettings, showToast } = useApp();

  const [minMargin, setMinMargin] = useState(settings?.minMarginPct || 50);
  const [minScore, setMinScore] = useState(settings?.minQualityScore || 75);
  const [autoPublishThreshold, setAutoPublishThreshold] = useState(settings?.autoPublishThreshold || 85);
  const [maxRisk, setMaxRisk] = useState(settings?.maxAllowedRisk || 'medium');
  const [autoPublishEnabled, setAutoPublishEnabled] = useState(settings?.autoPublishEnabled || false);
  const [prohibitedWords, setProhibitedWords] = useState(
    settings?.prohibitedKeywords?.join(', ') || 'curativo, médico, milagroso, réplica, clon, garantizado 100% cura'
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings({
      minMarginPct: minMargin,
      minQualityScore: minScore,
      autoPublishThreshold,
      maxAllowedRisk: maxRisk as any,
      autoPublishEnabled,
      prohibitedKeywords: prohibitedWords.split(',').map(s => s.trim()).filter(Boolean)
    });
    showToast('Reglas de negocio del Autopilot actualizadas', 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-xl overflow-y-auto animate-fadeIn">
      <div 
        className="relative w-full max-w-2xl bg-[#0d111d]/90 border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-8 backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-white">
                Reglas de Negocio & Parámetros Autopilot
              </h2>
              <p className="text-xs text-slate-400">
                Límites automáticos de filtrado, riesgo, márgenes y políticas de publicación
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

        {/* Settings Form */}
        <form onSubmit={handleSave} className="p-6 space-y-5 text-xs">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Min Margin */}
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-2 backdrop-blur-md">
              <div className="flex justify-between text-slate-200">
                <span className="font-semibold">Margen Mínimo Aceptable</span>
                <span className="font-mono text-emerald-400 font-bold">{minMargin}%</span>
              </div>
              <input
                type="range"
                min="30"
                max="80"
                step="5"
                value={minMargin}
                onChange={(e) => setMinMargin(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 block">
                Candidatos con margen inferior se rechazan o marcan como bajo potencial.
              </span>
            </div>

            {/* Min Quality Score */}
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-2 backdrop-blur-md">
              <div className="flex justify-between text-slate-200">
                <span className="font-semibold">Puntuación Mínima Aprobación</span>
                <span className="font-mono text-indigo-300 font-bold">{minScore}/100</span>
              </div>
              <input
                type="range"
                min="50"
                max="90"
                step="5"
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 block">
                Score mínimo ponderado entre demanda, marca, calidad y logística.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Max Allowed Risk */}
            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">Nivel Máximo de Riesgo Permitido</label>
              <select
                value={maxRisk}
                onChange={(e) => setMaxRisk(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 backdrop-blur-md"
              >
                <option value="low" className="bg-[#0d111d] text-slate-200">Solo Riesgo Bajo (Ultra Estricto)</option>
                <option value="medium" className="bg-[#0d111d] text-slate-200">Riesgo Bajo y Medio (Recomendado)</option>
                <option value="high" className="bg-[#0d111d] text-slate-200">Permitir Riesgo Alto (Revisión manual)</option>
              </select>
            </div>

            {/* Auto Publish Threshold */}
            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">Umbral de Auto-Publicación</label>
              <select
                value={autoPublishThreshold}
                onChange={(e) => setAutoPublishThreshold(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 backdrop-blur-md"
              >
                <option value={90} className="bg-[#0d111d] text-slate-200">Tier S (Score &ge; 90) - Exclusivo</option>
                <option value={85} className="bg-[#0d111d] text-slate-200">Tier S y A+ (Score &ge; 85) - Óptimo</option>
                <option value={80} className="bg-[#0d111d] text-slate-200">Tier A (Score &ge; 80) - Flexible</option>
              </select>
            </div>
          </div>

          {/* Prohibited Keywords */}
          <div>
            <label className="block text-slate-300 mb-1.5 font-medium">
              Palabras Prohibidas & Claims no permitidos (separadas por coma)
            </label>
            <textarea
              rows={3}
              value={prohibitedWords}
              onChange={(e) => setProhibitedWords(e.target.value)}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-indigo-500 backdrop-blur-md"
            />
            <span className="text-[10px] text-slate-400 block mt-1">
              El motor de IA filtrará automáticamente cualquier producto que contenga estas expresiones.
            </span>
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-xs transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/25 transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Guardar Configuración</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
