import { expect, it, onTestFinished } from 'vitest';
import { createApp } from '../../src/server/app.ts';
import { createDatabase } from '../../src/server/database.ts';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) {
  throw new Error('Set TEST_DATABASE_URL to an isolated PostgreSQL database before running integration tests.');
}

it('reports readiness through a real Prisma connection to PostgreSQL', async () => {
  const database = createDatabase(connectionString);
  const app = createApp({ checkDatabase: database.check });
  onTestFinished(async () => {
    await app.close();
    await database.close();
  });

  const response = await app.inject({ method: 'GET', url: '/api/v1/ready' });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ status: 'ok' });
});
