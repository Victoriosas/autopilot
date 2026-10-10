import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { requireSupabaseAdminAuth } from '../security/adminAuth';
import { createAtomicCheckout, runFulfillmentJob, type CheckoutGateway, type CommerceCommand } from './atomicCheckout';
import { commerceCommand } from './availability';
import { mercadoPagoGateway } from './mercadoPago';

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
    } else uncertainReservations++;
  }
  for (let i = 0; i < 10; i++) {
    const result = await runFulfillmentJob(command, owner, job => command('prepare_fulfillment', {
      id: job.id, owner: job.owner, generation: job.generation,
    }));
    if (!result) break;
    manualTasks++;
  }
  return { expiryChecks, uncertainReservations, manualTasks };
}

export function createCommerceMaintenanceRouter() {
  const router = Router();
  router.post('/run', requireSupabaseAdminAuth, async (_req, res) => {
    try { return res.json(await runCommerceMaintenance(commerceCommand, mercadoPagoGateway, `manual-${randomUUID()}`)); }
    catch { return res.status(503).json({ error: 'COMMERCE_MAINTENANCE_UNAVAILABLE' }); }
  });
  router.get('/tasks', requireSupabaseAdminAuth, async (_req, res) => {
    try { return res.json(await commerceCommand('manual_tasks', {})); }
    catch { return res.status(503).json({ error: 'COMMERCE_MAINTENANCE_UNAVAILABLE' }); }
  });
  return router;
}
