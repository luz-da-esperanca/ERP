import { expect, it, vi } from 'vitest';
import { Prisma } from '../../../../src/generated/prisma/client.js';
import type { Database } from '../../../../src/core/infra/database.js';
import { PrismaRegistration } from '../../../../src/features/registration/infra/prisma-registration.js';

it.each([['cpf'], 'Person_cpf_canonical_key'])(
  'returns a CPF conflict when the database rejects a concurrent registration (%j)',
  async (target) => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: 'test',
        meta: { modelName: 'Person', target },
      },
    );
    const database = {
      $transaction: vi.fn().mockRejectedValue(error),
    } as unknown as Database;
    await expect(
      new PrismaRegistration(database).run('actor', [], async () => null),
    ).rejects.toMatchObject({ rule: 'CPF_ALREADY_REGISTERED' });
  },
);
