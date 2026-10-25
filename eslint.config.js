import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['node_modules/**', 'dist/**', 'coverage/**', 'src/server/generated/**', '.agents/**'] },
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: { '@typescript-eslint/consistent-type-imports': 'error' },
  },
  {
    files: ['src/modules/*/application/**/*.ts', 'src/modules/*/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/infrastructure/**', '**/http/**', '**/server/**', 'react', 'react-dom', 'react-dom/*', 'fastify', '@fastify/*', '@prisma/*', 'redis', 'ioredis'],
          message: 'Define dependencies inward and inject infrastructure from the composition boundary.',
        }],
      }],
    },
  },
  {
    files: ['src/client/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
);
