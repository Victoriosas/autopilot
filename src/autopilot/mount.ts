import type { Express } from 'express';
import { createLegacyAdminGuard } from '../security/adminAuth';
import { createAutopilotV4Router } from './api';

export function mountAutopilotV4(app: Express): void {
  app.use('/api/autopilot/v4', createAutopilotV4Router());
  app.use(createLegacyAdminGuard());
}
