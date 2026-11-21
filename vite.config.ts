import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

// Client build + Worker build. Prerendering runs afterwards
// (vite.prerender.config.ts + scripts/prerender.mjs).
export default defineConfig({
  plugins: [react(), cloudflare()],
});
