import React from 'react';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const StoreFooter: React.FC = () => {
  const { setViewMode, userProfile, setIsAuthModalOpen } = useApp();

  return (
    <footer className="border-t border-[#7b594c]/15 bg-[#e8dac9] text-sm text-[#76635c]">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-[1.35fr_.75fr_.75fr_1fr] lg:py-16">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#7b594c]/30 bg-[#f6ede2] font-serif text-lg font-black text-[#7b594c]">V</div>
            <h2 className="font-serif text-xl tracking-[0.2em] text-[#3b2b28]">VICTORIOSA</h2>
          </div>
          <p className="mt-4 max-w-sm leading-6">Una tienda de belleza en apertura progresiva, construida para elegir menos y entender mejor por qué cada producto está ahí.</p>
          <button onClick={() => setIsAuthModalOpen(true)} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#3b2b28] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#7b594c]">
            <Sparkles className="h-3.5 w-3.5" /> Ingresar o crear cuenta
          </button>
          {userProfile?.role === 'admin' && <button onClick={() => setViewMode('admin')} className="ml-2 mt-5 rounded-full border border-[#7b594c]/20 px-4 py-2.5 text-xs font-semibold text-[#7b594c]">Administrar</button>}
        </div>

        <div>
          <h3 className="font-semibold text-[#3b2b28]">Explorar</h3>
          <nav className="mt-4 flex flex-col gap-3">
            <a href="#descubrir" className="transition hover:text-[#3b2b28]">Descubrir</a>
            <a href="#catalogo" className="transition hover:text-[#3b2b28]">Catálogo</a>
            <a href="#rituales" className="transition hover:text-[#3b2b28]">Guía de rutina</a>
            <a href="#proximamente" className="transition hover:text-[#3b2b28]">Próximamente</a>
          </nav>
        </div>

        <div>
          <h3 className="font-semibold text-[#3b2b28]">Victoriosa</h3>
          <nav className="mt-4 flex flex-col gap-3">
            <a href="#como-elegimos" className="transition hover:text-[#3b2b28]">Cómo elegimos</a>
            <a href="#asesoria" className="transition hover:text-[#3b2b28]">Asesoría</a>
            <a href="#faq" className="transition hover:text-[#3b2b28]">Preguntas frecuentes</a>
          </nav>
        </div>

        <div>
          <h3 className="font-semibold text-[#3b2b28]">Compra responsable</h3>
          <p className="mt-4 leading-6">Stock, precio, envío y condiciones de pago deben estar confirmados antes de habilitar una compra. Un producto visible no debe esconder incertidumbre operativa.</p>
          <a href="#faq" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#7b594c]">Leer cómo funciona <ArrowUpRight className="h-3.5 w-3.5" /></a>
        </div>
      </div>

      <div className="border-t border-[#7b594c]/15 px-6 py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Victoriosa · Uruguay</span>
          <span>Catálogo y pagos sujetos a validación antes de la compra.</span>
        </div>
      </div>
    </footer>
  );
};
