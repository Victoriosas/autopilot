import { randomUUID, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { requireSupabaseAdminAuth } from '../security/adminAuth';
import { createAtomicCheckout, runFulfillmentJob, type CheckoutGateway, type CommerceCommand } from './atomicCheckout';
import { commerceCommand } from './availability';
import { mercadoPagoGateway } from './mercadoPago';

export async function recoverPaymentReference(command: CommerceCommand, gateway: CheckoutGateway, orderId: string, providerOrderId: string) {
  if (typeof orderId !== 'string' || typeof providerOrderId !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(orderId) || !/^[A-Za-z0-9_-]{1,128}$/.test(providerOrderId)) throw new Error('INVALID_RECOVERY_REFERENCE');
  const truth = await gateway.lookup(providerOrderId);
  if (truth.id !== providerOrderId || truth.external_reference !== orderId) throw new Error('PAYMENT_REFERENCE_MISMATCH');
  const money = (value: unknown) => typeof value === 'number' ? value : typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : NaN;
  const amount = money(truth.total_amount), paid = money(truth.total_paid_amount);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(paid) || paid < 0 || truth.currency_id !== 'UYU') throw new Error('INVALID_PROVIDER_PAYMENT');
  if (truth.status === 'processed' && paid !== amount) throw new Error('PAYMENT_AMOUNT_MISMATCH');
  if (['failed', 'cancelled', 'expired'].includes(truth.status) && paid !== 0) throw new Error('PROVIDER_PAYMENT_RECOVERY_REQUIRED');
  await command('recover_provider', { orderId, providerOrderId, reference: truth.external_reference, amount, currency: truth.currency_id });
  // Reuse this authenticated provider response; never create/replay a payment.
  return createAtomicCheckout(command, { ...gateway, lookup: async () => truth }).reconcile(providerOrderId);
}

export async function runCommerceMaintenance(command: CommerceCommand, gateway: CheckoutGateway, owner: string) {
  const { reservations } = await command('expired', {});
  const checkout = createAtomicCheckout(command, gateway);
  let uncertainReservations = 0, manualTasks = 0, expiryChecks = 0;
  for (const reservation of reservations) {
    if (!reservation.providerStarted) {
      await command('expire', { orderId: reservation.orderId }); expiryChecks++;
    } else if (reservation.providerOrderId) {
      try {
        await checkout.reconcile(reservation.providerOrderId); expiryChecks++;
        // Pending provider payments remain reserved; there is no automatic
        // cancellation or purchase authorization in this maintenance worker.
      } catch { uncertainReservations++; }
    } else if (gateway.find) {
      try {
        const context = await command('recovery_context', { orderId: reservation.orderId });
        const providerOrderId = await gateway.find(reservation.orderId, context.createdAt);
        if (!providerOrderId) { uncertainReservations++; continue; }
        await recoverPaymentReference(command, gateway, reservation.orderId, providerOrderId); expiryChecks++;
      } catch { uncertainReservations++; }
    } else uncertainReservations++;
  }
  for (let i = 0; i < 1; i++) {
    const result = await runFulfillmentJob(command, owner, job => command('prepare_fulfillment', {
      id: job.id, owner: job.owner, generation: job.generation,
    }));
    if (!result) break;
    manualTasks++;
  }
  return { expiryChecks, uncertainReservations, manualTasks };
}

export function createCommerceMaintenanceRouter(dependencies: {
  command?: CommerceCommand; gateway?: CheckoutGateway; env?: () => NodeJS.ProcessEnv;
} = {}) {
  const router = Router();
  const command = dependencies.command ?? commerceCommand;
  const gateway = dependencies.gateway ?? mercadoPagoGateway;
  const environment = dependencies.env ?? (() => process.env);
  // Scheduling/activation is separate from deploying this disabled entry point.
  // The worker only reconciles existing payments and prepares manual fulfillment.
  router.get('/cron', async (req, res) => {
    if (req.method !== 'GET') return res.set('Allow', 'GET').status(405).end();
    const env = environment();
    const secret = env.COMMERCE_MAINTENANCE_CRON_SECRET;
    const header = req.header('authorization');
    if (!secret?.trim() || !header) return res.status(401).json({ error: 'COMMERCE_CRON_AUTH_REQUIRED' });
    const expected = Buffer.from(`Bearer ${secret}`), actual = Buffer.from(header);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return res.status(401).json({ error: 'COMMERCE_CRON_AUTH_REQUIRED' });
    }
    if (env.COMMERCE_MAINTENANCE_CRON_ENABLED !== 'true') return res.json({ status: 'skipped_disabled' });
    try { return res.json(await runCommerceMaintenance(command, gateway, `cron-${randomUUID()}`)); }
    catch { return res.status(503).json({ error: 'COMMERCE_MAINTENANCE_UNAVAILABLE' }); }
  });
  router.post('/recover', requireSupabaseAdminAuth, async (req, res) => {
    try { return res.json(await recoverPaymentReference(command, gateway, req.body?.orderId, req.body?.providerOrderId)); }
    catch { return res.status(409).json({ error: 'PAYMENT_RECOVERY_UNRESOLVED', message: 'No se confirmó la recuperación. Conservá la referencia para revisión administrativa.' }); }
  });
  router.post('/run', requireSupabaseAdminAuth, async (_req, res) => {
    try { return res.json(await runCommerceMaintenance(command, gateway, `manual-${randomUUID()}`)); }
    catch { return res.status(503).json({ error: 'COMMERCE_MAINTENANCE_UNAVAILABLE' }); }
  });
  router.get('/tasks', requireSupabaseAdminAuth, async (_req, res) => {
    try { return res.json(await command('manual_tasks', {})); }
    catch { return res.status(503).json({ error: 'COMMERCE_MAINTENANCE_UNAVAILABLE' }); }
  });
  return router;
}
