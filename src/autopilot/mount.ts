import type { Express } from 'express';
import { createMercadoPagoRouter } from '../payments/mercadoPago';
import { createPaymentV2Router } from '../payments/paypalV2';
import { createLegacyAdminGuard } from '../security/adminAuth';
import { createLegacySafetyGate } from '../security/legacySafety';
import { createAutopilotV4Router } from './api';
import { createCatalogGovernanceRouter } from './catalogGovernanceRouter';
import { createDraftRouter } from './draftRouter';
import { createOpportunityRouter } from './opportunityRouter';
import { createPricingRouter } from './pricingRouter';
import { createCJSourcingRouter } from './cjSourcingRouter';
import { createCJMcpRouter } from './cjMcpRouter';
import { createSourcingRouter } from './sourcingRouter';

export function mountAutopilotV4(app: Express): void {
  app.use('/api/autopilot/v4', createSourcingRouter());
  app.use('/api/autopilot/v4', createAutopilotV4Router());
  app.use('/api/autopilot/v4/pricing', createPricingRouter());
  app.use('/api/autopilot/v4/opportunities', createOpportunityRouter());
  app.use('/api/autopilot/v4/drafts', createDraftRouter());
  app.use('/api/autopilot/v4/catalog', createCatalogGovernanceRouter());
  app.use('/api/autopilot/v4/sourcing/cj', createCJSourcingRouter());
  app.use('/api/autopilot/v4/cj-mcp', createCJMcpRouter());
  app.use('/api/payments/v2', createPaymentV2Router());
  app.use('/api/payments/mercadopago', createMercadoPagoRouter());
  app.use(createLegacySafetyGate());
  app.use(createLegacyAdminGuard());
}
