import React, { useState } from 'react';
import { Activity, ArrowUpRight, BookOpenCheck, ClipboardList, HeartHandshake, MessageSquareText, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { ConsultationBell } from './ConsultationBell';
import { ConsultationInbox } from './ConsultationInbox';
import { BeautyRequestsPanel } from './BeautyRequestsPanel';
import { BeautyCatalogPanel } from './BeautyCatalogPanel';
import { ConsultationLabPanel } from './ConsultationLabPanel';
import { SixAgentStatusPanel } from './SixAgentStatusPanel';

type Workspace = 'consultas' | 'solicitudes' | 'servicios' | 'conocimiento' | 'agentes';

const sections: Record<Workspace, { title: string; description: string }> = {
  consultas: { title: 'Consultas de clientes', description: 'Revisá los mensajes recibidos, prepará respuestas y confirmá cada envío desde la bandeja privada.' },
  solicitudes: { title: 'Solicitudes de atención', description: 'Seguí las solicitudes de evaluación y sus estados. Ningún turno se confirma automáticamente.' },
  servicios: { title: 'Servicios de Victoriosas', description: 'Administrá el catálogo histórico de servicios. No se publican precios ni tratamientos sin aprobación.' },
  conocimiento: { title: 'Fichas profesionales de Victoria', description: 'Revisá los 17 tratamientos, guardá borradores privados y aprobá datos para IA solo después de una revisión profesional.' },
  agentes: { title: 'Agentes de Autopilot', description: 'Consultá el estado real y las tareas verificadas en Supabase. No se supone actividad sin evidencia.' },
};

export function ProfessionalAdminHub({ onOpenAccount, sessionKey }: { onOpenAccount(): void; sessionKey: string }) {
  const [active, setActive] = useState<Workspace>('consultas');
  // Keep visited sections mounted so unsaved service or evaluation edits survive tab changes.
  const [visited, setVisited] = useState<Set<Workspace>>(() => new Set(['consultas']));
  const openSection = (next: Workspace) => {
    setVisited(previous => new Set([...previous, next]));
    setActive(next);
  };
  const section = sections[active];
  const tabClass = (selected: boolean) =>
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ' +
    (selected ? 'border-amber-300/70 bg-amber-200 text-stone-950 shadow-lg shadow-amber-950/20' : 'border-white/15 bg-white/5 text-stone-200 hover:border-amber-300/50 hover:bg-white/10');

  return (
    <div className="min-h-screen flex-1 bg-[#120f0d] text-stone-100">
      <header className="border-b border-amber-200/15 bg-[#1c1714] px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-300/30 bg-amber-200/10 text-amber-200">
              <Sparkles size={22} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xl font-semibold tracking-[0.12em] text-[#e9d4b1]">VICTORIOSAS</p>
              <p className="text-xs tracking-wide text-stone-400">Centro de atención · Autopilot</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href="/" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm text-stone-100 hover:bg-white/10">
              Ver sitio <ArrowUpRight size={16} aria-hidden="true" />
            </a>
            <button type="button" onClick={onOpenAccount} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-200/10 px-4 py-2 text-sm text-amber-100 hover:bg-amber-200/20">
              <UserRound size={16} aria-hidden="true" /> Mi cuenta
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pb-14 pt-7 sm:px-6">
        <div className="mb-7 rounded-3xl border border-amber-200/15 bg-gradient-to-br from-[#342820] via-[#221b17] to-[#191512] p-6 shadow-2xl shadow-black/20 sm:p-8">
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#dfbc84]">
            <HeartHandshake size={16} aria-hidden="true" /> Atención profesional
          </p>
          <h1 className="text-3xl font-semibold text-[#f6ead8] sm:text-4xl">Tu espacio de trabajo</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-300 sm:text-base">
            Todo lo necesario para atender consultas, seguir solicitudes y supervisar Autopilot, sin herramientas de tienda que no usamos.
          </p>
          <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-100/20 bg-black/20 px-3 py-2 text-xs text-amber-100">
            <ShieldCheck size={15} aria-hidden="true" /> Las respuestas a clientes requieren revisión humana
          </p>
        </div>
        <nav aria-label="Secciones de Victoriosas Autopilot" className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-5">
          <ConsultationBell selected={active === 'consultas'} onOpen={() => openSection('consultas')} />
          <button type="button" className={tabClass(active === 'solicitudes')} aria-current={active === 'solicitudes' ? 'page' : undefined} onClick={() => openSection('solicitudes')}>
            <ClipboardList size={18} aria-hidden="true" /> Solicitudes
          </button>
          <button type="button" className={tabClass(active === 'servicios')} aria-current={active === 'servicios' ? 'page' : undefined} onClick={() => openSection('servicios')}>
            <Sparkles size={18} aria-hidden="true" /> Servicios
          </button>
          <button type="button" className={tabClass(active === 'conocimiento')} aria-current={active === 'conocimiento' ? 'page' : undefined} onClick={() => openSection('conocimiento')}>
            <BookOpenCheck size={18} aria-hidden="true" /> Fichas
          </button>
          <button type="button" className={tabClass(active === 'agentes')} aria-current={active === 'agentes' ? 'page' : undefined} onClick={() => openSection('agentes')}>
            <Activity size={18} aria-hidden="true" /> Agentes
          </button>
        </nav>
        <section aria-labelledby="workspace-title" className="rounded-2xl border border-white/10 bg-[#1c1816] p-4 shadow-lg shadow-black/10 sm:p-6">
          <div className="mb-5 flex items-start gap-3 border-b border-white/10 pb-5">
            <MessageSquareText className="mt-1 shrink-0 text-[#dab783]" size={21} aria-hidden="true" />
            <div>
              <h2 id="workspace-title" className="text-2xl font-semibold text-[#f4e7d5]">{section.title}</h2>
              <p className="mt-1 text-sm leading-6 text-stone-300">{section.description}</p>
            </div>
          </div>
          {visited.has('consultas') && <div hidden={active !== 'consultas'}><ConsultationInbox key={'consultas-' + sessionKey} /></div>}
          {visited.has('solicitudes') && <div hidden={active !== 'solicitudes'}><BeautyRequestsPanel key={'solicitudes-' + sessionKey} /></div>}
          {visited.has('servicios') && <div hidden={active !== 'servicios'}><BeautyCatalogPanel key={'servicios-' + sessionKey} /></div>}
          {visited.has('conocimiento') && <div hidden={active !== 'conocimiento'}><ConsultationLabPanel /></div>}
          {visited.has('agentes') && <div hidden={active !== 'agentes'}><SixAgentStatusPanel /></div>}
        </section>
        <p className="mt-6 text-center text-xs text-stone-500">Panel privado de Victoriosas · Sin tienda, pagos ni publicaciones automáticas</p>
      </main>
    </div>
  );
}
