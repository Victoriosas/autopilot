import express from 'express';
import { mountAutopilotV4 } from '../src/autopilot/mount';

const app = express();
app.use(express.json({ limit: '10mb' }));
mountAutopilotV4(app);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Victoriosa Vercel API',
    runtime: 'vercel',
    timestamp: new Date().toISOString(),
  });
});

export default function handler(req: any, res: any) {
  const rawPath = req.query?.path;
  const path = Array.isArray(rawPath) ? rawPath.join('/') : String(rawPath || '');
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === 'path' || value === undefined) continue;
    if (Array.isArray(value)) value.forEach((entry) => query.append(key, String(entry)));
    else query.append(key, String(value));
  }

  req.url = `/api/${path}${query.size ? `?${query.toString()}` : ''}`;
  return app(req, res);
}
