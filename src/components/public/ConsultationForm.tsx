import React, { useEffect, useRef, useState } from 'react';
import { serviceGroups, serviceSlug } from './serviceDirectory';
import { ContactLink, contactEmail } from './ContactLink';
import { normalizeConsultationRequest } from '../../storefront/consultationRequest';

const endpoint = '/api/beauty/inquiries';
const choices = [{ id: 'orientacion', name: 'Quiero orientación' }, ...serviceGroups.flatMap(group => group.services.map(name => ({ id: serviceSlug(name), name })))];
const emailInterestPrompts: Record<string, string> = {
  facial: 'Hola, quisiera recibir orientación sobre cuidado facial y una evaluación inicial remota.',
  corporal: 'Hola, quisiera recibir orientación sobre cuidado corporal y una evaluación inicial remota.',
  relajacion: 'Hola, quisiera consultar sobre masajes de relajación y una evaluación inicial remota.',
  orientacion: 'Hola, todavía no sé qué cuidado elegir y quisiera orientación inicial remota.',
  online: 'Hola, quisiera información sobre la asesoría de cuidado facial online y una evaluación inicial remota.',
};
function consultationContext() {
  const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  const service = choices.find(choice => choice.id === params.get('servicio'));
  return {
    channel: params.get('canal') === 'email' ? 'email' : 'whatsapp',
    service: service?.id || 'orientacion',
    message: service ? `Hola, quisiera consultar sobre ${service.name.toLowerCase()} y una evaluación inicial remota.` : emailInterestPrompts[params.get('interes') || ''] || '',
  };
}

export function ConsultationForm() {
  const [ready, setReady] = useState(false);
  const [channel, setChannel] = useState(() => consultationContext().channel);
  const [service, setService] = useState(() => consultationContext().service);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [result, setResult] = useState('');
  // Uncertain retries keep identical data in memory; never browser storage.
  const attempt = useRef<ReturnType<typeof normalizeConsultationRequest> | null>(null);
  const busy = useRef(false);
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 8000);
    fetch(endpoint + '/config', { credentials: 'omit', cache: 'no-store', signal: abort.signal })
      .then(async response => { if (response.ok) { const config = await response.json(); if (!abort.signal.aborted) setReady(config.enabled === true && config.privacyVersion === 'consultation-v1' && config.retentionDays === 30); } })
      .catch(() => {}).finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); abort.abort(); };
  }, []);
  useEffect(() => {
    const sync = () => { const slug = window.location.hash.slice(1); if (choices.some(choice => choice.id === slug) && !attempt.current) setService(slug); };
    sync(); window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy.current || sent) return;
    const data = new FormData(event.currentTarget);
    try {
      if (!attempt.current) attempt.current = normalizeConsultationRequest({
        id: crypto.randomUUID(), fullName: data.get('fullName'), phone: data.get('phone'), email: data.get('email'),
        age: data.get('age') === '' ? null : Number(data.get('age')), service, message: data.get('message'),
        responseChannel: channel, consent: data.get('consent') === 'yes', consentVersion: 'consultation-v1', aiConsent: data.get('aiConsent') === 'yes', website: data.get('website'),
      });
    } catch { setResult('Revisá los campos y el consentimiento. Usá solo texto y un celular de 8 a 15 dígitos.'); return; }
    busy.current = true; setPending(true); setLocked(true); setResult('');
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', signal: AbortSignal.timeout(20000), body: JSON.stringify(attempt.current) });
      const receipt = await response.json().catch(() => null);
      if (response.status === 202 && receipt?.id === attempt.current.id && receipt.status === 'accepted') {
        attempt.current = null; setSent(true); setResult('Tu consulta quedó registrada. La atención se coordina personalmente; esto no confirma una reserva.');
      } else if (response.status === 400 || response.status === 413 || response.status === 415) {
        attempt.current = null; setLocked(false); setResult('Revisá los datos y el consentimiento antes de volver a intentar.');
      } else if (response.status === 429) {
        setResult('Se alcanzó el límite de intentos. Esperá antes de reintentar o escribinos por WhatsApp.');
      } else {
        setResult('No pudimos confirmar el envío. Podés reintentar con los mismos datos o consultar por WhatsApp.');
      }
    } catch { setResult('No pudimos confirmar el envío. Podés reintentar con los mismos datos o consultar por WhatsApp.'); }
    finally { busy.current = false; setPending(false); }
  }

  return <section className="beauty-consultation" aria-labelledby="consultation-title">
    <p className="beauty-eyebrow">Un primer paso, a tu ritmo</p>
    <h2 id="consultation-title">Hablemos de tu cuidado</h2>
    {!ready ? <p role="status">Por ahora, consultanos directamente por WhatsApp o email.</p> : sent ? <p role="status">{result}</p> : <>
      <p>Contanos qué te interesa y cómo preferís una respuesta. No incluyas datos de salud, historia clínica ni fotografías.</p>
      <form onSubmit={submit} aria-busy={pending}>
        <fieldset disabled={pending || locked} className="beauty-consultation-fields"><legend>Tu consulta</legend>
          <div className="beauty-consultation-grid">
            <label>Nombre y apellido *<input name="fullName" required maxLength={120} autoComplete="name" /></label>
            <label>Celular *<input name="phone" type="tel" required minLength={8} maxLength={25} autoComplete="tel" aria-describedby="consultation-phone-help" /></label>
            <label>Correo electrónico {channel === 'email' ? '*' : '(opcional)'}<input name="email" type="email" required={channel === 'email'} maxLength={254} autoComplete="email" /></label>
            <label>Edad (opcional)<input name="age" type="number" min="0" max="120" step="1" /></label>
          </div>
          <p id="consultation-phone-help" className="beauty-small">Celular de 8 a 15 dígitos. Podés incluir el código de país.</p>
          <label>Servicio que te interesa<select value={service} onChange={event => setService(event.target.value)}>{choices.map(choice => <option key={choice.id} value={choice.id}>{choice.name}</option>)}</select></label>
          <label>¿Qué te gustaría consultar? *<textarea name="message" required rows={4} maxLength={600} defaultValue={consultationContext().message} /></label>
          <fieldset><legend>¿Cómo preferís que te contactemos?</legend>{([['whatsapp', 'WhatsApp'], ['email', 'Correo electrónico'], ['phone', 'Llamada']] as const).map(([value, label]) => <label className="beauty-consultation-radio" key={value}><input type="radio" name="channel" value={value} checked={channel === value} onChange={() => setChannel(value)} />{label}</label>)}</fieldset>
          <label className="beauty-consultation-consent"><input name="consent" type="checkbox" value="yes" required /><span>Acepto que Victoriosas use estos datos para responder esta consulta, según la <a href="/privacidad">política de privacidad</a>. No me suscribe a campañas. La atención humana está disponible aunque no autorices IA.</span></label>
          <label className="beauty-consultation-consent"><input name="aiConsent" type="checkbox" value="yes" /><span>Opcional: autorizo que el motivo de consulta y servicio seleccionado se procesen mediante camelRun para preparar borradores de IA que Victoria revisará. No se envían nombre ni datos de contacto al proveedor. Puedo consultar o revocar este permiso escribiendo al correo de contacto. <a href="/privacidad">Más información</a>.</span></label>
          <div className="beauty-consultation-trap" aria-hidden="true"><label>Sitio web<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        </fieldset>
        <button className="beauty-button" type="submit" disabled={pending}>{pending ? 'Enviando…' : locked ? 'Reintentar consulta' : 'Enviar consulta'}</button>
        {result && <p role="status">{result}</p>}
      </form>
    </>}
    <div className="beauty-contact-options"><ContactLink />{!ready ? <a className="beauty-button" href={'mailto:' + contactEmail}>Escribir por correo externo</a> : !sent ? <a className="beauty-button" href="/consultanos?canal=email">Usar el formulario con respuesta por correo ↗</a> : null}</div>
    <p className="beauty-small">victoriosas.online@gmail.com</p>
  </section>;
}
