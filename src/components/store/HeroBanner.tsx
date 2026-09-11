import React from 'react';
import { Sparkles, ShieldCheck, Cpu, ArrowRight, Award } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface HeroBannerProps {
  onExploreClick: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ onExploreClick }) => {
  const { publishedProducts, setViewMode } = useApp();

  return (
    <div className="relative overflow-hidden bg-white/[0.01] border-b border-white/10 backdrop-blur-md">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Main Hero Copy */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider backdrop-blur-md shadow-[0_0_15px_rgba(99,102,241,0.15)]">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Curaduría de Catálogo Autónoma & Inteligente</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold text-white tracking-tight leading-[1.1]">
              Excelencia tangible. <br />
              <span className="text-slate-400 font-normal italic font-serif">
                Descubierta con precisión.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
              Cada pieza en Victoriosa pasa por el filtro más exigente de nuestro Autopilot: análisis de materiales, fiabilidad logística, verificación de garantías y adaptación de diseño prémium.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={onExploreClick}
                className="px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 active:scale-[0.98] flex items-center gap-2 border border-white/10"
              >
                <span>Explorar Catálogo Activo</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setViewMode('admin')}
                className="px-5 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-sm font-medium border border-white/10 transition-all flex items-center gap-2 backdrop-blur-md hover:border-indigo-500/40"
              >
                <Cpu className="w-4 h-4 text-indigo-400" />
                <span>Ver Pipeline en Autopilot</span>
              </button>
            </div>

            {/* Trust Badges */}
            <div className="pt-6 border-t border-white/10 grid grid-cols-3 gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Garantía Oficial 3 Años</span>
              </div>
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <span>Score de Calidad &gt;90%</span>
              </div>
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span>Trazabilidad 100% Verificada</span>
              </div>
            </div>
          </div>

          {/* Featured Hero Product Card Showcase */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-3xl bg-white/5 border border-white/10 p-6 shadow-2xl backdrop-blur-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-white/10 text-xs text-slate-400">
                <span className="flex items-center gap-1.5 text-indigo-300 font-semibold uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  Publicado en Tiempo Real
                </span>
                <span className="font-mono text-slate-400">
                  {publishedProducts.length} Productos Aprobados
                </span>
              </div>

              <div className="mt-4 aspect-[4/3] rounded-2xl overflow-hidden bg-black/40 relative group border border-white/5">
                <img
                  src={publishedProducts[0]?.images[0] || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&auto=format&fit=crop&q=80"}
                  alt="Producto destacado"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-xl px-3 py-1 rounded-full text-xs font-semibold text-white border border-white/10">
                  {publishedProducts[0]?.category || 'Tecnología'}
                </div>
                <div className="absolute bottom-3 right-3 bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-sm font-bold shadow-lg border border-white/10">
                  ${((publishedProducts[0]?.price || 0) * 1.08).toFixed(2)}
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-base font-semibold text-white line-clamp-1">
                  {publishedProducts[0]?.title || 'Auriculares Hi-Fi Espaciales ANC'}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                  {publishedProducts[0]?.subtitle || 'Transductores de titanio y cancelación activa híbrida de 42dB'}
                </p>
                <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                  <span className="font-mono text-emerald-400">
                    Autopilot Score: {publishedProducts[0]?.traceability?.analysis?.overallScore || 95}/100 (Tier S)
                  </span>
                  <span className="text-slate-500">SKU: {publishedProducts[0]?.sku || 'VIC-AUD-7721'}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
