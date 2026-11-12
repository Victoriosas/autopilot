import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../lib/api';
import supabase from '../../lib/supabase';
import type { MaterialAdminRow } from '../../storefront/consultationMaterialAdmin';

const states = { pending: 'Pendiente', reviewed: 'Revisada', rejected: 'Rechazada', revoked: 'Revocada' };
const events: Record<string, string> = { created: 'Creada', reviewed: 'Revisada', rejected: 'Rechazada', revoked: 'Revocada' };
export function ConsultationMaterialPanel({ requestId }: { requestId: string }) {
  const [rows, setRows] = useState<MaterialAdminRow[] | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [clock, setClock] = useState(Date.now());
  const version = useRef(0), mounted = useRef(false), locked = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const path = '/api/beauty/inquiries/admin/' + encodeURIComponent(requestId) + '/material';
  useEffect(() => {
    mounted.current = true;
    setRows(null); setMessage('');
    const subscription = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        version.current++; pending.current?.abort(); setRows(null); setMessage('Sesión cambiada. Volvé a verificar el acceso.');
      }
    }).data.subscription;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => { mounted.current = false; version.current++; pending.current?.abort(); subscription.unsubscribe(); window.clearInterval(timer); };
  }, [requestId]);
  async function run(action?: { id: string; updated_at: string; state: string } | 'purge') {
    if (locked.current) return;
    if (action && !window.confirm(action === 'purge'
      ? '¿Eliminar material vencido, revocado o invalidado de esta consulta y su auditoría? Las claves mínimas de operación se conservan hasta borrar el expediente.'
      : action.state === 'revoked' ? '¿Revocar esta solicitud y borrar su contenido? Esta acción es terminal.' : '¿Registrar esta revisión administrativa? No autoriza envíos.')) return;
    locked.current = true; setBusy(true); setRows(null); setMessage('');
    const current = ++version.current;
    const controller = new AbortController(); pending.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await apiFetch(path + (action ? action === 'purge' ? '/purge' : '/review' : ''), action ? {
        signal: controller.signal, method: 'POST', headers: { 'Content-Type': 'application/json', 'x-consultation-approval': requestId },
        body: JSON.stringify(action === 'purge' ? {} : action),
      } : { signal: controller.signal });
      if (!response.ok) throw Error();
      const data = await response.json();
      if (data.delivery_decision !== 'no_send') throw Error();
      if (action) {
        if (action !== 'purge' && data.saved !== true) throw Error();
        // Reconcile once by reading; never retry mutations after an uncertain response.
        const refresh = await apiFetch(path, { signal: controller.signal });
        if (!refresh.ok) throw Error();
        const snapshot = await refresh.json();
        if (snapshot.delivery_decision !== 'no_send' || !Array.isArray(snapshot.rows)) throw Error();
        if (mounted.current && current === version.current) { setRows(snapshot.rows); setMessage(action === 'purge' ? `Eliminadas: ${data.erased}.` : 'Cambio confirmado. Sin envío.'); }
      } else {
        if (!Array.isArray(data.rows)) throw Error();
        if (mounted.current && current === version.current) setRows(data.rows);
      }
    } catch {
      if (mounted.current && current === version.current) { setRows(null); setMessage('Estado no confirmado. Verificá la sesión y actualizá antes de volver a actuar.'); }
    } finally { window.clearTimeout(timeout); pending.current = null; locked.current = false; if (mounted.current) setBusy(false); }
  }
  return <section className="mt-4 rounded border border-neutral-600 bg-neutral-950 p-3 text-white" aria-label="Solicitudes de material">
    <h4 className="font-semibold">Solicitudes de material · Revisión administrativa</h4>
    <p>Sin envío. La revisión no aprueba contenido ni habilita canales. Se muestran hasta 100 solicitudes y los últimos 50 eventos por solicitud.</p>
    <div className="my-3 flex flex-wrap gap-3">
      <button type="button" className="rounded border px-3 py-2" disabled={busy} onClick={() => void run()}>Actualizar material</button>
      <button type="button" className="rounded border px-3 py-2" disabled={busy || rows === null} onClick={() => void run('purge')}>Purgar material no vigente de esta consulta</button>
    </div>
    {busy && <p role="status">Verificando material…</p>}
    {message && <p role="status">{message}</p>}
    {rows?.length === 0 && <p>No hay solicitudes de material conservadas para esta consulta.</p>}
    <ul className="space-y-3">{rows?.map(row => {
      const expired = !Number.isFinite(Date.parse(row.expires_at)) || Date.parse(row.expires_at) <= clock;
      const available = row.available && !expired && row.consent_state === 'granted' && row.review_state !== 'revoked';
      return <li key={row.id} className="rounded border border-neutral-700 p-3 break-words">
        <p>Referencia: {row.id}</p><p>Estado: {states[row.review_state]} · {expired ? 'Vencida' : available ? 'Vigente al verificar' : 'No vigente o revocada'}</p>
        <p>Consentimiento: {row.consent_state === 'granted' ? 'Registrado; sujeto a vigencia del expediente' : 'Revocado'}{available && row.metadata ? ` · Versión: ${row.metadata.consent_version}` : ''}</p>
        <p>Creada: {row.created_at} · Actualizada: {row.updated_at} · Expira: {row.expires_at}</p>
        {available && row.metadata && <><p>Intención: {row.metadata.intent} · Canal solicitado: {row.metadata.channel}</p>
          <ul aria-label="Fuentes y versiones">{row.metadata.sources.map(source => <li key={source.id}>{source.id} · Versión {source.version} · Fuente: {source.source}</li>)}</ul></>}
        <details><summary>Auditoría mínima</summary><ol>{row.events.map(event => <li key={event.id}>#{event.id} · {events[event.event] || 'Evento'} · {event.occurred_at}</li>)}</ol><p>La purga elimina estos eventos. La atribución de actor queda en el registro privado.</p></details>
        <div className="mt-2 flex flex-wrap gap-3">{(['reviewed', 'rejected', 'revoked'] as const).map(state => <button type="button" key={state} className="rounded border px-3 py-2"
          disabled={busy || row.review_state === 'revoked' || row.review_state === state || state !== 'revoked' && !available}
          onClick={() => void run({ id: row.id, updated_at: row.updated_at, state })}>{({ reviewed: 'Marcar revisada', rejected: 'Rechazar', revoked: 'Revocar y borrar contenido' })[state]}</button>)}</div>
      </li>;
    })}</ul>
  </section>;
}
