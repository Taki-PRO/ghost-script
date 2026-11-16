import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 4173;

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 375, height: 812 },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `npm run build -w app && npm run preview -w app -- --host 127.0.0.1 --port ${PORT} --strictPort --base /ghost-script/`,
    cwd: ROOT,
    url: `http://127.0.0.1:${PORT}/ghost-script/`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
