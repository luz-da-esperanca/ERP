import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.ts';

const DATABASE_CONNECTION_TIMEOUT_MS = 5_000;

export function createDatabase(connectionString: string) {
  const adapter = new PrismaPg({ connectionString, connectionTimeoutMillis: DATABASE_CONNECTION_TIMEOUT_MS });
  const client = new PrismaClient({ adapter });
  return {
    client,
    async check() { await client.$queryRaw`SELECT 1`; },
    close: () => client.$disconnect(),
  };
}
