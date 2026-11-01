import { app } from './api-app';

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
