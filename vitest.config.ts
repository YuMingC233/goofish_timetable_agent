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
  define: {
    // Same shape as vite.config.ts but with empty-string defaults (no .env in tests)
    __ENV_OPENAI_API_KEY__: JSON.stringify(''),
    __ENV_OPENAI_BASE_URL__: JSON.stringify(''),
    __ENV_NOTION_TOKEN__: JSON.stringify(''),
    __ENV_NOTION_DATABASE_ID__: JSON.stringify(''),
    __ENV_AI_MODEL__: JSON.stringify(''),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.ts'],
  },
});
