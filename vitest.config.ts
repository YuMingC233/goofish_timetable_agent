import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

// Force UTC so time-sensitive tests are deterministic.
// The scheduler uses local-time setters (setHours, not setUTCHours),
// and UTC-as-local gives the simplest reproducible base.
process.env.TZ = 'UTC';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.ts'],
  },
});
