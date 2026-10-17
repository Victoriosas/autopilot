import { mercadoPagoCredentialsReady, paymentAvailability } from '../payments/availability';

type Availability = { requested: boolean; available: boolean; reason: string | null };
export async function releaseCheckoutCheck(
  inspect: () => Promise<Availability> = () => paymentAvailability('mercadopago', mercadoPagoCredentialsReady()),
) {
  try {
    const state = await inspect();
    const ok = state.requested === true && state.available === true;
    return { id: 'verified_checkout', ok, requiredForCommerce: true,
      detail: ok ? 'Atomic checkout available' : state.reason || 'COMMERCE_AVAILABILITY_UNVERIFIED' };
  } catch {
    return { id: 'verified_checkout', ok: false, requiredForCommerce: true, detail: 'COMMERCE_AVAILABILITY_UNVERIFIED' };
  }
}
