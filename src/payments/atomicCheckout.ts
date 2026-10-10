export type CommerceCommand = (command: string, args: Record<string, unknown>) => Promise<any>;
export interface CheckoutGateway {
  create(snapshot: any, request: Record<string, unknown>): Promise<{ id: string; checkoutUrl: string }>;
  lookup(id: string): Promise<any>;
}

function providerMoney(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return NaN;
}

export class CheckoutTerminalError extends Error {
  readonly retryAllowed = true;
  constructor() { super('CHECKOUT_RESERVATION_RELEASED'); }
}

export function createAtomicCheckout(command: CommerceCommand, gateway: CheckoutGateway) {
  return {
    async start(request: Record<string, unknown>) {
      const snapshot = await command('reserve', request);
      // Released is a verified database terminal state. A held but expired or
      // uncertain provider operation must keep its original idempotency key.
      if (snapshot.state === 'released') throw new CheckoutTerminalError();
      if (snapshot.expired) throw new Error('RESERVATION_EXPIRED');
      if (snapshot.state !== 'held') throw new Error('RESERVATION_NOT_ACTIVE');
      if (snapshot.checkoutUrl) return snapshot;
      await command('begin_provider', { orderId: snapshot.orderId });
      // An uncertain HTTP outcome must retain stock and retry the same gateway key.
      // Gateway create MUST use snapshot.orderId as the provider idempotency key.
      const provider = await gateway.create(snapshot, request);
      const bound = await command('bind', { orderId: snapshot.orderId, providerOrderId: provider.id, checkoutUrl: provider.checkoutUrl });
      if (bound.expired) throw new Error('RESERVATION_EXPIRED');
      return { ...snapshot, providerOrderId: provider.id, checkoutUrl: provider.checkoutUrl };
    },
    async reconcile(providerOrderId: string) {
      const truth = await gateway.lookup(providerOrderId);
      const orderId = typeof truth.external_reference === 'string' ? truth.external_reference.trim() : '';
      const total = providerMoney(truth.total_amount);
      const paid = providerMoney(truth.total_paid_amount);
      if (!orderId || !Number.isFinite(total) || total <= 0 || !Number.isFinite(paid) || paid < 0 || truth.currency_id !== 'UYU') throw new Error('INVALID_PROVIDER_PAYMENT');
      if (truth.status === 'processed' && paid !== total) throw new Error('PAYMENT_AMOUNT_MISMATCH');
      // A failed/cancelled order may still contain a successful partial payment.
      // Never declare it financially terminal or release its stock until an
      // authorized recovery verifies the collected funds/refund outcome.
      if (['failed', 'cancelled', 'expired'].includes(truth.status) && paid !== 0) throw new Error('PROVIDER_PAYMENT_RECOVERY_REQUIRED');
      const args = { orderId, providerOrderId, amount: total, currency: truth.currency_id, status: truth.status };
      // RPC checks local reference/amount/currency before any state transition.
      const result = await command('payment', args);
      if (['failed', 'cancelled', 'expired'].includes(truth.status)) {
        await command('reject', { orderId });
        if (result.paymentStatus !== 'paid') return { ...result, paymentStatus: truth.status };
      }
      return result;
    },
  };
}

// This executes an authorized adapter only; no purchasing adapter is installed.
// External exactly-once effects require adapter/provider support for the stable key.
export async function runFulfillmentJob(command: CommerceCommand, owner: string,
  adapter: (job: any, idempotencyKey: string) => Promise<Record<string, unknown>>) {
  const { job } = await command('claim_fulfillment', { owner });
  if (!job) return null;
  const fence = { id: job.id, owner: job.owner, generation: job.generation };
  try {
    const result = await adapter(job, `fulfillment-${job.order_id}`);
    await command('finish_fulfillment', { ...fence, result });
    return result;
  } catch (error) {
    await command('retry_fulfillment', fence);
    throw error;
  }
}
