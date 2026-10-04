import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['apps/*/test/**/*.test.{ts,tsx}', 'packages/*/test/**/*.test.ts'],
    exclude: ['**/*.integration.test.ts', '**/node_modules/**'],
    environment: 'node',
    restoreMocks: true,
  },
});
