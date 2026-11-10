import { defineConfig } from 'vitest/config';

// APP project: jsdom tests under app/ only.
// The workspace entry './app' makes app/ this project's root, so globs are
// relative to app/ (equivalent to `app/**` from the repo root).
export default defineConfig({
  test: {
    name: 'app',
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**'],
    environment: 'jsdom',
    setupFiles: ['test/setup.ts'],
  },
});
