import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { routeHtml } from './src/storefront/routeMetadata';

export default defineConfig(({command}) => {
  return {
    define: { __EDITORIAL_REVIEW__: JSON.stringify(command === 'serve' || process.env.VERCEL_ENV === 'preview') },
    plugins: [react(), tailwindcss(), {
      name: 'public-route-html',
      enforce: 'post',
      generateBundle(_options, bundle) {
        const index = bundle['index.html'];
        if (!index || index.type !== 'asset') throw new Error('Missing built index.html');
        const html = String(index.source);
        const preview = process.env.VERCEL_ENV === 'preview';
        index.source = routeHtml(html, 'home', preview);
        this.emitFile({ type: 'asset', fileName: 'seo/editorial.html', source: routeHtml(html, 'editorial', preview) });
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
