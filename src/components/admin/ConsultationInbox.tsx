import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../lib/api';
import type { ConsultationRecord } from '../../storefront/consultationSupabase';
import { serviceGroups, serviceSlug } from '../public/serviceDirectory';
import { ConsultationReadControl } from './ConsultationReadControl';
import { ConsultationIntelligencePanel } from './ConsultationIntelligencePanel';
import { ConsultationIntelligenceReport } from './ConsultationIntelligenceReport';

const labels = Object.fromEntries(serviceGroups.flatMap(group => group.services.map(name => [serviceSlug(name), name])));
export function ConsultationInbox() {
  const [rows, setRows] = useState<ConsultationRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, { text: string; priority: string; subject: string; channel: string }>>({});
  const [replyState, setReplyState] = useState<Record<string, string>>({});
  const [channelFilter, setChannelFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [caseStatuses, setCaseStatuses] = useState<Record<string, string>>({});
  const [sentIds, setSentIds] = useState<string[]>([]);
  const [readStates, setReadStates] = useState<Record<string, string> | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [intelligenceEnabled,setIntelligenceEnabled]=useState(false);
  const [source, setSource] = useState<'web' | 'whatsapp'>('web');
  const [folder, setFolder] = useState<'pending' | 'sent'>('pending');
  const alive = useRef(true);
  const loadVersion = useRef(0);
  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; loadVersion.current++; }; }, []);
  async function load(page = 0) {
    const version = ++loadVersion.current;
    setRows([]); setReadStates(null); setSentIds([]); setCaseStatuses({}); setError(''); setBusy(true);
    try {
      const response = await apiFetch('/api/beauty/inquiries/admin?offset=' + page);
      if (!response.ok) throw Error();
      const payload = await response.json();
      if (!alive.current || version !== loadVersion.current) return;
      if (alive.current) { setRows(payload.requests); setReadStates(payload.readStates ?? null); setOffset(page); }
      try {
        const config=await apiFetch('/api/beauty/inquiries/admin/intelligence-config');
        const state=config.ok?await config.json():{};
        if(alive.current&&version===loadVersion.current)setIntelligenceEnabled(state.enabled===true);
      }catch{if(alive.current&&version===loadVersion.current)setIntelligenceEnabled(false);}
      setStatusLoading(true);
      const statuses = await Promise.all((payload.requests as ConsultationRecord[]).map(async row => {
        try {
          const res = await apiFetch('/api/beauty/inquiries/admin/' + encodeURIComponent(row.id) + '/reply-status');
          if (!res.ok) return { id: row.id, sent: false, status: 'new' };
          const data = await res.json();
          return { id: row.id, sent: data.reply?.state === 'sent', status: data.case?.status || 'new' };
        } catch { return { id: row.id, sent: false }; }
      }));
      if (alive.current && version === loadVersion.current) { setSentIds(statuses.filter(value => value.sent).map(value => value.id)); setCaseStatuses(previous => ({ ...previous, ...Object.fromEntries(statuses.filter(value => value.status).map(value => [value.id, value.status!])) })); setStatusLoading(false); }
    } catch { if (alive.current && version === loadVersion.current) setError('No se pudieron cargar las consultas. Revisá tu sesión y la configuración.'); }
    finally { if (alive.current && version === loadVersion.current) { setBusy(false); setStatusLoading(false); } }
  }
  async function saveReading(id: string, read: boolean) {
    setBusy(true); setError('');
    try {
      const response = await apiFetch('/api/beauty/inquiries/admin/' + encodeURIComponent(id) + '/read-state', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-consultation-approval': id }, body: JSON.stringify({ read }),
      });
      if (!response.ok) throw Error();
      const payload = await response.json();
      if (read ? typeof payload.readAt !== 'string' : payload.readAt !== null) throw Error();
      if (alive.current) {
        setReadStates(previous => {
          if (previous === null) return null;
          const next = { ...previous }; if (payload.readAt) next[id] = payload.readAt; else delete next[id]; return next;
        });
        window.dispatchEvent(new Event('consultation-reading-changed'));
      }
    } catch { if (alive.current) { setReadStates(null); setError('No se pudo confirmar el cambio de lectura. Actualizá para comprobar el estado.'); window.dispatchEvent(new Event('consultation-reading-changed')); } }
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
  async function checkReply(id: string) {
    setBusy(true); setError('');
    try {
      const response = await apiFetch('/api/beauty/inquiries/admin/' + encodeURIComponent(id) + '/reply-status');
      if (!response.ok) throw Error();
      const payload = await response.json();
      const reply = payload.reply as { state: string; sent_at: string | null } | null;
      if (alive.current) setCaseStatuses(previous => ({ ...previous, [id]: payload.case?.status || 'new' }));
      const label = !reply ? 'Sin respuesta por correo registrada' :
        reply.state === 'sent' ? 'Correo enviado' :
        reply.state === 'sending' ? 'Envío en proceso: verificá antes de actuar' :
        'Entrega incierta: revisar Resend, no reenviar automáticamente';
      if (alive.current) setReplyState(previous => ({ ...previous, [id]: label }));
    } catch { if (alive.current) setError('No fue posible verificar el historial de envío.'); }
    finally { if (alive.current) setBusy(false); }
  }
  async function saveStatus(id: string, status: string) {
    setBusy(true); setError('');
    try {
      const response = await apiFetch('/api/beauty/inquiries/admin/' + encodeURIComponent(id) + '/case-status', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-consultation-approval': id },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw Error();
      if (alive.current) {
        setCaseStatuses(previous => ({ ...previous, [id]: status }));
        setReplyState(previous => ({ ...previous, [id]: 'Estado administrativo guardado' }));
      }
    } catch { if (alive.current) setError('No se pudo guardar el estado administrativo.'); }
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
      if (alive.current) { setReplyState(previous => ({ ...previous, [id]: 'Respuesta enviada por Resend.' })); setSentIds(previous => [...new Set([...previous, id])]); }
    } catch { if (alive.current) setReplyState(previous => ({ ...previous, [id]: 'No se confirmó el envío. Revisá el historial antes de reintentar.' })); }
    finally { if (alive.current) setBusy(false); }
  }
  return <section className="my-6 rounded-xl border border-neutral-700 bg-neutral-900 p-5 text-white" aria-labelledby="consultation-inbox-title">
    <h2 id="consultation-inbox-title" className="text-xl font-semibold">Consultas · Atención de Victoria</h2>
    <p>Acceso exclusivo de administración. El aviso por correo contiene solo una referencia. Esta bandeja permite revisar también consultas cuya notificación quedó pendiente.</p>
    <div className="my-4 flex flex-wrap gap-3" role="group" aria-label="Origen de consultas">
      <button type="button" aria-pressed={source === 'web'} className={`rounded border px-4 py-2 ${source === 'web' ? 'border-amber-500 bg-amber-900/30' : 'border-neutral-600'}`} onClick={() => setSource('web')}>Web</button>
      <button type="button" aria-pressed={source === 'whatsapp'} className={`rounded border px-4 py-2 ${source === 'whatsapp' ? 'border-amber-500 bg-amber-900/30' : 'border-neutral-600'}`} onClick={() => setSource('whatsapp')}>WhatsApp</button>
      <button type="button" className="rounded border border-neutral-600 px-4 py-2" disabled={busy} onClick={() => void load()}>Actualizar</button>
    </div>
    {source === 'whatsapp' && <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-5" role="status"><h3 className="font-semibold">WhatsApp · Integración pendiente</h3><p>Las consultas recibidas directamente en WhatsApp todavía no se sincronizan aquí. No se muestran mensajes simulados. Las consultas web que eligen WhatsApp como canal permanecen en Web hasta contar con una conexión autorizada.</p></div>}
    {source === 'web' && <>
      <ConsultationIntelligenceReport enabled={intelligenceEnabled}/>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Estado de respuesta">
        <button type="button" aria-pressed={folder === 'pending'} onClick={() => setFolder('pending')} className={`rounded border px-3 py-2 ${folder === 'pending' ? 'border-amber-500 bg-amber-900/30' : 'border-neutral-600'}`}>En espera de respuesta ({rows.length - sentIds.length})</button>
        <button type="button" aria-pressed={folder === 'sent'} onClick={() => setFolder('sent')} className={`rounded border px-3 py-2 ${folder === 'sent' ? 'border-amber-500 bg-amber-900/30' : 'border-neutral-600'}`}>Respondidas con asistencia de IA ({sentIds.length})</button>
      </div>
      <p className="text-xs text-neutral-400">Los totales de estas carpetas corresponden a esta página. La campana cuenta consultas sin leer de toda la bandeja. La lectura es compartida por administración y se marca expresamente; no equivale a responder. Los borradores no cuentan como enviados.</p>
      {statusLoading && <p role="status">Verificando respuestas registradas…</p>}
    {error && <p role="alert">{error}</p>}
    <div className="my-3 flex flex-wrap gap-3">
      <label className="text-sm">Canal <select className="ml-2 rounded bg-neutral-800 p-2" value={channelFilter} onChange={event => setChannelFilter(event.target.value)}>
        <option value="all">Todos</option><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="phone">Llamada</option>
      </select></label>
      <label className="text-sm">Buscar servicio o mensaje <input className="ml-2 rounded bg-neutral-800 p-2" value={search} onChange={event => setSearch(event.target.value)} placeholder="Servicio o texto de la consulta" /></label>
    </div>
    <ul className="space-y-4">{rows.filter(row => (folder === 'sent' ? sentIds.includes(row.id) : !sentIds.includes(row.id)) && (channelFilter === 'all' || row.input.responseChannel === channelFilter) && ((labels[row.input.service] || 'Orientación') + ' ' + row.input.message).toLowerCase().includes(search.trim().toLowerCase())).map(row => <li key={row.id} className="rounded border border-neutral-600 p-4 break-words">
      <h3 className="text-lg font-semibold">{row.input.fullName} · {labels[row.input.service] || 'Orientación'}</h3>
      <ConsultationReadControl readAt={readStates === null ? undefined : readStates[row.id] ?? null} busy={busy} onChange={read => void saveReading(row.id, read)} />
      <p>Referencia: {row.id}</p><p>Celular: {row.input.phone}</p>
      {row.input.email && <p>Email: {row.input.email}</p>}
      {row.input.age !== null && <p>Edad informada: {row.input.age}</p>}
      <p>Preferencia: {({ whatsapp: 'WhatsApp', email: 'Correo electrónico', phone: 'Llamada' })[row.input.responseChannel]}</p>
      <p className="mt-2 whitespace-pre-wrap rounded bg-neutral-800 p-3"><strong>Mensaje recibido:</strong> {row.input.message}</p>
      <p>Consentimiento: {row.input.consentVersion} · Recibida: {row.created_at} · Caduca: {row.expires_at}</p>
      <label className="mt-2 block text-sm">Estado administrativo
        <select className="ml-2 rounded border border-neutral-600 bg-neutral-800 p-2" disabled={busy || !caseStatuses[row.id]}
          value={caseStatuses[row.id] || ''} onChange={event => void saveStatus(row.id, event.target.value)}>
          <option value="" disabled>Ver estado primero</option><option value="new">Nueva</option><option value="in_review">En revisión</option>
          <option value="awaiting_contact">Pendiente de contacto</option>
          <option value="answered">Respondida</option><option value="closed">Cerrada</option>
        </select>
      </label>
      <div className="mt-3 flex flex-wrap gap-2"><button className="rounded border border-amber-600 px-3 py-2" disabled={busy} onClick={() => void prepare(row.id)}>Preparar respuesta</button><button className="rounded border px-3 py-2" disabled={busy} onClick={() => void checkReply(row.id)}>Ver estado de respuesta</button></div>
      {drafts[row.id] && <div className="mt-3 rounded border border-neutral-600 bg-neutral-950 p-3">
        <p>Prioridad: {drafts[row.id].priority} · Canal: {drafts[row.id].channel}</p>
        <p className="font-semibold">{drafts[row.id].subject}</p>
        <p className="whitespace-pre-wrap">{drafts[row.id].text}</p>
        {drafts[row.id].channel === 'email' ? <button className="mt-3 rounded border border-emerald-600 px-3 py-2" disabled={busy || Boolean(replyState[row.id])} onClick={() => void approve(row.id)}>Aprobar y enviar por Resend</button> : drafts[row.id].channel === 'whatsapp' ? <div className="mt-3 space-y-2">
          <p>WhatsApp: respuesta preparada para revisión manual. El envío es manual y no necesita integraciones externas.</p>
          <button className="rounded border border-sky-500 px-3 py-2" disabled={busy} onClick={() => { void navigator.clipboard.writeText(drafts[row.id].text).then(() => setReplyState(previous => ({ ...previous, [row.id]: 'Borrador copiado. Abrí el chat correcto en WhatsApp y revisá el destinatario antes de enviarlo.' }))).catch(() => setReplyState(previous => ({ ...previous, [row.id]: 'No se pudo copiar la respuesta.' }))); }}>Copiar borrador de WhatsApp</button>
        </div> : <p>La clienta prefiere una llamada. Coordiná el contacto personalmente.</p>}
      </div>}
      {replyState[row.id] && <p role="status">{replyState[row.id]}</p>}
      <ConsultationIntelligencePanel requestId={row.id} enabled={intelligenceEnabled}/>
    </li>)}</ul>
    {rows.length > 0 && <div className="flex gap-4"><button disabled={busy || offset === 0} onClick={() => void load(Math.max(0, offset - 50))}>Anterior</button><button disabled={busy || rows.length < 50} onClick={() => void load(offset + 50)}>Siguiente</button></div>}
    </>}
  </section>;
}
