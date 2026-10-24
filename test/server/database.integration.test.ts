import { expect, it, onTestFinished } from 'vitest';
import { PrismaAccessRepository } from '../../src/modules/access/infrastructure/prisma-access-repository.ts';
import { PrismaProjectsRepository } from '../../src/modules/activities/infrastructure/prisma-projects-repository.ts';
import {
  PrismaAuditTrail,
  PrismaIdempotencyStore,
} from '../../src/modules/shared/prisma-audit-and-idempotency.ts';
import { createApp } from '../../src/server/app.ts';
import { createDatabase } from '../../src/server/database.ts';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) {
  throw new Error('Set TEST_DATABASE_URL to an isolated PostgreSQL database before running integration tests.');
}

it('reports readiness and executes access and project flows through a real Prisma connection to PostgreSQL', async () => {
  const database = createDatabase(connectionString);
  const app = createApp({
    checkDatabase: database.check,
    accessRepository: new PrismaAccessRepository(database.client),
    projectsRepository: new PrismaProjectsRepository(database.client),
    auditTrail: new PrismaAuditTrail(database.client),
    idempotencyStore: new PrismaIdempotencyStore(database.client),
  });
  onTestFinished(async () => {
    await app.close();
    await database.close();
  });

  const response = await app.inject({ method: 'GET', url: '/api/v1/ready' });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ status: 'ok' });
});
