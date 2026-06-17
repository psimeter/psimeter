import { defineConfig } from 'vite';

// PsyMeter public site build.
//
// Dependencies (three, @noble/ed25519) are bundled from npm — NOT loaded from a
// CDN at runtime — so the shipped bundle is pinned by package-lock and can be
// integrity-checked offline (retires the esm.sh supply-chain risk in spec §7.6).
//
// In dev, Vite proxies the API and the one-way WebSocket to the Node instrument
// (packages/server, default :8787). In production the Node server serves the
// built assets from ./dist directly, so the same /api paths resolve without a
// proxy. If you run the server on a non-default port, point the proxy at it.
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        ws: true,
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: true,
  },
});
