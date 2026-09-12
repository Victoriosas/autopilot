import supabase from '../lib/supabase';
import type { CartItem, OrderCustomer } from '../types';

const db = supabase as any;

export type RevenueEventName =
  | 'product_view'
  | 'add_to_cart'
  | 'checkout_started'
  | 'whatsapp_order_started'
  | 'transfer_order_created'
  | 'mercadopago_order_started'
  | 'payment_completed';

export interface RevenueEventPayload {
  productId?: string;
  orderId?: string;
  value?: number;
  currency?: string;
  itemCount?: number;
  channel?: 'store' | 'whatsapp' | 'bank_transfer' | 'paypal' | 'mercadopago';
}

export const STORE_CURRENCY = (import.meta.env.VITE_STORE_CURRENCY || 'UYU').toUpperCase();
export const SALES_WHATSAPP = (import.meta.env.VITE_SALES_WHATSAPP || '').replace(/\D/g, '');
export const BANK_TRANSFER_LABEL = import.meta.env.VITE_BANK_TRANSFER_LABEL || '';
export const BANK_TRANSFER_INSTRUCTIONS = import.meta.env.VITE_BANK_TRANSFER_INSTRUCTIONS || '';
export const SHIPPING_FLAT = Number(import.meta.env.VITE_SHIPPING_FLAT || '0');
export const FREE_SHIPPING_FROM = Number(import.meta.env.VITE_FREE_SHIPPING_FROM || '0');

export function calculateCartTotals(cart: CartItem[]) {
  const subtotal = Number(cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0).toFixed(2));
  const shipping = FREE_SHIPPING_FROM > 0 && subtotal >= FREE_SHIPPING_FROM ? 0 : Math.max(0, SHIPPING_FLAT || 0);
  const total = Number((subtotal + shipping).toFixed(2));
  return { subtotal, shipping, total, currency: STORE_CURRENCY };
}

// Funnel analytics are best-effort only. They never establish payment truth.
export async function trackRevenueEvent(name: RevenueEventName, payload: RevenueEventPayload = {}) {
  const safePayload = { ...payload, occurredAt: new Date().toISOString() };
  try {
    await db.from('audit_logs').insert({
      event_type: `REVENUE_${name.toUpperCase()}`,
      entity_id: payload.orderId || payload.productId || null,
      new_values: safePayload,
    });
  } catch {
    console.info('[revenue-event]', name, safePayload);
  }
}

export function buildWhatsAppOrderUrl(cart: CartItem[], customer?: Partial<OrderCustomer>) {
  if (!SALES_WHATSAPP || cart.length === 0) return null;
  const totals = calculateCartTotals(cart);
  const items = cart
    .map((item) => `• ${item.product.title} x${item.quantity} — ${STORE_CURRENCY} ${(item.product.price * item.quantity).toFixed(2)}`)
    .join('\n');
  const identity = customer?.name || customer?.fullName ? `\nCliente: ${customer.name || customer.fullName}` : '';
  const message = [
    'Hola Victoriosa, quiero comprar:',
    '',
    items,
    '',
    `Total estimado: ${STORE_CURRENCY} ${totals.total.toFixed(2)}`,
    identity,
    '',
    '¿Me ayudan a finalizar el pedido?',
  ].join('\n');
  return `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

export function serializeCheckoutItems(cart: CartItem[]) {
  return cart.map((item) => ({
    productId: item.product.id,
    quantity: item.quantity,
    selectedVariant: item.selectedVariant,
  }));
}
