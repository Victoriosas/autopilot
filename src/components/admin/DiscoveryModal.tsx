import React, { useState } from 'react';
import { 
  X, 
  Search, 
  Sparkles, 
  Link, 
  Globe, 
  Info,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface DiscoveryModalProps {
  onClose: () => void;
}

export const DiscoveryModal: React.FC<DiscoveryModalProps> = ({ onClose }) => {
  const { discoverProducts, importProductFromUrl, connectors, isAutopilotRunning } = useApp();
  const [tab, setTab] = useState<'market' | 'url'>('market');
  
  // Market Explorer State
  const [category, setCategory] = useState('Relojería');
  const [source, setSource] = useState('Supplier Hub B2B');
  const [keyword, setKeyword] = useState('');
  const [batchCount, setBatchCount] = useState(3);
  const [isDiscovering, setIsDiscovering] = useState(false);

  // Direct URL State
  const [directUrl, setDirectUrl] = useState('');
  const [isImportingUrl, setIsImportingUrl] = useState(false);

  // Get active connector config for badge & warning
  const activeConnector = connectors.find(c => 
    c.platform.toLowerCase() === source.toLowerCase() || 
    c.name.toLowerCase().includes(source.toLowerCase())
  );

  const handleRunDiscovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDiscovering(true);
    try {
      await discoverProducts(category, source, batchCount, keyword);
      onClose();
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleDirectUrlImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directUrl.trim()) return;
    setIsImportingUrl(true);
    try {
      await importProductFromUrl(directUrl.trim());
      onClose();
    } finally {
      setIsImportingUrl(false);
    }
  };

  const presetQueries = [
    { label: 'Relojes Automáticos Skeleton', cat: 'Relojería', kw: 'reloj automático skeleton acero', src: 'Supplier Hub B2B' },
    { label: 'Audio Hi-Fi Cancelación Ruido', cat: 'Audio & Sonido', kw: 'auriculares inalámbricos ANC 40mm', src: 'Amazon Global' },
    { label: 'Accesorios Escritorio Premium', cat: 'Hogar & Confort', kw: 'organizador escritorio nogal macizo', src: 'Supplier Hub B2B' },
    { label: 'Lámparas Esculturales Minimalistas', cat: 'Hogar & Confort', kw: 'lámpara led levitación magnética', src: 'AliExpress Direct' },
    { label: 'Grooming & Barba Titanio', cat: 'Cuidado Personal', kw: 'kit afeitado clásico titanio', src: 'Supplier Hub B2B' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-xl overflow-y-auto animate-fadeIn">
      <div 
        className="relative w-full max-w-2xl bg-[#0d111d]/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-8 backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-white">
                Descubrimiento & Ingesta Autopilot
              </h2>
              <p className="text-xs text-slate-400">
                Captura candidatos en bruto desde marketplaces o enlaces directos de fabricantes
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

        {/* Tab Selector */}
        <div className="flex border-b border-white/10 bg-white/[0.01] px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setTab('market')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              tab === 'market'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Explorador de Marketplaces B2B/B2C</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('url')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              tab === 'url'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Link className="w-3.5 h-3.5" />
            <span>Importación Directa por URL</span>
          </button>
        </div>

        {/* Tab 1: Market Search */}
        {tab === 'market' && (
          <form onSubmit={handleRunDiscovery} className="p-6 space-y-6 text-xs">
            
            {/* Preset Shortcuts */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Nichos Estratégicos Recomendados
              </label>
              <div className="flex flex-wrap gap-2">
                {presetQueries.map((q, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => {
                      setCategory(q.cat);
                      setKeyword(q.kw);
                      setSource(q.src);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-[11px] transition-all flex items-center gap-1.5 backdrop-blur-sm hover:border-indigo-400/40"
                  >
                    <Sparkles className="w-3 h-3 text-indigo-400" />
                    <span>{q.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Category */}
              <div>
                <label className="block text-slate-300 mb-1.5 font-medium">Categoría Objetivo</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 backdrop-blur-md"
                >
                  <option value="Relojería" className="bg-[#0d111d] text-slate-200">Relojería & Alta Precisión</option>
                  <option value="Audio & Sonido" className="bg-[#0d111d] text-slate-200">Audio & Sonido Hi-Fi</option>
                  <option value="Hogar & Confort" className="bg-[#0d111d] text-slate-200">Hogar & Confort Contemporáneo</option>
                  <option value="Accesorios Tech" className="bg-[#0d111d] text-slate-200">Accesorios Tech & Ergonomía</option>
                  <option value="Cuidado Personal" className="bg-[#0d111d] text-slate-200">Cuidado Personal & Grooming</option>
                  <option value="Bolsos & Piel" className="bg-[#0d111d] text-slate-200">Bolsos & Marroquinería</option>
                </select>
              </div>

              {/* Source Marketplace */}
              <div>
                <label className="block text-slate-300 mb-1.5 font-medium">Fuente / Marketplace</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 backdrop-blur-md"
                >
                  <option value="Supplier Hub B2B" className="bg-[#0d111d] text-slate-200">Supplier Hub B2B (Automático UE)</option>
                  <option value="Amazon Global" className="bg-[#0d111d] text-slate-200">Amazon Global (Acción Humana)</option>
                  <option value="AliExpress Direct" className="bg-[#0d111d] text-slate-200">AliExpress Direct (DS API / Manual)</option>
                  <option value="Alibaba Wholesale" className="bg-[#0d111d] text-slate-200">Alibaba Wholesale (Trade Assurance)</option>
                </select>
              </div>
            </div>

            {/* Connector Status Notice */}
            {activeConnector && (
              <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                activeConnector.status === 'IMPLEMENTED'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : activeConnector.status === 'REQUIRES_HUMAN_ACTION'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                {activeConnector.status === 'IMPLEMENTED' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                ) : activeConnector.status === 'REQUIRES_HUMAN_ACTION' ? (
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                ) : (
                  <Lock className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                )}
                <div className="text-[11px] leading-relaxed">
                  <div className="font-bold uppercase tracking-wider text-[10px]">
                    Estado de Conector: {activeConnector.status}
                  </div>
                  <div className="mt-0.5 opacity-90">{activeConnector.statusReason}</div>
                </div>
              </div>
            )}

            {/* Custom Search Keywords */}
            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">Palabras Clave de Foco (Opcional)</label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Ej. reloj cronógrafo acero 316L cristal zafiro..."
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 backdrop-blur-md"
              />
            </div>

            {/* Ingestion Batch Size */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 backdrop-blur-md">
              <div className="flex justify-between text-slate-300 font-medium">
                <span>Volumen de Ingesta Inmediata:</span>
                <span className="font-mono text-indigo-300 font-bold">{batchCount} productos</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={batchCount}
                onChange={(e) => setBatchCount(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 block">
                Los nuevos productos ingresarán con estado <strong className="text-slate-200">"discovered"</strong> listos para la evaluación con IA.
              </span>
            </div>

            {/* Submit Action */}
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
                disabled={isDiscovering || isAutopilotRunning}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-indigo-600/25 flex items-center gap-2 disabled:opacity-50"
              >
                {isDiscovering ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Explorando Marketplace...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Iniciar Ingesta de Candidatos</span>
                  </>
                )}
              </button>
            </div>

          </form>
        )}

        {/* Tab 2: Direct URL Import */}
        {tab === 'url' && (
          <form onSubmit={handleDirectUrlImport} className="p-6 space-y-6 text-xs">
            <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 flex items-start gap-3">
              <Info className="w-5 h-5 shrink-0 text-indigo-400 mt-0.5" />
              <div className="leading-relaxed text-[11px]">
                <strong>Extractor Universal de Enlaces:</strong> Pega la URL de cualquier producto en Amazon, AliExpress, Alibaba, o catálogo de fabricante. El Autopilot extraerá los datos, calculará márgenes y ejecutará el pipeline completo de transformación de marca.
              </div>
            </div>

            <div>
              <label className="block text-slate-300 mb-2 font-medium">URL Directa del Producto</label>
              <div className="relative">
                <input
                  type="url"
                  required
                  value={directUrl}
                  onChange={(e) => setDirectUrl(e.target.value)}
                  placeholder="https://www.amazon.es/dp/B09XYZ123 o https://es.aliexpress.com/item/..."
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 backdrop-blur-md pl-10"
                />
                <Link className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              </div>
            </div>

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
                disabled={isImportingUrl || !directUrl.trim()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-indigo-600/25 flex items-center gap-2 disabled:opacity-50"
              >
                {isImportingUrl ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Extrayendo y Procesando URL...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    <span>Importar y Procesar Candidato</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
