import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Bound to 0.0.0.0 so the Arena live-preview proxy can reach the dev server.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // The preview is served over HTTPS through a proxy — point HMR's websocket at it.
    hmr: { protocol: 'wss', clientPort: 443 },
  },
  preview: { host: '0.0.0.0', port: 5173 },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
});
