import { resolve } from 'node:path';
import { PrismaAccessRepository } from '../modules/access/infrastructure/prisma-access-repository.ts';
import { PrismaProjectsRepository } from '../modules/activities/infrastructure/prisma-projects-repository.ts';
import {
  PrismaAuditTrail,
  PrismaIdempotencyStore,
} from '../modules/shared/prisma-audit-and-idempotency.ts';
import { createApp } from './app.ts';
import { readConfig } from './config.ts';
import { createDatabase } from './database.ts';

const config = readConfig(process.env);
const database = createDatabase(config.databaseUrl);
const app = createApp({
  checkDatabase: database.check,
  accessRepository: new PrismaAccessRepository(database.client),
  projectsRepository: new PrismaProjectsRepository(database.client),
  auditTrail: new PrismaAuditTrail(database.client),
  idempotencyStore: new PrismaIdempotencyStore(database.client),
  logger: true,
  ...(process.argv.includes('--serve-client')
    ? { clientDirectory: resolve(import.meta.dirname, '../client') }
    : {}),
});

app.addHook('onClose', () => database.close());

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.close().catch(() => { process.exitCode = 1; });
  });
}

try {
  await app.listen({ host: config.host, port: config.port });
} catch {
  app.log.fatal('Server startup failed. Check HOST, PORT, and local service availability.');
  await app.close();
  process.exitCode = 1;
}
