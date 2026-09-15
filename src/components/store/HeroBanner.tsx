import React from 'react';
import { ArrowRight, CalendarDays, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface HeroBannerProps {
  onExploreClick: () => void;
  onEvaluationClick: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ onExploreClick, onEvaluationClick }) => {
  const { setViewMode, userProfile } = useApp();

  return (
    <section className="bg-[#f8f1e8] px-4 pb-8 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
      <div className="mx-auto max-w-7xl">
        <div className="relative isolate min-h-[560px] overflow-hidden rounded-[2rem] sm:min-h-[620px] lg:min-h-[680px] lg:rounded-[2.75rem]">
          <picture className="absolute inset-0 -z-20">
            <source media="(max-width: 640px)" srcSet="/brand/sofia-victoria-hero-mobile.jpg" />
            <img src="/brand/sofia-victoria-hero.jpg" alt="Universo editorial de belleza Victoriosa" className="h-full w-full object-cover object-center" />
          </picture>
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(59,43,40,.14),rgba(59,43,40,.34)_48%,rgba(59,43,40,.76))]" />
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_35%,rgba(255,250,244,.22),transparent_45%)]" />

          <div className="flex min-h-[560px] flex-col items-center justify-center px-6 py-20 text-center text-[#fffaf4] sm:min-h-[620px] lg:min-h-[680px]">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] backdrop-blur-md sm:text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Selección de belleza en apertura progresiva</span>
            </div>

            <h1 className="max-w-4xl font-serif text-5xl leading-[.98] tracking-[-.04em] sm:text-7xl lg:text-[7.25rem]">
              Tu belleza,
              <span className="block font-normal italic">en calma</span>
            </h1>

            <p className="mt-7 max-w-2xl text-sm leading-7 text-white/85 sm:text-base">
              Un espacio para descubrir productos, herramientas y rituales elegidos con criterio, sin convertir el cuidado personal en otra lista interminable.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button onClick={onExploreClick} className="inline-flex items-center gap-2 rounded-full bg-[#fffaf4] px-6 py-3.5 text-sm font-semibold text-[#3b2b28] shadow-xl transition hover:bg-white">
                Descubrir la selección <ArrowRight className="h-4 w-4" />
              </button>
              <button onClick={onEvaluationClick} className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20">
                <CalendarDays className="h-4 w-4" /> Conocer la guía
              </button>
              {userProfile?.role === 'admin' && (
                <button onClick={() => setViewMode('admin')} className="rounded-full border border-white/40 bg-black/20 px-5 py-3.5 text-sm font-medium text-white/90 backdrop-blur transition hover:bg-black/30">
                  Vista privada
                </button>
              )}
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[10px] uppercase tracking-[0.2em] text-white/75 sm:text-xs">
              <span>Curaduría real</span><span>•</span><span>Logística verificada</span><span>•</span><span>Rutinas simples</span>
            </div>
            <p className="mt-7 flex items-center gap-2 text-xs text-white/75"><UserRound className="h-3.5 w-3.5" /> Selección editorial Victoriosa</p>
          </div>
        </div>

        <div className="grid grid-cols-1 divide-y divide-[#7b594c]/15 rounded-b-[2rem] border-x border-b border-[#7b594c]/15 bg-[#fffaf4]/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:rounded-b-[2.5rem]">
          <div className="flex items-center gap-4 px-6 py-6 sm:px-8"><Sparkles className="h-5 w-5 text-[#7b594c]" /><div><p className="font-serif text-lg text-[#3b2b28]">Selección curada</p><p className="mt-1 text-xs text-[#76635c]">Menos cantidad, más criterio.</p></div></div>
          <div className="flex items-center gap-4 px-6 py-6 sm:px-8"><UserRound className="h-5 w-5 text-[#7b594c]" /><div><p className="font-serif text-lg text-[#3b2b28]">Navegación simple</p><p className="mt-1 text-xs text-[#76635c]">Elegí por intención y rutina.</p></div></div>
          <div className="flex items-center gap-4 px-6 py-6 sm:px-8"><ShieldCheck className="h-5 w-5 text-[#7b594c]" /><div><p className="font-serif text-lg text-[#3b2b28]">Antes de publicar</p><p className="mt-1 text-xs text-[#76635c]">Stock, envío y condiciones se revisan.</p></div></div>
        </div>
      </div>
    </section>
  );
};
