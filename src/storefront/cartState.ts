import type { CartItem, Product } from '../types';

type StoredCartItem = {
  productId?: unknown;
  product?: { id?: unknown };
  quantity?: unknown;
  selectedVariant?: unknown;
};

export function cartLimit(product: Pick<Product, 'inventory' | 'status'>): number {
  if (product.status !== 'published') return 0;
  const inventory = Number(product.inventory);
  if (!Number.isSafeInteger(inventory) || inventory <= 0) return 0;
  return Math.min(20, inventory);
}

export function restoreCart(value: unknown, products: Product[]): CartItem[] {
  if (!Array.isArray(value)) return [];
  const published = new Map(
    products.filter((product) => product.status === 'published').map((product) => [product.id, product]),
  );
  const restored: CartItem[] = [];
  const totals = new Map<string, number>();

  for (const raw of value as StoredCartItem[]) {
    if (!raw || typeof raw !== 'object') continue;
    const productId = typeof raw.productId === 'string'
      ? raw.productId
      : typeof raw.product?.id === 'string' ? raw.product.id : '';
    const product = published.get(productId);
    if (!product || !Number.isSafeInteger(raw.quantity) || Number(raw.quantity) < 1) continue;
    const currentTotal = totals.get(productId) || 0;
    const available = Math.max(0, cartLimit(product) - currentTotal);
    if (available < 1) continue;
    const quantity = Math.min(Number(raw.quantity), available);
    const selectedVariant = typeof raw.selectedVariant === 'string' && raw.selectedVariant.trim()
      ? raw.selectedVariant.trim().slice(0, 120)
      : undefined;
    const existing = restored.find(
      (item) => item.product.id === productId && item.selectedVariant === selectedVariant,
    );
    if (existing) existing.quantity += quantity;
    else restored.push({ product, quantity, selectedVariant });
    totals.set(productId, currentTotal + quantity);
  }

  return restored;
}
