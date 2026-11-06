import React, { useRef, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { consultationLabCases } from '../../storefront/consultationLabCases';
import type { runConsultationLab } from '../../storefront/consultationLab';
import type { ServiceKnowledge } from '../../storefront/consultationServiceKnowledge';
import { summarizeKnowledgeReview, knowledgeReviewLabel } from '../../storefront/consultationKnowledgeReview';

const base = '/api/beauty/inquiries/admin/lab';
const headers = { 'content-type': 'application/json', 'x-consultation-lab': 'synthetic-v1' };
const fields = { description: 'Descripción para IA', techniques: 'Técnicas', duration: 'Duración confirmada', conditions: 'Condiciones', faq: 'Preguntas frecuentes', internalFee: 'Tarifa interna (nunca pública)' } as const;
const empty = (slug: string): ServiceKnowledge => ({ slug, version: 0, description: '', techniques: '', duration: '', conditions: '', faq: '', internalFee: '', approvedForAI: false, priceApproved: false, validUntil: null });
const discardWarning = 'Hay cambios privados sin guardar. ¿Querés descartarlos? No se publicará ni enviará ninguna respuesta.';

export function ConsultationLabPanel() {
  const [caseId, setCaseId] = useState<string>('general');
  const [busy, setBusy] = useState(false), lock = useRef(false);
  const [result, setResult] = useState<(Awaited<ReturnType<typeof runConsultationLab>> & { knowledgeUnavailable?: boolean }) | null>(null);
  const [status, setStatus] = useState('');
  const [services, setServices] = useState<{slug: string; name: string}[]>([]);
  const [entries, setEntries] = useState<ServiceKnowledge[]>([]);
  const [entry, setEntry] = useState<ServiceKnowledge | null>(null);
  const [knowledgeLoaded, setKnowledgeLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const progress = summarizeKnowledgeReview(services, entries);
  async function action(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setStatus('');
    try { await work(); }
    catch (error) {
      setStatus(error instanceof Error && error.message === 'KNOWLEDGE_CONFLICT'
        ? 'La ficha no se guardó: cambió de versión o se rechazaron los datos. Conservá tu texto antes de recargar y revisá las aprobaciones.'
        : 'No se confirmó la operación. Revisá la sesión y las migraciones de Supabase. No se envió ningún correo.');
    } finally { lock.current = false; setBusy(false); }
  }
  async function loadKnowledge(selectedSlug: string | null = null) {
    const r = await apiFetch(base + '/knowledge'); if (!r.ok) throw Error();
    const data = await r.json();
    if (!Array.isArray(data.services) || !Array.isArray(data.entries)) throw Error('KNOWLEDGE_UNAVAILABLE');
    setServices(data.services); setEntries(data.entries);
    setEntry(selectedSlug ? data.entries.find((record: ServiceKnowledge) => record.slug === selectedSlug) || empty(selectedSlug) : null);
    setKnowledgeLoaded(true); setDirty(false);
  }
  function chooseEntry(slug: string) {
    if (dirty && !window.confirm(discardWarning)) return;
    setEntry(entries.find(record => record.slug === slug) || empty(slug));
    setDirty(false); setStatus('');
  }
  function updateEntry(patch: Partial<ServiceKnowledge>, contentChanged = false) {
    setEntry(current => current ? { ...current, ...patch, ...(contentChanged ? { approvedForAI: false, priceApproved: false } : {}) } : null);
    setDirty(true);
  }
  return <section aria-labelledby="consultation-lab-title" className="my-5 rounded border border-amber-500 p-4">
    <h3 id="consultation-lab-title" className="text-xl">Fichas profesionales y laboratorio</h3>
    <p className="my-2">Revisá las fichas privadas de los 17 tratamientos. Nada se publica ni se aprueba automáticamente.</p>
    <details open className="my-4"><summary>Fichas privadas para Victoria</summary>
      <p>La aprobación para IA, la aprobación de tarifa interna y la publicación web son decisiones independientes. Este editor no publica en la web. Las técnicas, condiciones, duración y preguntas frecuentes se conservan como notas internas; esta primera versión solo aporta a la IA la descripción expresamente aprobada.</p>
      <button type="button" disabled={busy} className="my-3 min-h-11 rounded border px-3" onClick={() => {
        if (dirty && !window.confirm(discardWarning)) return;
        void action(() => loadKnowledge(entry?.slug || null));
      }}>{knowledgeLoaded ? 'Actualizar fichas privadas' : 'Cargar los 17 tratamientos'}</button>
      {knowledgeLoaded && <div className="my-3 rounded border border-neutral-600 p-3" aria-label="Avance de revisión profesional">
        <p role="status">F2 · {progress.total} tratamientos: {progress.missing} sin ficha · {progress.draft} borradores · {progress.approved} descripciones aprobadas para IA · {progress.expired} vencidas.</p>
        <p className="text-sm">Tarifas internas aprobadas por separado: {progress.priceApproved}. Nunca se muestran importes aquí ni en la web pública.</p>
        <p className="text-sm">Un borrador guardado no autoriza a la IA. Victoria debe revisar expresamente cada descripción antes de su aprobación.</p>
      </div>}
      <label className="block" htmlFor="consultation-knowledge-service">Tratamiento</label>
      <select id="consultation-knowledge-service" disabled={busy || !services.length} className="my-2 block max-w-full rounded bg-neutral-800 p-2" value={entry?.slug || ''} onChange={e => chooseEntry(e.target.value)}>
        <option value="" disabled>Elegir ficha</option>
        {progress.rows.map(row => <option key={row.slug} value={row.slug}>{row.name} · {knowledgeReviewLabel[row.state]}</option>)}
      </select>
      {dirty && <p role="status" className="my-2 text-amber-200">Hay cambios privados sin guardar. Cambiar de tratamiento o actualizar requiere confirmación.</p>}
      {entry && <form className="grid gap-3" onSubmit={e => { e.preventDefault(); void action(async () => {
        const savedSlug = entry.slug;
        const r = await apiFetch(base + '/knowledge', { method: 'POST', headers, body: JSON.stringify(entry) });
        if (r.status === 409 || r.status === 400) throw Error('KNOWLEDGE_CONFLICT');
        if (!r.ok || !(await r.json()).saved) throw Error();
        await loadKnowledge(savedSlug);
        setStatus('Nueva versión privada guardada. No se publicó ni envió ninguna respuesta.');
      }); }}>
        <p>Versión {entry.version}. Cada guardado crea una revisión; un conflicto requiere volver a cargar.</p>
        {Object.entries(fields).map(([key, label]) => <div key={key}><label htmlFor={'consultation-knowledge-'+key}>{label}</label>
          <textarea id={'consultation-knowledge-'+key} className="block min-h-20 w-full rounded bg-neutral-800 p-2" disabled={busy} maxLength={2000} value={entry[key as keyof typeof fields]} onChange={e => updateEntry({ [key]: e.target.value }, true)} /></div>)}
        <label>Vigente hasta (opcional, UTC)<input type="datetime-local" className="block rounded bg-neutral-800 p-2" disabled={busy} value={entry.validUntil?.slice(0,16) || ''} onChange={e => updateEntry({ validUntil: e.target.value ? e.target.value + ':00Z' : null }, true)} /></label>
        <label><input type="checkbox" disabled={busy || !entry.description.trim()} checked={entry.approvedForAI} onChange={e => updateEntry({ approvedForAI: e.target.checked })} /> Victoria aprobó expresamente la descripción para IA</label>
        <label><input type="checkbox" disabled={busy || !entry.internalFee.trim()} checked={entry.priceApproved} onChange={e => updateEntry({ priceApproved: e.target.checked })} /> Victoria aprobó expresamente la tarifa interna (no se entrega a IA ni web)</label>
        <button disabled={busy || !dirty} className="min-h-11 rounded border px-3">{busy ? 'Guardando…' : 'Guardar versión privada'}</button>
      </form>}
    </details>
    {status && <p role="status">{status}</p>}
    <details className="my-4"><summary>Laboratorio de IA (solo simulación)</summary>
    <p className="my-2">Simulación local con casos sintéticos. No ejecuta camelRun ni utiliza consultas de clientes. Todos los resultados requieren revisión de Victoria.</p>
    <p>Los agentes de laboratorio están identificados, pero su ejecución remota permanece bloqueada hasta verificar conexión, esquemas y coste total cero.</p>
    <label className="my-3 block">Caso de prueba<select className="mx-2 rounded bg-neutral-800 p-2" disabled={busy} value={caseId} onChange={e => { setCaseId(e.target.value); setResult(null); }}>
      {consultationLabCases.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
    </select></label>
    <p className="my-2 whitespace-pre-wrap">Entrada sintética: {consultationLabCases.find(c => c.id === caseId)?.message}</p>
    <button type="button" disabled={busy} className="min-h-11 rounded border px-4 py-2" onClick={() => void action(async () => {
      setResult(null); const r = await apiFetch(base, { method: 'POST', headers, body: JSON.stringify({ caseId }) });
      if (!r.ok) throw Error(); setResult(await r.json());
    })}>{busy ? 'Procesando…' : 'Probar IA (simulación)'}</button>
    {result && <div className="my-4 grid gap-3">
      {result.knowledgeUnavailable && <p role="status" className="rounded border border-amber-400 p-3">La base privada de tratamientos no está disponible. Esta prueba usa cero fichas y cero datos de clientes; no valida la conexión con Supabase, camelRun ni Resend. Para editar las fichas hay que verificar primero la migración y sus permisos.</p>}
      <p role="status">Borrador no enviado · Revisión humana obligatoria · Guardián: {result.analysis.guardian.status}</p>
      <p>Controles: {result.analysis.guardian.codes.join(', ') || 'Sin bloqueos adicionales; requiere revisión humana.'}</p>
      <p>Coste: US$0 por simulación local. Tokens: desconocidos/no aplican. Llamadas a proveedores: 0.</p>
      <details><summary>Análisis y etapas simuladas</summary><pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify({ understanding: result.analysis.understanding, stages: result.stages, remote: result.remote }, null, 2)}</pre></details>
      <details><summary>Fuentes vigentes y aprobadas</summary>{result.analysis.evidence.length ? result.analysis.evidence.map(f => <p key={f.id}>{f.source} · Versión {f.version}: {f.fragment}</p>) : <p>No hay información aprobada suficiente. Victoria debe completar y revisar las fichas.</p>}</details>
      {result.analysis.drafts.map(d => <article key={d.id}><h4>{d.title}</h4><p className="whitespace-pre-wrap">{d.text}</p></article>)}
    </div>}
    </details>

  </section>;
}
