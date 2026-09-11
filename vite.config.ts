import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    // The Supabase credentials are provided to the project as NEXT_PUBLIC_*
    // variables (in process.env and .env files), not with Vite's default VITE_
    // prefix. Whitelist the NEXT_PUBLIC_ prefix so Vite exposes those public
    // values on import.meta.env. Only VITE_ and NEXT_PUBLIC_ prefixes are
    // exposed, so server-only secrets like SUPABASE_SERVICE_ROLE_KEY and
    // SUPABASE_SECRET_KEY are never shipped to the browser.
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    plugins: [react(), tailwindcss()],
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
