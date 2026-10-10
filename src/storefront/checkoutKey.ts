// Persist only an opaque hash and random key, never the customer's form contents.
export async function checkoutKey(storage: Pick<Storage, 'getItem' | 'setItem'>, intent: unknown) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(intent)));
  const hash = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
  const storageKey = `victoriosa.checkout.${hash}`;
  const existing = storage.getItem(storageKey);
  if (existing && /^[a-zA-Z0-9_-]{16,128}$/.test(existing)) return existing;
  const key = crypto.randomUUID();
  storage.setItem(storageKey, key);
  return key;
}
