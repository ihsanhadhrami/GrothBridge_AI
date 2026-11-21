import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds src/entry-server.tsx for Node so scripts/prerender.mjs can call
// renderToString for every route. Not deployed.
export default defineConfig({
  plugins: [react()],
  build: {
    ssr: 'src/entry-server.tsx',
    outDir: 'dist-ssr',
    emptyOutDir: true,
    copyPublicDir: false,
  },
});
