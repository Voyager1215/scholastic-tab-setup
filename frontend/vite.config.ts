import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const workerPort = process.env.WORKER_PORT ?? '8787';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // In development the Worker runs separately (wrangler dev on 8787) and
    // Vite proxies the API and media routes to it.
    proxy: {
      '/api': `http://localhost:${workerPort}`,
      '/media': `http://localhost:${workerPort}`,
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
