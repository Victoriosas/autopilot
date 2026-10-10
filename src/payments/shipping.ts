// Shipping participates in the immutable provider request and database snapshot.
// Reject configuration that cannot be represented exactly as two-decimal money.
export function checkoutShippingConfig() {
  const money = (value: string) => {
    if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error('SHIPPING_NOT_CONFIGURED');
    const amount = Number(value);
    // Match the existing orders DECIMAL(10,2) columns, not only JS precision.
    if (!Number.isFinite(amount) || amount > 99_999_999.99 || !Number.isSafeInteger(Math.round(amount * 100))) throw new Error('SHIPPING_NOT_CONFIGURED');
    return amount;
  };
  return {
    shipping: money(process.env.STORE_SHIPPING_FLAT ?? process.env.VITE_SHIPPING_FLAT ?? '0'),
    freeShippingFrom: money(process.env.STORE_FREE_SHIPPING_FROM ?? process.env.VITE_FREE_SHIPPING_FROM ?? '0'),
  };
}
