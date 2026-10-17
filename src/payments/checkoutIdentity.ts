import { createClient } from '@supabase/supabase-js';

export class CheckoutIdentityError extends Error {
  constructor(readonly status: 401 | 503) {
    super(status === 401 ? 'CHECKOUT_AUTHENTICATION_REQUIRED' : 'CHECKOUT_AUTH_UNAVAILABLE');
  }
}

async function verifySupabaseUser(token: string): Promise<string | null> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new CheckoutIdentityError(503);
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  // Auth verifies the supplied bearer; never trust a decoded JWT or request userId.
  const result = await db.auth.getUser(token);
  if (result.error) {
    if ([400, 401, 403, 422].includes(result.error.status || 0)) return null;
    throw new CheckoutIdentityError(503);
  }
  return result.data.user?.id || null;
}

export async function resolveCheckoutUser(
  authorization: string | undefined,
  verify: (token: string) => Promise<string | null> = verifySupabaseUser,
): Promise<string | null> {
  if (authorization === undefined) return null;
  const match = authorization.length <= 4096 && /^Bearer ([A-Za-z0-9._-]+)$/i.exec(authorization);
  if (!match) throw new CheckoutIdentityError(401);
  let userId: string | null;
  try { userId = await verify(match[1]); }
  catch { throw new CheckoutIdentityError(503); }
  if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    throw new CheckoutIdentityError(401);
  }
  return userId;
}
