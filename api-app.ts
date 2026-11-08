import { createApp, mountApiNotFound } from './src/http/createApp';

export const app = createApp({
  configure(app) {
    app.disable('x-powered-by');
    app.use('/api', (_req, res, next) => {
      res.setHeader('Cache-Control', 'no-store');
      next();
    });
  },
  healthMetadata: () => ({
    service: 'Victoriosas Autopilot API',
    runtime: process.env.AUTOPILOT_RUNTIME || 'vercel',
    commit: process.env.AUTOPILOT_BUILD_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || null,
  }),
});

mountApiNotFound(app);
