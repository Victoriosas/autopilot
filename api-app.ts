import express from 'express';
import { createConsultationRouter } from './src/storefront/consultationRouter';
import { mountAutopilotV4 } from './src/autopilot/mount';
import { mercadoPagoAvailability } from './src/payments/mercadoPago';

export const app = express();
app.disable('x-powered-by');
app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
app.use('/api/beauty/inquiries', createConsultationRouter());
app.use(express.json({ limit: '10mb' }));
mountAutopilotV4(app);

app.get('/api/health', async (_req, res) => {
  const checkout = await mercadoPagoAvailability();
  res.json({
    status: 'ok',
    service: 'Victoriosas Autopilot API',
    runtime: process.env.AUTOPILOT_RUNTIME || 'vercel',
    commit: process.env.AUTOPILOT_BUILD_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || null,
    checkoutEnabled: checkout.available,
    checkoutRequested: checkout.requested,
    checkoutUnavailableReason: checkout.reason,
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'API_ROUTE_NOT_FOUND' }));

