import type { Express } from 'express';
import { createAutopilotV4Router } from './api';

/**
 * Mounts the governed Autopilot v4 control plane.
 *
 * Keep this as the only integration point from the legacy monolithic server.
 * The router itself is fail-closed and requires server-only governance tokens.
 */
export function mountAutopilotV4(app: Express): void {
  app.use('/api/autopilot/v4', createAutopilotV4Router());
}
