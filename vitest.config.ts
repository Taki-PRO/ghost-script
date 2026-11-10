import { defineConfig } from 'vitest/config';

// NODE project: character-dataset tests only.
export default defineConfig({
  test: {
    name: 'node',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
