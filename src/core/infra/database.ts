import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../../generated/prisma/client.js';
import { DependencyUnavailableError } from '../application/errors.js';
import { z } from 'zod';

export function createDatabase(url: string) {
  const schema = new URL(url).searchParams.get('schema') ?? 'public';
  return new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: url, max: 10, connectionTimeoutMillis: 5000 },
      { schema },
    ),
  });
}
export type Database = ReturnType<typeof createDatabase>;
export type Transaction = Prisma.TransactionClient;

function translateDatabaseError(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P1001', 'P1002', 'P1017', 'P2024'].includes(error.code))
  )
    return new DependencyUnavailableError();
  return error;
}

export async function databaseOperation<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw translateDatabaseError(error);
  }
}
const rawTransactionConflictSchema = z.object({
  driverAdapterError: z.object({
    cause: z.object({ originalCode: z.enum(['40001', '40P01']) }),
  }),
});
export async function serializable<T>(
  database: Database,
  work: (tx: Transaction) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await database.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000,
        maxWait: 5000,
      });
    } catch (error) {
      // PrismaPg wraps conflicts from raw row locks in P2010 instead of P2034.
      const transactionConflict =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2034' ||
          (error.code === 'P2010' &&
            rawTransactionConflictSchema.safeParse(error.meta).success));
      if (transactionConflict) {
        if (attempt < 2) continue;
        throw new DependencyUnavailableError();
      }
      throw translateDatabaseError(error);
    }
  }
  throw new DependencyUnavailableError();
}
