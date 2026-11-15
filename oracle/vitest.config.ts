import { defineConfig } from 'vitest/config';
// ORACLE project: MCP server tests. Root is oracle/ (workspace entry './oracle').
export default defineConfig({
  test: {
    name: 'oracle',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
});
