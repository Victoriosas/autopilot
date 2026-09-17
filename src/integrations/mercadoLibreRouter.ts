import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { requireSupabaseAdminAuth } from '../security/adminAuth';
import {
  exchangeMercadoLibreAuthorizationCode,
  mercadoLibreAuthorizationUrl,
  mercadoLibreConnectionStatus,
} from './mercadoLibre';

function readCookie(header: string | undefined, name: string): string {
  if (!header) return '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}

function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a), bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export function createMercadoLibreRouter(): Router {
  const router = Router();

  router.get('/status', requireSupabaseAdminAuth, async (_req, res) => {
    try { return res.json(await mercadoLibreConnectionStatus()); }
    catch { return res.status(503).json({ error: 'MERCADOLIBRE_STATUS_UNAVAILABLE' }); }
  });

  router.get('/authorize', requireSupabaseAdminAuth, async (_req, res) => {
    try {
      const state = randomBytes(24).toString('hex');
      res.cookie('victoriosa_ml_oauth_state', state, {
        httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 10 * 60 * 1000, path: '/api/integrations/mercadolibre',
      });
      return res.json({ authorizationUrl: mercadoLibreAuthorizationUrl(state) });
    } catch (error: any) {
      const code = String(error?.message || 'MERCADOLIBRE_AUTHORIZE_FAILED');
      return res.status(code === 'MERCADOLIBRE_OAUTH_NOT_CONFIGURED' ? 503 : 500).json({ error: code });
    }
  });
  router.get('/callback', async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
    const state = typeof req.query.state === 'string' ? req.query.state.trim() : '';
    const expected = readCookie(req.headers.cookie, 'victoriosa_ml_oauth_state');
    if (!code || !state || !expected || !safeEqual(state, expected)) {
      return res.status(400).send('Mercado Libre OAuth: state o code inválido.');
    }
    try {
      await exchangeMercadoLibreAuthorizationCode(code);
      res.clearCookie('victoriosa_ml_oauth_state', { path: '/api/integrations/mercadolibre' });
      return res.redirect('/?mercadolibre=connected');
    } catch {
      return res.status(502).send('Mercado Libre OAuth: no se pudo completar la conexión.');
    }
  });

  return router;
}
