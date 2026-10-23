import type { Express } from 'express';

const destination = 'victoriosas.online@gmail.com';
const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max + 1) : '';
const safe = (value: string) => value.replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character] || character));

export function mountPublicBeautyConsultations(app: Express) {
  app.post('/api/beauty/public/consultations', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const apiKey = process.env.BEAUTY_MAIL_RESEND_API_KEY;
    const from = process.env.BEAUTY_MAIL_FROM;
    const secret = process.env.BEAUTY_TURNSTILE_SECRET;
    const enabled = process.env.BEAUTY_PUBLIC_CONSULTATIONS_ENABLED === 'true';
    // Fail closed: never accept PII if delivery or bot protection is not ready.
    if (!enabled || !apiKey || !from || !secret) return res.status(503).json({ error: 'CONSULTATIONS_DISABLED' });
    if (!req.is('application/json')) return res.status(415).json({ error: 'UNSUPPORTED_MEDIA_TYPE' });
    if (JSON.stringify(req.body || {}).length > 5000) return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE' });
    const body = req.body || {};
    if (text(body.website, 200)) return res.status(202).json({ status: 'accepted' });
    const name = text(body.name, 100), phone = text(body.phone, 25), email = text(body.email, 254);
    const age = text(body.age, 3), service = text(body.service, 120), message = text(body.message, 1000);
    const channel = body.channel;
    if (name.length < 2 || name.length > 100 || !/^[+()\d\s-]{7,25}$/.test(phone) ||
      (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
      (channel === 'email' && !email) ||
      !['whatsapp', 'email', 'llamada'].includes(channel) || service.length < 2 || service.length > 120 ||
      message.length > 1000 || (age && (!/^\d{2,3}$/.test(age) || +age < 18 || +age > 120)) ||
      body.consent !== true || !text(body.captcha, 4096)) {
      return res.status(400).json({ error: 'INVALID_CONSULTATION' });
    }
    try {
      const challengeBody = new URLSearchParams({ secret, response: text(body.captcha, 4096) });
      const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', body: challengeBody, signal: AbortSignal.timeout(7000),
      });
      if (!verification.ok || !(await verification.json() as { success?: boolean }).success) {
        return res.status(400).json({ error: 'BOT_VERIFICATION_FAILED' });
      }
      const details = [['Nombre', name], ['Celular', phone], ['Email', email || 'No proporcionado'], ['Edad', age || 'No informada'], ['Servicio', service], ['Preferencia de contacto', channel], ['Consulta', message || 'Sin detalle']];
      const html = '<h2>Nueva consulta desde Victoriosas.online</h2><dl>' + details.map(([label,value]) => '<dt><b>'+safe(label)+'</b></dt><dd>'+safe(value).replace(/\n/g,'<br>')+'</dd>').join('') + '</dl><p>La persona aceptó la política de privacidad para recibir una respuesta. Esta notificación no representa una reserva.</p>';
      const delivery = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [destination], subject: 'Nueva consulta · Victoriosas · ' + service.replace(/[\r\n]/g, ' ').slice(0, 90), html, reply_to: email || undefined }),
        signal: AbortSignal.timeout(10000),
      });
      if (!delivery.ok) return res.status(503).json({ error: 'DELIVERY_UNAVAILABLE' });
      return res.status(202).json({ status: 'accepted' });
    } catch {
      return res.status(503).json({ error: 'CONSULTATIONS_UNAVAILABLE' });
    }
  });
}
