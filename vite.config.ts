import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';
import { createApiRouter } from './server/api';

export default defineConfig(({ mode }) => {
  // Vite-only startup (including AI Studio preview) must serve the same API.
  // Read secrets only on the Node side; never put them into Vite's define object.
  const env = loadEnv(mode, process.cwd(), '');
  for (const key of ['GEMINI_API_KEY', 'GEMINI_MODEL']) {
    if (!process.env[key] && env[key]) process.env[key] = env[key];
  }
  const apiPlugin: Plugin = {
    name: 'anima-server-api',
    configureServer(server) { server.middlewares.use('/api', createApiRouter()); },
    configurePreviewServer(server) { server.middlewares.use('/api', createApiRouter()); },
  };
  return {
    base: './',
    define: { 'import.meta.env.VITE_STATIC_MODE': JSON.stringify(mode === 'pages' ? 'true' : 'false') },
    plugins: [react(), tailwindcss(), ...(mode === 'pages' ? [] : [apiPlugin])],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
