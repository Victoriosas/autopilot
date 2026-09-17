import { randomUUID } from 'node:crypto';

export function orderIdentity(prefix: string) {
  const id = randomUUID();
  return { id, orderNumber: `VIC-${prefix}-${id.toUpperCase()}` };
}

export function checkoutEnabled() {
  return process.env.CHECKOUT_ENABLED === 'true';
}

export function paymentDatabaseConfigured() {
  return Boolean((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function requireCheckoutEnabled() {
  if (!checkoutEnabled()) throw new Error('CHECKOUT_NOT_CONFIGURED');
}

export function validateCustomer(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('CUSTOMER_FIELDS_REQUIRED');
  const input = value as Record<string, unknown>;
  const read = (key: string, max: number) => {
    const value = input[key];
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error('CUSTOMER_FIELDS_REQUIRED');
    return value.trim();
  };
  const name = typeof input.fullName === 'string' && input.fullName.trim() ? read('fullName', 160) : read('name', 160);
  const email = read('email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('INVALID_CUSTOMER_EMAIL');
  const phone = read('phone', 40);
  if (!/^[+\d\s().-]{6,40}$/.test(phone)) throw new Error('INVALID_CUSTOMER_PHONE');
  const country = read('country', 80);
  // The configured shipping quote currently covers Uruguay only.
  if (!['uy', 'uruguay'].includes(country.toLowerCase())) throw new Error('SHIPPING_COUNTRY_NOT_SUPPORTED');
  return { name, fullName: name, email, phone, address: read('address', 300), city: read('city', 120), postalCode: read('postalCode', 20), country: 'Uruguay' };
}

export function publicPaymentError(error: unknown) {
  const raw = error instanceof Error ? error.message : '';
  // Never return database/provider diagnostics or credential-bearing exceptions.
  const code = /^[A-Z][A-Z0-9_]{1,80}$/.test(raw) ? raw : 'PAYMENT_REQUEST_FAILED';
  const messages: Record<string, string> = {
    CUSTOMER_FIELDS_REQUIRED: 'Revisá y completá tus datos de contacto y entrega.',
    INVALID_CUSTOMER_EMAIL: 'Ingresá un email válido.',
    INVALID_CUSTOMER_PHONE: 'Ingresá un teléfono válido.',
    SHIPPING_COUNTRY_NOT_SUPPORTED: 'Por ahora el envío online está disponible solamente para Uruguay.',
    PRODUCT_OUT_OF_STOCK: 'La cantidad solicitada ya no está disponible. Revisá tu carrito.',
    PRODUCT_NOT_AVAILABLE: 'Uno de los productos ya no está disponible. Revisá tu carrito.',
    PRODUCT_NOT_FOUND: 'Uno de los productos ya no está disponible. Revisá tu carrito.',
    INVALID_CHECKOUT_ITEMS: 'Revisá los productos de tu carrito.',
    INVALID_CHECKOUT_ITEM: 'Revisá los productos y las cantidades de tu carrito.',
    VARIANT_CHECKOUT_NOT_CONFIGURED: 'Esta variante requiere confirmar disponibilidad antes de comprar.',
    CHECKOUT_NOT_CONFIGURED: 'Los pagos online todavía no están habilitados.',
  };
  return { error: code, message: messages[code] || 'No pudimos completar la operación. Intentá nuevamente o contactanos con la referencia de tu pedido.' };
}

export function paypalAvailability() {
  const currency = (process.env.STORE_CURRENCY || process.env.VITE_STORE_CURRENCY || 'UYU').toUpperCase();
  const rate = currency === 'USD' ? 1 : Number(process.env.PAYPAL_STORE_TO_USD_RATE || '0');
  const conversionConfigured = Number.isFinite(rate) && rate > 0;
  let reason: string | null = null;
  if (!checkoutEnabled()) reason = 'Los pagos online todavía no están habilitados.';
  else if (!paymentDatabaseConfigured()) reason = 'PayPal no está disponible temporalmente.';
  else if (!process.env.PAYPAL_CLIENT_ID?.trim() || !process.env.PAYPAL_CLIENT_SECRET?.trim()) reason = 'PayPal todavía no está disponible. Elegí otro medio de pago.';
  else if (!['live', 'sandbox'].includes(process.env.PAYPAL_ENV || '') || (process.env.NODE_ENV === 'production' && process.env.PAYPAL_ENV !== 'live')) reason = 'PayPal todavía no está habilitado para compras reales.';
  else if (!process.env.PAYPAL_WEBHOOK_ID?.trim()) reason = 'PayPal está pendiente de verificación. Elegí otro medio de pago.';
  else if (!conversionConfigured) reason = 'La conversión a dólares no está disponible. Elegí otro medio de pago.';
  return { configured: reason === null, reason, conversionConfigured, rate: conversionConfigured ? rate : null };
}

export function validateCheckoutItems(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) throw new Error('INVALID_CHECKOUT_ITEMS');
  const seen = new Set<string>();
  return value.map((item) => {
    const productId = typeof item?.productId === 'string' ? item.productId.trim() : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId) ||
        !Number.isInteger(item?.quantity) || item.quantity < 1 || item.quantity > 20 || seen.has(productId)) {
      throw new Error('INVALID_CHECKOUT_ITEM');
    }
    seen.add(productId);
    // Variant-specific pricing and inventory are not integrated yet.
    if (item.selectedVariant) throw new Error('VARIANT_CHECKOUT_NOT_CONFIGURED');
    return { productId, quantity: item.quantity as number, selectedVariant: undefined as string | undefined };
  });
}

export function assertStock(product: { inventory?: unknown; currency?: unknown }, quantity: number) {
  const currency = (process.env.STORE_CURRENCY || process.env.VITE_STORE_CURRENCY || 'UYU').toUpperCase();
  if (product.currency !== currency) throw new Error('PRODUCT_CURRENCY_NOT_CONFIGURED');
  if (!Number.isInteger(product.inventory) || Number(product.inventory) < quantity) throw new Error('PRODUCT_OUT_OF_STOCK');
}

export function assertPaymentAmount(expected: unknown, actual: unknown, expectedCurrency: string, actualCurrency: string) {
  const a = Number(expected);
  const b = Number(actual);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0 ||
      Math.round(a * 100) !== Math.round(b * 100) || expectedCurrency !== actualCurrency) {
    throw new Error('PAYMENT_AMOUNT_OR_CURRENCY_MISMATCH');
  }
}
