import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, onTestFinished } from 'vitest';
import { createIsolatedDatabase } from '../helpers/isolated-database.ts';
import { createApp } from '../../src/server/app.ts';
import { createDatabase } from '../../src/server/database.ts';
import { createPrismaPersistence } from '../../src/server/persistence.ts';
import { hashPassword } from '../../src/modules/access/infrastructure/password-hasher.ts';
import type { StockItemView } from '../../src/modules/social-stock/domain/stock-catalog.ts';
import { StockCatalogService } from '../../src/modules/social-stock/application/stock-catalog-service.ts';

const controlUrl = process.env.TEST_DATABASE_URL;
if (!controlUrl) throw new Error('Set TEST_DATABASE_URL to an isolated PostgreSQL database before running integration tests.');
let connectionString: string;
let closeDatabase: (() => Promise<void>) | undefined;
beforeAll(async () => {
  const isolated = await createIsolatedDatabase(controlUrl);
  connectionString = isolated.connectionString;
  closeDatabase = isolated.close;
}, 30_000);
afterAll(async () => { await closeDatabase?.(); });

async function setup() {
  const database = createDatabase(connectionString);
  const actorId = randomUUID();
  const now = new Date();
  const password = 'SyntheticStockPassword!123';
  await database.client.user.create({ data: { id: actorId, login: actorId, displayName: 'Synthetic Stock Operator',
    passwordHash: hashPassword(password), status: 'ACTIVE', version: 1, createdAt: now, updatedAt: now,
    profiles: { create: { profile: 'STOCK_DISTRIBUTION', assignedAt: now } } } });
  const persistence = createPrismaPersistence(database.client);
  const app = createApp({ checkDatabase: database.check, persistence });
  onTestFinished(async () => { await app.close(); await database.close(); });
  const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { loginIdentifier: actorId, password } });
  expect(login.statusCode).toBe(200);
  const headers = { authorization: `Bearer ${login.json<{ sessionToken: string }>().sessionToken}` };
  const create = (resource: string, payload: Record<string, unknown>, key = randomUUID()) => app.inject({
    method: 'POST', url: `/api/v1/${resource}`, headers: { ...headers, 'idempotency-key': key }, payload,
  });
  return { database, persistence, app, actorId, headers, create };
}

it('persists catalogs and item revisions and recovers them through a new application instance', async () => {
  const { database, app, headers, create } = await setup();
  const category = await create('stock-categories', { name: 'Synthetic clothing' });
  expect(category.statusCode).toBe(201);
  const unit = await create('stock-units', { name: 'Synthetic piece', precision: 0 });
  expect(unit.statusCode).toBe(201);
  const size = await create('stock-sizes', { name: 'Synthetic M' });
  expect(size.statusCode).toBe(201);
  const created = await create('stock-items', { name: 'Synthetic shirt', categoryId: category.json<{ id: string }>().id,
    unitId: unit.json<{ id: string }>().id, sizeId: size.json<{ id: string }>().id });
  expect(created.statusCode).toBe(201);
  const original = created.json<StockItemView>();
  const changed = await app.inject({ method: 'PATCH', url: `/api/v1/stock-items/${original.id}`,
    headers: { ...headers, 'idempotency-key': randomUUID() }, payload: { version: 1, sizeId: null, reason: 'Correct the synthetic size.' } });
  expect(changed.statusCode).toBe(200);
  const second = createApp({ checkDatabase: database.check, persistence: createPrismaPersistence(database.client) });
  onTestFinished(() => second.close());
  expect((await second.inject({ method: 'GET', url: `/api/v1/stock-items/${original.id}`, headers })).json()).toEqual(changed.json());
  expect((await second.inject({ method: 'GET', url: `/api/v1/stock-items/${original.id}/revisions/1`, headers })).json()).toEqual(original);
  expect((await second.inject({ method: 'GET', url: `/api/v1/stock-items/${original.id}/revisions/9007199254740991`, headers })).statusCode).toBe(404);
});

it('enforces unit precision and catalog integrity in PostgreSQL, even outside HTTP', async () => {
  const { database } = await setup();
  const now = new Date();
  for (const precision of [-1, 19]) {
    await expect(database.client.stockUnit.create({ data: { id: randomUUID(), name: 'Invalid precision', precision,
      isActive: true, version: 1, createdAt: now, updatedAt: now } })).rejects.toThrow();
  }
  await expect(database.client.stockCategory.create({ data: { id: randomUUID(), name: ' ',
    isActive: true, version: 1, createdAt: now, updatedAt: now } })).rejects.toThrow();
  await expect(database.client.stockSize.create({ data: { id: randomUUID(), name: 'Invalid version',
    isActive: true, version: 0, createdAt: now, updatedAt: now } })).rejects.toThrow();
});

it.each(['audit', 'confirmation'])('rolls back the item, revision, audit and confirmation after a %s failure and permits retry', async (stage) => {
  const { database, persistence, actorId, create } = await setup();
  const categoryId = (await create('stock-categories', { name: 'Rollback category' })).json<{ id: string }>().id;
  const unitId = (await create('stock-units', { name: 'Rollback unit', precision: 0 })).json<{ id: string }>().id;
  const input = { actorId, operationId: randomUUID(), name: `Rollback ${randomUUID()}`, categoryId, unitId };
  const service = new StockCatalogService({ repository: persistence.stockCatalogRepository, clock: () => new Date(),
    transactions: (work) => persistence.stockCatalogTransactions((context) => work({ ...context,
      ...(stage === 'audit' ? { auditTrail: { ...context.auditTrail,
        listByEntity: (entityType: string, entityId: string) => context.auditTrail.listByEntity(entityType, entityId),
        record: async () => { throw new Error('Simulated audit failure.'); } } }
        : { idempotency: { execute: async (request) => {
          await context.idempotency.execute(request);
          throw new Error('Simulated confirmation failure.');
        } } }),
    })),
  });
  await expect(service.createItem(input)).rejects.toThrow(`Simulated ${stage} failure.`);
  expect(await database.client.stockItemRevision.count({ where: { name: input.name } })).toBe(0);
  expect(await database.client.stockItem.count({ where: { revisions: { none: {} } } })).toBe(0);
  expect(await database.client.auditEntryRecord.count({ where: { operationId: input.operationId } })).toBe(0);
  expect(await database.client.operationConfirmation.count({ where: { operationId: input.operationId } })).toBe(0);
  const retried = await new StockCatalogService({ repository: persistence.stockCatalogRepository,
    transactions: persistence.stockCatalogTransactions, clock: () => new Date() }).createItem(input);
  expect(retried.statusCode).toBe(201);
  expect(await database.client.stockItemRevision.count({ where: { name: input.name } })).toBe(1);
});

it('commits one item for concurrent retries and rejects concurrent stale revisions without partial history', async () => {
  const { database, app, headers, create } = await setup();
  const categoryId = (await create('stock-categories', { name: 'Concurrent category' })).json<{ id: string }>().id;
  const unitId = (await create('stock-units', { name: 'Concurrent unit', precision: 3 })).json<{ id: string }>().id;
  const operationId = randomUUID();
  const payload = { name: `Concurrent ${randomUUID()}`, categoryId, unitId };
  const responses = await Promise.all(Array.from({ length: 4 }, () => create('stock-items', payload, operationId)));
  expect(responses.map((response) => response.statusCode)).toEqual([201, 201, 201, 201]);
  const original = responses[0]?.json<StockItemView>();
  if (!original) throw new Error('Expected a concurrent item result.');
  for (const response of responses) expect(response.json()).toEqual(original);
  expect(await database.client.auditEntryRecord.count({ where: { operationId } })).toBe(1);
  expect(await database.client.operationConfirmation.count({ where: { operationId } })).toBe(1);
  const conflict = await create('stock-items', { ...payload, name: 'Changed payload' }, operationId);
  expect(conflict.statusCode).toBe(409);
  const edits = await Promise.all(['First edit', 'Second edit'].map((name) => app.inject({
    method: 'PATCH', url: `/api/v1/stock-items/${original.id}`, headers: { ...headers, 'idempotency-key': randomUUID() },
    payload: { name, version: 1, reason: 'Concurrent synthetic correction.' },
  })));
  expect(edits.map((edit) => edit.statusCode).sort()).toEqual([200, 409]);
  expect(await database.client.stockItemRevision.count({ where: { itemId: original.id } })).toBe(2);
  expect(await database.client.auditEntryRecord.count({ where: { entityId: original.id } })).toBe(2);
  expect((await app.inject({ method: 'GET', url: `/api/v1/stock-items/${original.id}/revisions/1`, headers })).json()).toEqual(original);
  await expect(database.client.stockUnit.delete({ where: { id: unitId } })).rejects.toThrow();
});
