// Persist only an opaque hash and random key, never the customer's form contents.
export async function checkoutKey(storage: Pick<Storage, 'getItem' | 'setItem'>, intent: unknown) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(intent)));
  const hash = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
  const storageKey = `victoriosa.checkout.${hash}`;
  const existing = storage.getItem(storageKey);
  if (existing && /^[a-zA-Z0-9_-]{16,128}$/.test(existing)) return existing;
  const key = crypto.randomUUID();
  storage.setItem(storageKey, key);
  storage.setItem(`victoriosa.checkout.key.${key}`, storageKey);
  return key;
}

export function forgetCheckoutKey(storage: Pick<Storage, 'getItem' | 'removeItem'>, key: string) {
  const reference = `victoriosa.checkout.key.${key}`;
  const storageKey = storage.getItem(reference);
  if (storageKey && storage.getItem(storageKey) === key) storage.removeItem(storageKey);
  storage.removeItem(reference);
}

// Rotate only after a server conflict proves that this reservation was released.
// The buyer must click again; never create a replacement charge automatically.
export function retireReleasedCheckoutKey(storage: Pick<Storage, 'getItem' | 'removeItem'>,
  key: string, status: number, result: { error?: unknown; retryAllowed?: unknown }): boolean {
  if (status !== 409 || result.error !== 'CHECKOUT_RESERVATION_RELEASED' || result.retryAllowed !== true) return false;
  forgetCheckoutKey(storage, key);
  return true;
}
