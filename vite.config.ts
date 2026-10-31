import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { routeHtml } from './src/storefront/routeMetadata';
import { publicRouteResponse } from './src/storefront/publicRouting';

export default defineConfig(({command}) => {
  return {
    define: { __SERVICE_REVIEW__: JSON.stringify(command === 'serve' || process.env.VERCEL_ENV === 'preview'), __EDITORIAL_REVIEW__: JSON.stringify(command === 'serve' || process.env.VERCEL_ENV === 'preview') },
    plugins: [react(), tailwindcss(), {
      name: 'public-route-html',
      enforce: 'post',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const response = publicRouteResponse(new Request('http://localhost' + req.url, { method: req.method === 'HEAD' ? 'HEAD' : 'GET' }), true);
          if (!response) return next();
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(await response.text());
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const response = publicRouteResponse(new Request('http://localhost' + req.url, { method: req.method === 'HEAD' ? 'HEAD' : 'GET' }), process.env.VERCEL_ENV === 'preview');
          if (!response) return next();
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(await response.text());
        });
      },
      generateBundle(_options, bundle) {
        const index = bundle['index.html'];
        if (!index || index.type !== 'asset') throw new Error('Missing built index.html');
        const html = String(index.source);
        const preview = process.env.VERCEL_ENV === 'preview';
        index.source = routeHtml(html, 'home', preview);
        this.emitFile({ type: 'asset', fileName: 'seo/victoria.html', source: routeHtml(html, 'victoria', preview) });
        this.emitFile({ type: 'asset', fileName: 'seo/starting.html', source: routeHtml(html, 'starting', preview) });
        this.emitFile({ type: 'asset', fileName: 'seo/editorial.html', source: routeHtml(html, 'editorial', preview) });
        this.emitFile({ type: 'asset', fileName: 'seo/privacy.html', source: routeHtml(html, 'privacy', preview) });
        this.emitFile({ type: 'asset', fileName: 'seo/services.html', source: routeHtml(html, 'services', preview) });
        this.emitFile({ type: 'asset', fileName: 'seo/technology.html', source: routeHtml(html, 'technology', preview) });
        this.emitFile({ type: 'asset', fileName: 'seo/consultation.html', source: routeHtml(html, 'consultation', preview) });
        this.emitFile({ type: 'asset', fileName: 'seo/fallback.html', source: routeHtml(html, 'fallback', preview) });
      },
    }],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
