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
