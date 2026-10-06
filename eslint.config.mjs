import js from '@eslint/js';
import ts from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
export default ts.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/generated/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': hooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['src/**/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            ...[
              'registration-api',
              'data-quality-api',
              'audit-api',
              'projects-api',
              'attendance-api',
              'membership-reconciliation-api',
              'social-forms-api',
              'eligibility-api',
              'identity-merge-api',
              'reports-api',
            ].map((contract) => ({
              name: `@erp/contracts/${contract}`,
              message: 'Keep HTTP DTOs outside the domain.',
            })),
            {
              name: '@erp/contracts/access-api',
              message: 'Keep HTTP DTOs outside the domain.',
            },
            {
              name: '@erp/contracts/account-audit-api',
              message: 'Keep HTTP DTOs outside the domain.',
            },
          ],
          patterns: [
            {
              group: [
                '**/application/**',
                '**/presentation/**',
                '**/infra/**',
                '**/generated/**',
              ],
              message:
                'Domain dependencies must point to domain rules and types.',
            },
            {
              group: [
                'fastify',
                '@fastify/*',
                '@prisma/*',
                'zod',
                'bcrypt',
                'jose',
                'redis',
                'node:*',
              ],
              message:
                'Keep frameworks and external effects outside the domain.',
            },
            {
              group: ['@erp/contracts/*'],
              allowTypeImports: true,
              message: 'Only shared domain types belong in the domain.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            ...[
              'registration-api',
              'data-quality-api',
              'audit-api',
              'projects-api',
              'attendance-api',
              'membership-reconciliation-api',
              'social-forms-api',
              'eligibility-api',
              'identity-merge-api',
              'reports-api',
            ].map((contract) => ({
              name: `@erp/contracts/${contract}`,
              message: 'Map HTTP DTOs to application inputs in presentation.',
            })),
            {
              name: '@erp/contracts/access-api',
              message: 'Map HTTP DTOs to application inputs in presentation.',
            },
            {
              name: '@erp/contracts/account-audit-api',
              message: 'Map HTTP DTOs to application inputs in presentation.',
            },
          ],
          patterns: [
            {
              group: ['**/presentation/**', '**/infra/**', '**/generated/**'],
              message:
                'Application cases depend on domain and application contracts.',
            },
            {
              group: [
                'fastify',
                '@fastify/*',
                '@prisma/*',
                'zod',
                'bcrypt',
                'jose',
                'redis',
                'node:*',
              ],
              message: 'Inject external effects through application ports.',
            },
            {
              group: ['@erp/contracts/*'],
              allowTypeImports: true,
              message: 'Validate transport contracts in presentation.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/presentation/**/*.ts', 'src/app.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/infra/**',
                '**/generated/**',
                '@prisma/*',
                'bcrypt',
                'jose',
                'redis',
              ],
              message:
                'Presentation invokes application cases; composition injects infrastructure.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/infra/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/presentation/**'],
              message:
                'Infrastructure implements application ports without HTTP dependencies.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}', 'packages/contracts/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@erp/api',
                '@erp/api/**',
                '@prisma/*',
                '**/generated/**',
                '**/prisma/**',
                '**/src/features/**',
                '**/src/core/**',
              ],
              message:
                'Use public contracts instead of importing backend internals or persistence.',
            },
          ],
        },
      ],
    },
  },
);
