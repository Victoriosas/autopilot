import React, { useState } from 'react';
import { serviceGroups } from './serviceDirectory';
import { contactEmail } from './ContactLink';

const serviceNames = serviceGroups.flatMap(group => group.services);
const categories = ['Orientación general', 'Asesoría cosmetológica online', ...serviceNames, 'Otra consulta'];
type Channel = 'whatsapp' | 'email' | 'llamada';
declare global { interface Window { turnstile?: { render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void }) => unknown } } }
const siteKey = import.meta.env.VITE_BEAUTY_TURNSTILE_SITE_KEY as string | undefined;

export function ConsultationForm({ initialService = '' }: { initialService?: string }) {
  const [service, setService] = useState(initialService && categories.includes(initialService) ? initialService : 'Orientación general');
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState('');
  const [sent, setSent] = useState(false);
  const [captcha, setCaptcha] = useState('');
  const captchaRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!siteKey || !captchaRef.current) return;
    let alive = true;
    const render = () => {
      if (alive && captchaRef.current && window.turnstile) window.turnstile.render(captchaRef.current, { sitekey: siteKey, callback: setCaptcha, 'expired-callback': () => setCaptcha('') });
    };
    if (window.turnstile) { render(); return () => { alive = false; }; }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
    return () => { alive = false; script.onload = null; };
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true); setResult('');
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: String(data.get('name') || '').trim(),
      phone: String(data.get('phone') || '').trim(),
      email: String(data.get('email') || '').trim(),
      age: String(data.get('age') || '').trim(),
      service, channel,
      message: String(data.get('message') || '').trim(),
      consent: data.get('consent') === 'yes',
      website: String(data.get('website') || ''),
      captcha,
    };
    if (channel === 'email' && !payload.email) { setResult('Ingresá un correo para recibir la respuesta.'); setPending(false); return; }
    try {
      const response = await fetch('/api/beauty/public/consultations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', body: JSON.stringify(payload) });
      if (response.status === 202) { setSent(true); setResult('Recibimos tu consulta. Te responderemos por el medio que elegiste.'); form.reset(); }
      else if (response.status === 503) setResult('El formulario aún no está habilitado. Por ahora podés escribirnos por WhatsApp o email.');
      else if (response.status === 429) setResult('Se alcanzó el límite de intentos. Probá nuevamente más tarde.');
      else setResult('No pudimos recibir la consulta. Revisá los datos o utilizá WhatsApp.');
    } catch { setResult('No pudimos conectarnos. Escribinos por WhatsApp o email.'); }
    finally { setPending(false); }
  };
  return <section className="beauty-consultation" aria-labelledby="consultation-title">
    <p className="beauty-eyebrow">Un primer paso, a tu ritmo</p>
    <h2 id="consultation-title">Hablemos de tu cuidado</h2>
    <p>Contanos qué te interesa. Los datos se usan para responderte, no para confirmar reservas. No incluyas información médica sensible.</p>
    {sent ? <p role="status">{result}</p> : <form onSubmit={submit}>
      <div className="beauty-consultation-grid">
        <label>Nombre y apellido *<input name="name" required minLength={2} maxLength={100} autoComplete="name" /></label>
        <label>Celular *<input name="phone" type="tel" required minLength={7} maxLength={25} autoComplete="tel" /></label>
        <label>Correo electrónico {channel === 'email' ? '*' : '(opcional)'}<input name="email" type="email" required={channel === 'email'} maxLength={254} autoComplete="email" /></label>
        <label>Edad (opcional)<input name="age" type="number" min="18" max="120" /></label>
      </div>
      <label>Servicio que te interesa<select value={service} onChange={e => setService(e.target.value)}>{categories.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>¿Qué te gustaría consultar?<textarea name="message" rows={4} maxLength={1000} placeholder="Describí tu interés sin incluir información médica sensible." /></label>
      <fieldset><legend>¿Cómo preferís que te contactemos?</legend>
        {([['whatsapp','WhatsApp'],['email','Correo electrónico'],['llamada','Llamada']] as const).map(([value,label]) => <label className="beauty-consultation-radio" key={value}><input type="radio" name="channel" checked={channel === value} onChange={() => setChannel(value)} /> {label}</label>)}
      </fieldset>
      <label className="beauty-consultation-consent"><input name="consent" type="checkbox" value="yes" required /> Acepto el tratamiento de mis datos para responder esta consulta según la <a href="/privacidad">política de privacidad</a>.</label>
      <div className="beauty-consultation-trap" aria-hidden="true"><label>Sitio web<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      {siteKey ? <div ref={captchaRef} /> : <p className="beauty-small">El formulario estará disponible cuando se habilite la verificación segura.</p>}
      <button className="beauty-button" type="submit" disabled={pending || !captcha || !siteKey}>{pending ? 'Enviando…' : 'Enviar consulta'}</button>
      {result && <p role="status">{result}</p>}
    </form>}
    <p className="beauty-small">¿Preferís escribirnos directamente? <a href="https://wa.me/59897045305">WhatsApp</a> · <a href={'mailto:' + contactEmail}>{contactEmail}</a></p>
  </section>;
}
