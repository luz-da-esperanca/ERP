import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['apps/api/test/**/*.integration.test.ts'],
    globalSetup: './apps/api/test/support/global-setup.ts',
    environment: 'node',
    restoreMocks: true,
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
