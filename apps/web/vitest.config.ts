import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// Component tests run in jsdom against the real components, i18n resources and form schema.
// Only the network edge (the API client) is replaced per test.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
  },
});
