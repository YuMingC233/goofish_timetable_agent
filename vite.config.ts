import { defineConfig, loadEnv } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import manifest from './manifest.json';

export default defineConfig(({ mode }) => {
  // Load ALL env vars (empty prefix = no VITE_ restriction) so the
  // existing NOTION_TOKEN / OPENAI_API_KEY etc. in .env are available.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [crx({ manifest })],
    define: {
      __ENV_OPENAI_API_KEY__: JSON.stringify(env.OPENAI_API_KEY || ''),
      __ENV_OPENAI_BASE_URL__: JSON.stringify(env.OPENAI_BASE_URL || ''),
      __ENV_NOTION_TOKEN__: JSON.stringify(env.NOTION_TOKEN || ''),
      __ENV_NOTION_DATABASE_ID__: JSON.stringify(env.NOTION_DATABASE_ID || ''),
      __ENV_AI_MODEL__: JSON.stringify(env.AI_MODEL || ''),
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'src/popup/index.html'),
        },
      },
    },
  };
});
