import React from 'react';
import { ArrowRight, Search, Truck, Heart } from 'lucide-react';

interface HeroBannerProps {
  onExploreClick: () => void;
  onEvaluationClick: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ onExploreClick, onEvaluationClick }) => (
  <section className="bg-[#f8f1e8] px-4 pt-5 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl">
      <div className="relative isolate overflow-hidden rounded-3xl bg-[#e9ddcf]">
        <img src="/brand/sofia-victoria-hero.jpg" alt="Universo editorial de belleza Victoriosa" className="absolute inset-0 -z-20 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(59,43,40,.94),rgba(59,43,40,.8)_45%,rgba(59,43,40,.16))]" />
        <div className="max-w-2xl px-6 py-8 text-[#fffaf4] sm:px-10 sm:py-10">
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#ead8c4]">Cuidado facial · accesorios · spa en casa</p>
          <h1 className="mt-3 font-serif text-3xl leading-tight sm:text-5xl">Tu próxima rutina,<br /><span className="italic">empieza acá</span></h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-white/85">Encontrá tu selección de belleza por rutina y presupuesto.</p>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <button onClick={onExploreClick} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#fffaf4] px-5 py-3 text-sm font-semibold text-[#3b2b28] hover:bg-white">Explorar catálogo <ArrowRight className="h-4 w-4" /></button>
            <button onClick={onEvaluationClick} className="min-h-11 text-sm underline underline-offset-4">Guía de rutinas</button>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-7 gap-y-3 border-b border-[#7b594c]/15 pb-4 text-xs text-[#76635c]">
        <span className="inline-flex items-center gap-2"><Search className="h-4 w-4" /> Buscá por producto o rutina</span>
        <span className="inline-flex items-center gap-2"><Heart className="h-4 w-4" /> Guardá tus favoritos</span>
        <a href="#faq" className="inline-flex min-h-6 items-center gap-2 underline underline-offset-4"><Truck className="h-4 w-4" /> Consultá envíos y condiciones</a>
      </div>
    </div>
  </section>
);
