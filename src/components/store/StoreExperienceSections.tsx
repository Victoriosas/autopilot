import React from 'react';
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Heart,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
  UserRound,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface StoreExperienceProps {
  onSelectCategory: (category: string) => void;
}

const scrollToId = (id: string) => {
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
};

export const StoreDiscoverySections: React.FC<StoreExperienceProps> = ({ onSelectCategory }) => {
  const discover = (category: string) => {
    onSelectCategory(category);
    scrollToId('catalogo');
  };

  return (
    <>
      <section id="descubrir" className="bg-[#f8f1e8] px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#9c7868]">Descubrí por intención</p>
              <h2 className="mt-2 max-w-2xl font-serif text-3xl leading-tight text-[#3b2b28] sm:text-5xl">Tu rutina no necesita más cosas. Necesita mejores elecciones.</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-[#76635c]">Victoriosa organiza la selección por momentos de cuidado para que navegar sea simple, incluso antes de que el catálogo completo esté abierto.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <button onClick={() => discover('Rostro')} className="group relative min-h-72 overflow-hidden rounded-[2rem] bg-[#d8c1b1] p-7 text-left transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#7b594c]/10">
              <div className="absolute -right-12 -top-16 h-56 w-56 rounded-full bg-white/25 blur-2xl" />
              <span className="relative text-[10px] font-semibold uppercase tracking-[0.25em] text-[#654b42]">01 · Rostro</span>
              <div className="relative mt-24">
                <h3 className="font-serif text-3xl text-[#3b2b28]">Rituales faciales</h3>
                <p className="mt-3 max-w-xs text-sm leading-6 text-[#654b42]">Accesorios, herramientas y cuidado cotidiano para una rutina clara y agradable.</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#3b2b28]">Explorar <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
              </div>
            </button>

            <button onClick={() => discover('Cuerpo')} className="group relative min-h-72 overflow-hidden rounded-[2rem] bg-[#d7d0bf] p-7 text-left transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#7b594c]/10">
              <div className="absolute -bottom-12 -left-10 h-52 w-52 rounded-full bg-white/30 blur-2xl" />
              <span className="relative text-[10px] font-semibold uppercase tracking-[0.25em] text-[#625b4e]">02 · Cuerpo</span>
              <div className="relative mt-24">
                <h3 className="font-serif text-3xl text-[#3b2b28]">Cuidado corporal</h3>
                <p className="mt-3 max-w-xs text-sm leading-6 text-[#625b4e]">Momentos simples para sumar bienestar sin convertir la rutina en una obligación.</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#3b2b28]">Explorar <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
              </div>
            </button>

            <button onClick={() => discover('Kits')} className="group relative min-h-72 overflow-hidden rounded-[2rem] bg-[#cabbb6] p-7 text-left transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#7b594c]/10">
              <div className="absolute right-6 top-8 h-32 w-32 rounded-full border border-white/30" />
              <span className="relative text-[10px] font-semibold uppercase tracking-[0.25em] text-[#654b42]">03 · Kits</span>
              <div className="relative mt-24">
                <h3 className="font-serif text-3xl text-[#3b2b28]">Rutinas listas</h3>
                <p className="mt-3 max-w-xs text-sm leading-6 text-[#654b42]">Combinaciones pensadas para empezar, regalar o simplificar decisiones.</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#3b2b28]">Explorar <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
              </div>
            </button>
          </div>
        </div>
      </section>

      <section className="bg-[#fffaf4] px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[2.25rem] border border-[#7b594c]/15 bg-[#efe3d4] lg:grid-cols-[1.05fr_.95fr]">
          <div className="relative min-h-[420px] lg:min-h-[560px]">
            <img src="/brand/victoriosa-hero-editorial.png" alt="Universo editorial Victoriosa" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#3b2b28]/45 via-transparent to-transparent" />
          </div>
          <div className="flex flex-col justify-center px-7 py-12 sm:px-12 lg:px-16">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#9c7868]">La idea detrás de Victoriosa</p>
            <h2 className="mt-4 font-serif text-4xl leading-[1.05] text-[#3b2b28] sm:text-5xl">Menos ruido. Más criterio para elegir.</h2>
            <p className="mt-6 text-sm leading-7 text-[#76635c]">No queremos construir un catálogo infinito. Cada producto debe tener una razón para estar: encajar con el universo de belleza, tener evidencia de proveedor, condiciones de envío entendibles y una propuesta de valor razonable.</p>
            <p className="mt-4 text-sm leading-7 text-[#76635c]">Nuestro sistema de selección ayuda a investigar y comparar. La publicación final sigue pasando por barreras de calidad y revisión antes de aparecer en la tienda.</p>
            <a href="#como-elegimos" className="mt-7 inline-flex w-fit items-center gap-2 rounded-full border border-[#7b594c]/25 bg-[#fffaf4]/70 px-5 py-3 text-sm font-semibold text-[#3b2b28] transition hover:bg-[#fffaf4]">Cómo elegimos <ArrowRight className="h-4 w-4" /></a>
          </div>
        </div>
      </section>
    </>
  );
};

export const StoreTrustSections: React.FC<StoreExperienceProps> = ({ onSelectCategory }) => {
  const { setIsAuthModalOpen, user } = useApp();

  return (
    <>
      <section id="rituales" className="bg-[#f8f1e8] px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#9c7868]">Guía Victoriosa</p>
            <h2 className="mt-3 font-serif text-4xl text-[#3b2b28] sm:text-5xl">Una rutina que puedas sostener</h2>
            <p className="mt-5 text-sm leading-7 text-[#76635c]">La mejor rutina suele ser la que entendés y repetís. Usamos tres momentos simples como mapa de navegación, no como receta médica.</p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              ['01', 'Preparar', 'Limpieza y preparación para empezar con una base simple.', Search],
              ['02', 'Cuidar', 'Productos y herramientas que acompañan objetivos cotidianos.', Heart],
              ['03', 'Sostener', 'Hábitos y accesorios que ayudan a mantener la rutina en el tiempo.', Sparkles],
            ].map(([step, title, copy, Icon]: any) => (
              <div key={step} className="rounded-[1.75rem] border border-[#7b594c]/15 bg-[#fffaf4] p-7">
                <div className="flex items-center justify-between"><span className="font-mono text-xs text-[#9c7868]">{step}</span><Icon className="h-5 w-5 text-[#7b594c]" /></div>
                <h3 className="mt-10 font-serif text-2xl text-[#3b2b28]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#76635c]">{copy}</p>
              </div>
            ))}
          </div>

          <div id="asesoria" className="mt-6 flex flex-col items-start justify-between gap-5 rounded-[1.75rem] border border-[#7b594c]/15 bg-[#3b2b28] px-7 py-7 text-[#fffaf4] sm:flex-row sm:items-center sm:px-9">
            <div><p className="text-xs uppercase tracking-[0.22em] text-white/60">No sabés por dónde empezar</p><h3 className="mt-2 font-serif text-2xl">Explorá primero, decidí después.</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">La sección de asesoría evolucionará junto con el catálogo. Mientras tanto podés crear tu cuenta y volver cuando abramos nuevas selecciones.</p></div>
            <button onClick={() => setIsAuthModalOpen(true)} className="shrink-0 rounded-full bg-[#fffaf4] px-5 py-3 text-sm font-semibold text-[#3b2b28] transition hover:bg-white">{user && !user.isAnonymous ? 'Ver mi cuenta' : 'Crear mi cuenta'}</button>
          </div>
        </div>
      </section>

      <section id="como-elegimos" className="bg-[#fffaf4] px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
            <div className="lg:sticky lg:top-40">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#9c7868]">Detrás del catálogo</p>
              <h2 className="mt-3 font-serif text-4xl leading-tight text-[#3b2b28] sm:text-5xl">Antes de mostrarte algo, intentamos demostrar que merece estar.</h2>
              <p className="mt-5 text-sm leading-7 text-[#76635c]">Victoriosa usa automatización para investigar, pero no para saltarse las preguntas importantes.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                [Search, 'Proveedor y evidencia', 'Verificamos identidad del producto, variantes, stock y datos observables del proveedor antes de avanzar.'],
                [Truck, 'Logística a Uruguay', 'El envío y sus condiciones tienen que estar respaldados por información real. Lo desconocido no se trata como cero.'],
                [CheckCircle2, 'Economía completa', 'Costo, flete, reservas, comisiones y margen se evalúan juntos. Un precio atractivo no alcanza si la estructura no cierra.'],
                [ShieldCheck, 'Revisión y límites', 'Productos sensibles o regulados requieren una revisión adicional. El sistema puede detener un producto aunque el margen sea bueno.'],
              ].map(([Icon, title, copy]: any) => (
                <article key={title} className="rounded-[1.75rem] border border-[#7b594c]/15 bg-[#f8f1e8] p-7">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7b594c]/10"><Icon className="h-5 w-5 text-[#7b594c]" /></div>
                  <h3 className="mt-6 font-serif text-2xl text-[#3b2b28]">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#76635c]">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="proximamente" className="bg-[#efe3d4] px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.25rem] bg-[#3b2b28] px-7 py-10 text-[#fffaf4] sm:px-12 sm:py-14 lg:px-16">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70"><Bell className="h-3.5 w-3.5" /> Primera selección en curaduría</div>
              <h2 className="mt-5 max-w-3xl font-serif text-4xl leading-tight sm:text-6xl">La tienda va a crecer despacio a propósito.</h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-white/70">Estamos construyendo una primera colección pública con accesorios de skincare, herramientas de cuidado, organización de belleza y kits. Solo aparecerán cuando estén listos para ser explicados con claridad.</p>
              <div className="mt-7 flex flex-wrap gap-2 text-xs text-white/75">{['Accesorios de skincare', 'Cuidado facial', 'Organización', 'Kits'].map((tag) => <span key={tag} className="rounded-full border border-white/15 bg-white/5 px-3 py-2">{tag}</span>)}</div>
            </div>
            <div className="rounded-[1.75rem] border border-white/10 bg-white/[.06] p-7 backdrop-blur">
              <UserRound className="h-7 w-7 text-[#d8c1b1]" />
              <h3 className="mt-5 font-serif text-2xl">Entrá antes que el catálogo esté lleno.</h3>
              <p className="mt-3 text-sm leading-6 text-white/65">Creá tu cuenta para tener un punto de regreso mientras abrimos nuevas selecciones y funcionalidades.</p>
              <button onClick={() => setIsAuthModalOpen(true)} className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#fffaf4] px-5 py-3 text-sm font-semibold text-[#3b2b28] transition hover:bg-white">{user && !user.isAnonymous ? 'Abrir mi cuenta' : 'Crear cuenta'} <ArrowRight className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="bg-[#f8f1e8] px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-5xl">
          <div className="text-center"><p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#9c7868]">Preguntas frecuentes</p><h2 className="mt-3 font-serif text-4xl text-[#3b2b28] sm:text-5xl">Lo importante, sin letra chica creativa.</h2></div>
          <div className="mt-10 divide-y divide-[#7b594c]/15 border-y border-[#7b594c]/15">
            {[
              ['¿Ya se puede comprar?', 'Victoriosa está en apertura progresiva. Los productos solo se mostrarán como comprables cuando estén validados precio, stock, envío y condiciones del canal de pago. Si una opción de pago no está habilitada, la tienda no debe cobrarte.'],
              ['¿Envían a todo Uruguay?', 'La cobertura y el plazo dependen del producto y del proveedor. Antes de habilitar una compra mostramos y validamos la evidencia de envío disponible para Uruguay; no asumimos que un envío desconocido sea gratuito o inmediato.'],
              ['¿Cómo eligen los productos?', 'El motor de selección analiza proveedor, stock, logística, estructura de costos, encaje con Victoriosa y evidencia de mercado. Los bloqueos de seguridad o cumplimiento tienen prioridad sobre un buen margen.'],
              ['¿Qué pasa con cosméticos o productos regulados?', 'Reciben una revisión adicional antes de ser elegibles para publicación. Un producto no pasa automáticamente a venta solo porque tenga stock o rentabilidad.'],
              ['¿Puedo seguir el lanzamiento?', 'Sí. Podés crear una cuenta desde la tienda y volver a tu perfil mientras habilitamos nuevas selecciones y canales de compra.'],
            ].map(([question, answer]) => (
              <details key={question} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left font-medium text-[#3b2b28]"><span>{question}</span><span className="text-xl font-light text-[#9c7868] transition-transform group-open:rotate-45">+</span></summary>
                <p className="mt-4 max-w-3xl pr-10 text-sm leading-7 text-[#76635c]">{answer}</p>
              </details>
            ))}
          </div>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 text-center sm:flex-row"><button onClick={() => { onSelectCategory('Todos'); scrollToId('catalogo'); }} className="rounded-full bg-[#3b2b28] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#7b594c]">Ver catálogo</button><button onClick={() => setIsAuthModalOpen(true)} className="rounded-full border border-[#7b594c]/20 bg-[#fffaf4] px-5 py-3 text-sm font-semibold text-[#3b2b28] transition hover:border-[#7b594c]/40">Ingresar o crear cuenta</button></div>
        </div>
      </section>
    </>
  );
};
