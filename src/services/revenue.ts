import supabase from '../lib/supabase';
import type { CartItem, OrderCustomer } from '../types';

// The generated Supabase schema in this legacy app is incomplete for some
// operational tables. Keep the type escape at the database boundary only.
const db = supabase as any;

export type RevenueEventName =
  | 'product_view'
  | 'add_to_cart'
  | 'checkout_started'
  | 'whatsapp_order_started'
  | 'transfer_order_created'
  | 'payment_completed';

export interface RevenueEventPayload {
  productId?: string;
  orderId?: string;
  value?: number;
  currency?: string;
  itemCount?: number;
  channel?: 'store' | 'whatsapp' | 'bank_transfer' | 'paypal';
}

export const STORE_CURRENCY = (import.meta.env.VITE_STORE_CURRENCY || 'UYU').toUpperCase();
export const SALES_WHATSAPP = (import.meta.env.VITE_SALES_WHATSAPP || '').replace(/\D/g, '');
export const BANK_TRANSFER_LABEL = import.meta.env.VITE_BANK_TRANSFER_LABEL || '';
export const BANK_TRANSFER_INSTRUCTIONS = import.meta.env.VITE_BANK_TRANSFER_INSTRUCTIONS || '';
export const SHIPPING_FLAT = Number(import.meta.env.VITE_SHIPPING_FLAT || '0');
export const FREE_SHIPPING_FROM = Number(import.meta.env.VITE_FREE_SHIPPING_FROM || '0');
export const PAYPAL_USD_RATE = Number(import.meta.env.VITE_PAYPAL_USD_RATE || (STORE_CURRENCY === 'USD' ? '1' : '0'));

export function calculateCartTotals(cart: CartItem[]) {
  const subtotal = Number(cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0).toFixed(2));
  const shipping = FREE_SHIPPING_FROM > 0 && subtotal >= FREE_SHIPPING_FROM ? 0 : Math.max(0, SHIPPING_FLAT || 0);
  const total = Number((subtotal + shipping).toFixed(2));
  return { subtotal, shipping, total, currency: STORE_CURRENCY };
}

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

function serializeItems(cart: CartItem[]) {
  return cart.map((item) => ({
    productId: item.product.id,
    title: item.product.title,
    price: item.product.price,
    quantity: item.quantity,
    image: item.product.images?.[0] || '',
    selectedVariant: item.selectedVariant,
    sku: item.product.sku,
  }));
}

async function insertPendingOrder(
  cart: CartItem[],
  customer: OrderCustomer,
  paymentMethod: 'bank_transfer' | 'paypal',
  paymentStatus: 'pending_verification' | 'pending',
) {
  if (cart.length === 0) throw new Error('El carrito está vacío.');
  const totals = calculateCartTotals(cart);
  const prefix = paymentMethod === 'paypal' ? 'PP' : 'TR';
  const orderId = `VIC-${prefix}-${Date.now().toString().slice(-8)}`;
  const items = serializeItems(cart);

  const row = {
    id: orderId,
    order_number: orderId,
    customer_email: customer.email || null,
    customer_name: customer.fullName || customer.name || null,
    customer_phone: customer.phone || null,
    customer_address: customer.address,
    customer_city: customer.city,
    customer_postal_code: customer.postalCode,
    customer_country: customer.country,
    items,
    subtotal: totals.subtotal,
    shipping_cost: totals.shipping,
    discount: 0,
    total: totals.total,
    currency: totals.currency,
    payment_method: paymentMethod,
    payment_status: paymentStatus,
    payment_id: null,
    payment_gateway: paymentMethod === 'paypal' ? 'paypal' : null,
    status: 'pending_payment',
    tracking_number: '',
    estimated_delivery: '',
    created_at: new Date().toISOString(),
  };

  const { error } = await db.from('orders').insert(row);
  if (error) throw new Error(error.message || 'No se pudo crear el pedido.');
  return { orderId, items, ...totals };
}

export async function createManualTransferOrder(cart: CartItem[], customer: OrderCustomer) {
  const order = await insertPendingOrder(cart, customer, 'bank_transfer', 'pending_verification');
  await trackRevenueEvent('transfer_order_created', {
    orderId: order.orderId,
    value: order.total,
    currency: order.currency,
    itemCount: cart.reduce((sum, item) => sum + item.quantity, 0),
    channel: 'bank_transfer',
  });
  return order;
}

export async function createPendingPayPalOrder(cart: CartItem[], customer: OrderCustomer) {
  return insertPendingOrder(cart, customer, 'paypal', 'pending');
}

export async function markPayPalOrderPaid(orderId: string, paymentId: string) {
  if (!orderId || !paymentId) throw new Error('Falta identificación de pago.');
  const { error } = await db
    .from('orders')
    .update({
      payment_status: 'paid',
      payment_id: paymentId,
      payment_gateway: 'paypal',
      status: 'confirmed',
    })
    .eq('id', orderId)
    .eq('payment_method', 'paypal')
    .eq('payment_status', 'pending');
  if (error) throw new Error(error.message || 'No se pudo confirmar el pedido pagado.');
}
