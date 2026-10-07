import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';

const lint = new ESLint();

describe('Architecture dependency rules', () => {
  it.each(['domain', 'application'])(
    'allows the shared pure CPF value object in %s while rejecting its Zod schema',
    async (layer) => {
      const filePath = `src/features/registration/${layer}/cpf-example.ts`;
      const [valueObject] = await lint.lintText(
        "export { Cpf } from '@erp/contracts/cpf';",
        { filePath },
      );
      expect(
        valueObject?.messages.filter(
          (message) => message.ruleId === 'no-restricted-imports',
        ),
      ).toHaveLength(0);
      const [schema] = await lint.lintText(
        "export { cpfSchema } from '@erp/contracts/cpf-schema';",
        { filePath },
      );
      expect(
        schema?.messages.filter(
          (message) => message.ruleId === 'no-restricted-imports',
        ),
      ).toHaveLength(1);
    },
  );
  it.each(['domain', 'application'])(
    'rejects HTTP transport types in %s',
    async (layer) => {
      for (const contract of [
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
      ]) {
        const [result] = await lint.lintText(
          `export type * from '@erp/contracts/${contract}';`,
          { filePath: `src/features/registration/${layer}/example.ts` },
        );
        expect(
          result?.messages.some(
            (message) => message.ruleId === 'no-restricted-imports',
          ),
        ).toBe(true);
      }
    },
  );
  it.each([
    {
      name: 'domain importing an HTTP framework',
      file: 'src/features/access/domain/example.ts',
      source: "export { default as framework } from 'fastify';",
    },
    {
      name: 'domain importing an application case',
      file: 'src/features/access/domain/example.ts',
      source:
        "export { AccessService } from '../application/access-service.js';",
    },
    {
      name: 'domain importing public HTTP DTO types',
      file: 'src/features/access/domain/example.ts',
      source: "export type { UserDto } from '@erp/contracts/access-api';",
    },
    {
      name: 'application importing a Prisma adapter',
      file: 'src/features/access/application/example.ts',
      source: "export { PrismaAccounts } from '../infra/prisma-accounts.js';",
    },
    {
      name: 'application importing generated persistence types',
      file: 'src/features/access/application/example.ts',
      source:
        "export type { Prisma } from '../../../generated/prisma/client.js';",
    },
    {
      name: 'application importing HTTP DTO types',
      file: 'src/features/access/application/example.ts',
      source: "export type { UserDto } from '@erp/contracts/access-api';",
    },
    {
      name: 'presentation importing persistence directly',
      file: 'src/features/access/presentation/example.ts',
      source: "export { PrismaAccounts } from '../infra/prisma-accounts.js';",
    },
    {
      name: 'infra importing HTTP routes',
      file: 'src/features/access/infra/example.ts',
      source:
        "export { registerAccessRoutes } from '../presentation/access-routes.js';",
    },
    {
      name: 'web importing Prisma',
      file: 'apps/web/src/app/example.ts',
      source: "export { PrismaClient } from '@prisma/client';",
    },
    {
      name: 'shared contracts importing backend implementation',
      file: 'packages/contracts/src/example.ts',
      source:
        "export { AccessService } from '../../../src/features/access/application/access-service.js';",
    },
  ])('rejects $name', async ({ file, source }) => {
    const [result] = await lint.lintText(source, { filePath: file });
    expect(
      result?.messages.some(
        (message) => message.ruleId === 'no-restricted-imports',
      ),
    ).toBe(true);
  });

  it('allows domain dependencies and shared domain types inside application cases', async () => {
    const [result] = await lint.lintText(
      "export { assertRevision } from '../domain/account-rules.js'; export type { Role } from '@erp/contracts/access';",
      { filePath: 'src/features/access/application/example.ts' },
    );
    expect(result?.messages).toEqual([]);
  });
});
