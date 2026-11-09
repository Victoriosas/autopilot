import express, { type Express } from 'express';
import { mountAutopilotV4 } from '../autopilot/mount';
import { mercadoPagoAvailability } from '../payments/mercadoPago';
import { createConsultationRouter } from '../storefront/consultationRouter';

type AppOptions = {
  configure?: (app: Express) => void;
  healthMetadata: () => {
    service: string;
    runtime?: string;
    commit?: string | null;
    aiProviders?: unknown;
  };
};

export function createApp({ configure, healthMetadata }: AppOptions): Express {
  const app = express();
  configure?.(app);

  // Consultations check availability and origin before parsing their own body.
  app.use('/api/beauty/inquiries', createConsultationRouter());
  app.use(express.json({ limit: '10mb' }));
  mountAutopilotV4(app);

  app.get('/api/health', async (_req, res) => {
    const checkout = await mercadoPagoAvailability();
    res.json({
      status: 'ok',
      ...healthMetadata(),
      checkoutEnabled: checkout.available,
      checkoutRequested: checkout.requested,
      checkoutUnavailableReason: checkout.reason,
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}

export function mountApiNotFound(app: Express): void {
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API_ROUTE_NOT_FOUND' }));
}
