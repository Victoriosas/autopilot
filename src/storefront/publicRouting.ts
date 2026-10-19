import { articles, getPublishedArticle } from './editorial.js';

const active = new Set(['/', '/index.html', '/servicios', '/contacto', '/victoria', '/privacidad', '/de-mi-para-ti', '/admin', '/beauty-professional', '/servicios-sofia.html', '/robots.txt', '/sitemap.xml', '/favicon.svg']);
const retired = new Set(['/tienda', '/checkout', '/tratamientos']);

export function publicRouteResponse(request: Request, preview = false): Response | undefined {
  const path = new URL(request.url).pathname.replace(/\/$/, '') || '/';
  // API authorization and static asset serving remain with their existing handlers.
  if (path === '/api' || ['/api/', '/assets/', '/brand/', '/seo/', '/src/', '/node_modules/', '/@'].some(prefix => path.startsWith(prefix))) return;
  if (active.has(path)) return;
  if (path.startsWith('/de-mi-para-ti/')) {
    const slug = path.slice('/de-mi-para-ti/'.length);
    if (getPublishedArticle(slug) || (preview && articles.some(article => article.slug === slug))) return;
  }
  const status = retired.has(path) ? 410 : 404;
  const title = status === 410 ? 'Esta página ya no está disponible.' : 'No encontramos esta página.';
  const html = `<!doctype html><html lang="es-UY"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#87672d"><title>${status} · Victoriosas</title><link rel="icon" href="/favicon.svg"><style>
  *{box-sizing:border-box}body{margin:0;background:#fcf9f3;color:#373128;font:17px/1.7 system-ui,sans-serif}main{max-width:760px;margin:auto;padding:clamp(40px,12vw,120px) 24px}.brand{font:26px Georgia,serif;letter-spacing:.08em;color:#87672d}h1{font:normal clamp(36px,6vw,54px)/1.15 Georgia,serif}nav{display:flex;gap:16px;flex-wrap:wrap;margin-top:32px}a{color:#715221;min-height:48px;display:inline-flex;align-items:center;padding:10px 20px;border:1px solid #87672d;border-radius:40px;text-decoration:none}a:focus-visible{outline:3px solid #87672d;outline-offset:4px}.code{color:#6e6558;font-size:13px}
  </style></head><body><main><p class="brand">VICTORIOSAS</p><p class="code">Estética profesional · ${status}</p><h1>${title}</h1><p>Podés volver al inicio y conocer cómo comienza la atención, con una evaluación inicial remota.</p><nav aria-label="Continuar"><a href="/">Volver al inicio</a><a href="/#contacto">Consultar por WhatsApp</a></nav></main></body></html>`;
  return new Response(request.method === 'HEAD' ? null : html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
