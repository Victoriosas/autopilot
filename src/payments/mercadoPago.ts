import { Router } from 'express';
import { validateCustomer, validateCheckoutItems, publicPaymentError } from './safety';
import { CheckoutTerminalError, createAtomicCheckout, type CheckoutGateway, type CommerceCommand } from './atomicCheckout';
import { commerceCommand, mercadoPagoCredentialsReady, paymentAvailability } from './availability';
import { checkoutShippingConfig } from './shipping';
import { CheckoutIdentityError, resolveCheckoutUser } from './checkoutIdentity';

const MP_API = 'https://api.mercadopago.com';
export const mercadoPagoAvailability = () => paymentAvailability('mercadopago', mercadoPagoCredentialsReady());

export const mercadoPagoGateway: CheckoutGateway = {
  async find(orderId, createdAt) {
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()) throw new Error('MERCADOPAGO_NOT_CONFIGURED');
    const created = Date.parse(createdAt);
    if (!Number.isFinite(created) || created > Date.now()) throw new Error('INVALID_RECOVERY_DATE');
    const query = new URLSearchParams({ external_reference: orderId,
      begin_date: new Date(created - 300000).toISOString(), end_date: new Date().toISOString(), limit: '2', offset: '0' });
    const response = await fetch(`${MP_API}/v1/orders?${query}`, { method: 'GET', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`, Accept: 'application/json' } });
    if (!response.ok) throw new Error('MERCADOPAGO_ORDER_LOOKUP_FAILED');
    const result = await response.json();
    // An empty/truncated/ambiguous response is never proof of an absent charge.
    if (!Array.isArray(result.data) || result.data.length !== 1 || result.paging?.total !== 1) return null;
    const match = result.data[0];
    return match.external_reference === orderId && typeof match.id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(match.id) ? match.id : null;
  },
  async create(snapshot, request) {
    const appUrl = String(request.returnUrl);
    const items = snapshot.items.map((item: any) => ({ title: item.title, unit_price: Number(item.price).toFixed(2), quantity: item.quantity, unit_measure: 'unit', total_amount: (Number(item.price) * item.quantity).toFixed(2) }));
    if (snapshot.shipping > 0) items.push({ title: 'Envío', unit_price: Number(snapshot.shipping).toFixed(2), quantity: 1, unit_measure: 'unit', total_amount: Number(snapshot.shipping).toFixed(2) });
    const response = await fetch(`${MP_API}/v1/orders`, {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/json', 'X-Idempotency-Key': snapshot.orderId },
      body: JSON.stringify({ type: 'online', processing_mode: 'manual', capture_mode: 'automatic_async',
        total_amount: Number(snapshot.total).toFixed(2), external_reference: snapshot.orderId,
        payer: { email: (request.customer as any).email }, items, description: `Pedido Victoriosa ${snapshot.orderId}`,
        config: { notification_url: `${appUrl}/api/payments/mercadopago/webhook`, online: {
          success_url: `${appUrl}/?payment=success&provider=mercadopago&order=${encodeURIComponent(snapshot.orderId)}`,
          failure_url: `${appUrl}/?payment=failure&provider=mercadopago&order=${encodeURIComponent(snapshot.orderId)}`,
          pending_url: `${appUrl}/?payment=pending&provider=mercadopago&order=${encodeURIComponent(snapshot.orderId)}`, auto_return: 'all',
        } },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || typeof data.id !== 'string' || typeof data.checkout_url !== 'string') throw new Error('MERCADOPAGO_ORDER_CREATE_FAILED');
    return { id: data.id, checkoutUrl: data.checkout_url };
  },
  async lookup(id) {
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()) throw new Error('MERCADOPAGO_NOT_CONFIGURED');
    const response = await fetch(`${MP_API}/v1/orders/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`, Accept: 'application/json' } });
    if (!response.ok) throw new Error('MERCADOPAGO_ORDER_LOOKUP_FAILED');
    return response.json();
  },
};

// Dependencies are server-only test seams; request flags never replace capability checks.
export function createMercadoPagoRouter(dependencies: {
  command?: CommerceCommand; gateway?: CheckoutGateway;
  customerIdentity?: (authorization: string | undefined) => Promise<string | null>;
  available?: () => Promise<{ requested: boolean; available: boolean; reason: string | null }>;
} = {}): Router {
  const router = Router();
  const availability = dependencies.available || mercadoPagoAvailability;
  const checkout = createAtomicCheckout(dependencies.command || commerceCommand, dependencies.gateway || mercadoPagoGateway);
  router.get('/config', async (_req, res) => {
    const state = await availability();
    res.json({ configured: state.available, checkoutRequested: state.requested, unavailableReason: state.reason, provider: 'mercadopago', checkout: 'atomic-pro-orders', storeCurrency: 'UYU' });
  });
  router.post('/order', async (req, res) => {
    try {
      if (!(await availability()).available) return res.status(503).json({ error: 'CHECKOUT_NOT_CONFIGURED', message: 'Los pagos online todavía no están disponibles.' });
      const key = req.header('Idempotency-Key') || '';
      if (!/^[a-zA-Z0-9_-]{16,128}$/.test(key)) return res.status(400).json({ error: 'IDEMPOTENCY_KEY_REQUIRED' });
      const userId = await (dependencies.customerIdentity || resolveCheckoutUser)(req.header('authorization'));
      const snapshot = await checkout.start({ key, userId, provider: 'mercadopago', currency: 'UYU',
        customer: validateCustomer(req.body?.customer), items: validateCheckoutItems(req.body?.items),
        ...checkoutShippingConfig(),
        returnUrl: (process.env.PUBLIC_APP_URL || '').replace(/\/$/, ''),
      });
      return res.status(201).json({ orderId: snapshot.orderId, providerOrderId: snapshot.providerOrderId, checkoutUrl: snapshot.checkoutUrl, total: snapshot.total, currency: snapshot.currency });
    } catch (error) {
      if (error instanceof CheckoutIdentityError) return res.status(error.status).json({ error: error.message,
        message: error.status === 401 ? 'Tu sesión no es válida. Iniciá sesión nuevamente para continuar.' : 'No pudimos verificar tu sesión. Intentá nuevamente más tarde.' });
      if (error instanceof CheckoutTerminalError) return res.status(409).json({ error: error.message, message: 'La reserva anterior fue cancelada. Podés iniciar una nueva compra.', retryAllowed: true });
      const code = error instanceof Error ? error.message : '';
      return res.status(code.includes('IDEMPOTENCY_CONFLICT') ? 409 : code.includes('DATABASE') || code.includes('MERCADOPAGO') || code === 'SHIPPING_NOT_CONFIGURED' ? 503 : 400).json(publicPaymentError(error));
    }
  });
  router.post('/webhook', async (req, res) => {
    const candidate = req.body?.data?.id || req.body?.id || req.query?.['data.id'] || req.query?.id;
    if (!candidate || !['string', 'number'].includes(typeof candidate)) return res.json({ received: true, reconciled: false });
    try {
      // Previously created orders still reconcile when new sales are disabled.
      const result = await checkout.reconcile(String(candidate));
      return res.json({ received: true, reconciled: true, ...result });
    } catch { return res.status(503).json({ received: true, reconciled: false }); }
  });
  router.post('/reconcile', async (req, res) => {
    const id = typeof req.body?.providerOrderId === 'string' ? req.body.providerOrderId.trim() : '';
    if (!id) return res.status(400).json({ error: 'PROVIDER_ORDER_ID_REQUIRED' });
    try { return res.json(await checkout.reconcile(id)); }
    catch (error) { return res.status(400).json(publicPaymentError(error)); }
  });
  return router;
}
