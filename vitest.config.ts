import { defineConfig } from 'vitest/config';

// Unit tests run in Node (fetch, Request, Response and Web Crypto are built in).
// Kept apart from vite.config.ts so the Cloudflare plugin isn't loaded.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
