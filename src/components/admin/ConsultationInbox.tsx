import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../lib/api';
import type { ConsultationRecord } from '../../storefront/consultationSupabase';
import { serviceGroups, serviceSlug } from '../public/serviceDirectory';

const labels = Object.fromEntries(serviceGroups.flatMap(group => group.services.map(name => [serviceSlug(name), name])));
export function ConsultationInbox() {
  const [rows, setRows] = useState<ConsultationRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, { text: string; priority: string; subject: string; channel: string }>>({});
  const [replyState, setReplyState] = useState<Record<string, string>>({});
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function load(page = 0) {
    setRows([]); setError(''); setBusy(true);
    try {
      const response = await apiFetch('/api/beauty/inquiries/admin?offset=' + page);
      if (!response.ok) throw Error();
      const payload = await response.json();
      if (alive.current) { setRows(payload.requests); setOffset(page); }
    } catch { if (alive.current) setError('No se pudieron cargar las consultas. Revisá tu sesión y la configuración.'); }
    finally { if (alive.current) setBusy(false); }
  }
  async function prepare(id: string) {
    setError(''); setBusy(true);
    try {
      const response = await apiFetch('/api/beauty/inquiries/admin/' + encodeURIComponent(id) + '/draft');
      if (!response.ok) throw Error();
      const payload = await response.json();
      if (alive.current) setDrafts(previous => ({ ...previous, [id]: payload.draft }));
    } catch { if (alive.current) setError('No fue posible preparar el borrador.'); }
    finally { if (alive.current) setBusy(false); }
  }
  async function approve(id: string) {
    const draft = drafts[id];
    if (!draft || draft.channel !== 'email') return;
    if (!window.confirm('¿Aprobás enviar esta respuesta por correo? El envío no se puede deshacer.')) return;
    setError(''); setBusy(true);
    try {
      const response = await apiFetch('/api/beauty/inquiries/admin/' + encodeURIComponent(id) + '/approve-send', {
        method: 'POST', headers: { 'x-consultation-approval': id },
      });
      if (!response.ok) throw Error();
      if (alive.current) setReplyState(previous => ({ ...previous, [id]: 'Respuesta enviada por Resend.' }));
    } catch { if (alive.current) setReplyState(previous => ({ ...previous, [id]: 'No se confirmó el envío. Revisá el historial antes de reintentar.' })); }
    finally { if (alive.current) setBusy(false); }
  }
  return <section className="my-6 rounded-xl border border-neutral-700 bg-neutral-900 p-5 text-white" aria-labelledby="consultation-inbox-title">
    <h2 id="consultation-inbox-title" className="text-xl font-semibold">Consultas web · Bandeja privada</h2>
    <p>Acceso exclusivo de administración. El aviso por correo contiene solo una referencia. Esta bandeja permite revisar también consultas cuya notificación quedó pendiente.</p>
    <button className="my-3 rounded border px-3 py-2" disabled={busy} onClick={() => void load()}>Cargar consultas</button>
    {error && <p role="alert">{error}</p>}
    <ul className="space-y-4">{rows.map(row => <li key={row.id} className="rounded border border-neutral-600 p-4 break-words">
      <h3>{row.input.fullName} · {labels[row.input.service] || 'Orientación'}</h3>
      <p>Referencia: {row.id}</p><p>Celular: {row.input.phone}</p>
      {row.input.email && <p>Email: {row.input.email}</p>}
      {row.input.age !== null && <p>Edad informada: {row.input.age}</p>}
      <p>Preferencia: {({ whatsapp: 'WhatsApp', email: 'Correo electrónico', phone: 'Llamada' })[row.input.responseChannel]}</p>
      <p className="whitespace-pre-wrap">{row.input.message}</p>
      <p>Consentimiento: {row.input.consentVersion} · Recibida: {row.created_at} · Caduca: {row.expires_at}</p>
      <button className="mt-3 rounded border border-amber-600 px-3 py-2" disabled={busy} onClick={() => void prepare(row.id)}>Preparar respuesta</button>
      {drafts[row.id] && <div className="mt-3 rounded border border-neutral-600 bg-neutral-950 p-3">
        <p>Prioridad: {drafts[row.id].priority} · Canal: {drafts[row.id].channel}</p>
        <p className="font-semibold">{drafts[row.id].subject}</p>
        <p className="whitespace-pre-wrap">{drafts[row.id].text}</p>
        {drafts[row.id].channel === 'email' ? <button className="mt-3 rounded border border-emerald-600 px-3 py-2" disabled={busy || Boolean(replyState[row.id])} onClick={() => void approve(row.id)}>Aprobar y enviar por Resend</button> : drafts[row.id].channel === 'whatsapp' ? <div className="mt-3 space-y-2">
          <p>WhatsApp: respuesta preparada para revisión manual. Peach no está conectado todavía al backend.</p>
          <button className="rounded border border-sky-500 px-3 py-2" disabled={busy} onClick={() => { void navigator.clipboard.writeText(drafts[row.id].text).then(() => setReplyState(previous => ({ ...previous, [row.id]: 'Borrador copiado. Abrí el chat correcto en WhatsApp y revisá el destinatario antes de enviarlo.' }))).catch(() => setReplyState(previous => ({ ...previous, [row.id]: 'No se pudo copiar la respuesta.' }))); }}>Copiar borrador de WhatsApp</button>
        </div> : <p>La clienta prefiere una llamada. Coordiná el contacto personalmente.</p>}
      </div>}
      {replyState[row.id] && <p role="status">{replyState[row.id]}</p>}
    </li>)}</ul>
    {rows.length > 0 && <div className="flex gap-4"><button disabled={busy || offset === 0} onClick={() => void load(Math.max(0, offset - 50))}>Anterior</button><button disabled={busy || rows.length < 50} onClick={() => void load(offset + 50)}>Siguiente</button></div>}
  </section>;
}
