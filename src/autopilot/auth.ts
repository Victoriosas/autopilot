import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export type AutopilotPrincipalRole = 'admin' | 'codex';

export interface AutopilotPrincipal {
  role: AutopilotPrincipalRole;
  authenticatedAt: string;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function extractToken(req: Request): string | null {
  const authorization = req.header('authorization');
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim() || null;
  }

  const headerToken = req.header('x-autopilot-key');
  return headerToken?.trim() || null;
}

export function controlPlaneAuthStatus() {
  return {
    configured: Boolean(process.env.AUTOPILOT_ADMIN_TOKEN?.trim()),
    codexConfigured: Boolean(process.env.AUTOPILOT_CODEX_TOKEN?.trim()),
    mode: 'bearer-or-x-autopilot-key',
    failClosed: true,
  } as const;
}

export function requireControlPlaneAuth(req: Request, res: Response, next: NextFunction) {
  const adminToken = process.env.AUTOPILOT_ADMIN_TOKEN?.trim();
  const codexToken = process.env.AUTOPILOT_CODEX_TOKEN?.trim();

  if (!adminToken) {
    return res.status(503).json({
      error: 'AUTOPILOT_CONTROL_PLANE_NOT_CONFIGURED',
      message: 'AUTOPILOT_ADMIN_TOKEN must be configured before the control plane can be used.',
    });
  }

  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'AUTOPILOT_AUTH_REQUIRED' });
  }

  let role: AutopilotPrincipalRole | null = null;
  if (safeEqual(token, adminToken)) role = 'admin';
  if (!role && codexToken && safeEqual(token, codexToken)) role = 'codex';

  if (!role) {
    return res.status(403).json({ error: 'AUTOPILOT_AUTH_INVALID' });
  }

  res.locals.autopilotPrincipal = {
    role,
    authenticatedAt: new Date().toISOString(),
  } satisfies AutopilotPrincipal;

  next();
}

export function getAutopilotPrincipal(res: Response): AutopilotPrincipal {
  const principal = res.locals.autopilotPrincipal as AutopilotPrincipal | undefined;
  if (!principal) throw new Error('Autopilot principal is unavailable');
  return principal;
}
