import { createClient } from '@supabase/supabase-js';
import type { NextFunction, Request, Response } from 'express';

const ADMIN_PREFIXES = [
  '/api/autopilot/',
  '/api/connectors',
  '/api/fulfillment/',
  '/api/sourcing/',
] as const;

function isProtectedAdminPath(pathname: string): boolean {
  if (pathname.startsWith('/api/autopilot/v4')) return false;
  return ADMIN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function extractBearer(req: Request): string | null {
  const value = req.header('authorization');
  if (!value?.toLowerCase().startsWith('bearer ')) return null;
  return value.slice(7).trim() || null;
}

export async function requireSupabaseAdminAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractBearer(req);
  if (!token) return res.status(401).json({ error: 'ADMIN_AUTH_REQUIRED' });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return res.status(503).json({ error: 'ADMIN_AUTH_NOT_CONFIGURED' });

  try {
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await db.auth.getUser(token);
    if (userError || !userData.user) return res.status(401).json({ error: 'ADMIN_AUTH_INVALID' });

    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single();

    if (profileError || profile?.role !== 'admin') return res.status(403).json({ error: 'ADMIN_ROLE_REQUIRED' });

    res.locals.adminUserId = userData.user.id;
    return next();
  } catch (error) {
    console.error('Admin guard error:', error);
    return res.status(503).json({ error: 'ADMIN_AUTH_UNAVAILABLE' });
  }
}

export function createLegacyAdminGuard() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!isProtectedAdminPath(req.path)) return next();
    return requireSupabaseAdminAuth(req, res, next);
  };
}
