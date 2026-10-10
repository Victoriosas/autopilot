import { createClient } from '@supabase/supabase-js';
import { checkoutEnabled, paymentDatabaseConfigured } from './safety';
import type { CommerceCommand } from './atomicCheckout';

export const commerceCommand: CommerceCommand = async (command, args) => {
  const db = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = command === 'recovery_context'
    ? await db.rpc('commerce_recovery_context', { args })
    : command === 'recover_provider'
    ? await db.rpc('commerce_recover_provider_order', { args })
    : await db.rpc('commerce_checkout_command', { command, args });
  if (error) throw new Error(/^[A-Z][A-Z0-9_]+$/.test(error.message) ? error.message : 'COMMERCE_DATABASE_UNAVAILABLE');
  return data;
};

export async function paymentAvailability(provider: string, credentials: boolean, command: CommerceCommand = commerceCommand) {
  const requested = checkoutEnabled();
  const unavailable = (reason: string) => ({ requested, available: false, reason });
  if (!requested) return unavailable('CHECKOUT_DISABLED');
  if (provider !== 'mercadopago') return unavailable('ATOMIC_PROVIDER_NOT_IMPLEMENTED');
  if (process.env.COMMERCE_ATOMIC_CHECKOUT_ENABLED !== 'true') return unavailable('ATOMIC_CHECKOUT_NOT_ENABLED');
  if (!credentials) return unavailable('PAYMENT_NOT_CONFIGURED');
  try {
    const capability = await command('capabilities', { provider, environment: process.env.NODE_ENV === 'production' ? 'live' : 'sandbox', currency: 'UYU' });
    if (capability?.available !== true || capability?.atomicCheckout !== true || capability?.fulfillmentQueue !== true) return unavailable('PAYMENT_CAPABILITIES_NOT_VERIFIED');
    return { requested, available: true, reason: null };
  } catch { return unavailable('COMMERCE_DATABASE_UNAVAILABLE'); }
}

export function mercadoPagoCredentialsReady() {
  try {
    const url = new URL(process.env.PUBLIC_APP_URL || '');
    return paymentDatabaseConfigured() && Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()) &&
      (process.env.STORE_CURRENCY || process.env.VITE_STORE_CURRENCY || 'UYU').toUpperCase() === 'UYU' &&
      ['http:', 'https:'].includes(url.protocol) && (process.env.NODE_ENV !== 'production' || url.protocol === 'https:');
  } catch { return false; }
}
