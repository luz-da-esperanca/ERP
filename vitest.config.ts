import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        extends: false,
        test: {
          name: 'server',
          include: ['test/**/*.test.ts'],
          exclude: ['test/**/*.integration.test.ts', 'test/client/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: false,
        test: {
          name: 'client',
          include: ['test/client/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
        },
      },
    ],
  },
});
