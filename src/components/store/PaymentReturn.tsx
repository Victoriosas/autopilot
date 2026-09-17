import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

export function PaymentReturn() {
  const [message, setMessage] = useState('Consultando el estado de tu pago…');
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(() => new URLSearchParams(location.search).get('provider') === 'mercadopago');
  const check = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const stored = sessionStorage.getItem('victoriosa-mp-order');
      if (!stored) { setMessage('No encontramos la referencia en este navegador. Conservá el comprobante de Mercado Pago y consultá con Victoriosa antes de volver a pagar.'); return; }
      const { providerOrderId } = JSON.parse(stored);
      const response = await apiFetch('/api/payments/mercadopago/reconcile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerOrderId }) });
      if (!response.ok) throw new Error();
      const result = await response.json();
      const labels: Record<string, string> = { paid: 'Pago confirmado. Tu pedido quedó registrado.', pending: 'Tu pago sigue pendiente. No vuelvas a pagar mientras esperás la confirmación.', failed: 'El pago fue rechazado. Podés volver a intentar desde tu bolsa.', cancelled: 'El pago fue cancelado. Tu bolsa sigue disponible.', expired: 'El pago venció. Podés volver a intentar desde tu bolsa.', refunded: 'El pago figura como reembolsado.' };
      setMessage(labels[result.paymentStatus] || 'El pago todavía no está confirmado. Conservá tu comprobante y volvé a consultar.');
    } catch { setMessage('No pudimos consultar el pago. No vuelvas a pagar si ya recibiste un comprobante; intentá consultar nuevamente.'); }
    finally { setBusy(false); }
  };
  useEffect(() => { if (visible) void check(); }, []);
  if (!visible) return null;
  return <section className="m-4 rounded-2xl border border-[#7b594c]/30 bg-white p-5 text-[#3b2b28]" aria-label="Estado del pago"><p role="status">{message}</p><div className="mt-3 flex gap-4"><button disabled={busy} onClick={() => void check()} className="underline disabled:opacity-50">{busy ? 'Consultando…' : 'Consultar nuevamente'}</button><button onClick={() => { setVisible(false); history.replaceState(null, '', location.pathname + location.hash); }} className="underline">Cerrar</button></div></section>;
}
