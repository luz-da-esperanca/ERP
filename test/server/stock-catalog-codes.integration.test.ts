import { randomUUID } from 'node:crypto';
import { expect, it, onTestFinished } from 'vitest';
import { createIsolatedDatabase } from '../helpers/isolated-database.ts';
import { createDatabase } from '../../src/server/database.ts';
import { createPrismaPersistence } from '../../src/server/persistence.ts';
import { createApp } from '../../src/server/app.ts';
import { hashPassword } from '../../src/modules/access/infrastructure/password-hasher.ts';
import type { StockItemView } from '../../src/modules/social-stock/domain/stock-catalog.ts';
import { StockCatalogService } from '../../src/modules/social-stock/application/stock-catalog-service.ts';

const configuredControlUrl = process.env.TEST_DATABASE_URL;
if (!configuredControlUrl) throw new Error('Set TEST_DATABASE_URL to an isolated PostgreSQL database before running integration tests.');
const controlUrl: string = configuredControlUrl;

async function setup() {
  const isolated = await createIsolatedDatabase(controlUrl);
  const database = createDatabase(isolated.connectionString);
  const persistence = createPrismaPersistence(database.client);
  const app = createApp({ checkDatabase: database.check, persistence });
  onTestFinished(async () => { await app.close(); await database.close(); await isolated.close(); });
  const actorId = randomUUID();
  const now = new Date();
  const password = 'SyntheticCodePassword!123';
  await database.client.user.create({ data: { id: actorId, login: actorId, displayName: 'Synthetic Stock Operator',
    passwordHash: hashPassword(password), status: 'ACTIVE', version: 1, createdAt: now, updatedAt: now,
    profiles: { create: { profile: 'STOCK_DISTRIBUTION', assignedAt: now } } } });
  const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { loginIdentifier: actorId, password } });
  expect(login.statusCode).toBe(200);
  const headers = { authorization: `Bearer ${login.json<{ sessionToken: string }>().sessionToken}` };
  const create = (resource: string, payload: Record<string, unknown>, key: string = randomUUID()) => app.inject({
    method: 'POST', url: `/api/v1/${resource}`, headers: { ...headers, 'idempotency-key': key }, payload,
  });
  return { database, persistence, app, actorId, headers, create };
}

it('generates independent readable codes for all catalog identities and exposes them through the API', async () => {
  const { app, headers, create } = await setup();
  const category = await create('stock-categories', { name: 'Synthetic category' });
  expect(category.statusCode).toBe(201);
  expect(category.json()).toMatchObject({ code: 'CAT-000001' });
  const second = await create('stock-categories', { name: 'Another category' });
  expect(second.json()).toMatchObject({ code: 'CAT-000002' });
  const unit = await create('stock-units', { name: 'Synthetic piece', precision: 0 });
  expect(unit.json()).toMatchObject({ code: 'UNIT-000001' });
  const size = await create('stock-sizes', { name: 'Synthetic M' });
  expect(size.json()).toMatchObject({ code: 'SIZE-000001' });
  const item = await create('stock-items', { name: 'Synthetic item', categoryId: category.json<{ id: string }>().id,
    unitId: unit.json<{ id: string }>().id, sizeId: size.json<{ id: string }>().id });
  expect(item.statusCode).toBe(201);
  expect(item.json()).toMatchObject({ code: 'ITEM-000001', category: { code: 'CAT-000001' },
    unit: { code: 'UNIT-000001' }, size: { code: 'SIZE-000001' } });
  const list = await app.inject({ method: 'GET', url: '/api/v1/stock-items', headers });
  expect(list.json()).toMatchObject({ items: [item.json()], totalItems: 1 });
});

it('enforces readable code uniqueness, canonical form and immutability in PostgreSQL for every catalog', async () => {
  const { database, create } = await setup();
  const category = (await create('stock-categories', { name: 'Category' })).json<{ id: string; code: string }>();
  expect(category.code).toBe('CAT-000001');
  const unit = (await create('stock-units', { name: 'Unit', precision: 0 })).json<{ id: string; code: string }>();
  const size = (await create('stock-sizes', { name: 'Size' })).json<{ id: string; code: string }>();
  const item = (await create('stock-items', { name: 'Item', categoryId: category.id, unitId: unit.id })).json<{ id: string; code: string }>();
  const now = new Date();
  const data = { id: randomUUID(), name: 'Duplicate', isActive: true, version: 1, createdAt: now, updatedAt: now };
  for (const insert of [
    () => database.client.stockCategory.create({ data: { ...data, code: category.code } }),
    () => database.client.stockUnit.create({ data: { ...data, precision: 0, code: unit.code } }),
    () => database.client.stockSize.create({ data: { ...data, code: size.code } }),
    () => database.client.stockItem.create({ data: { id: data.id, version: 1, createdAt: now, updatedAt: now, code: item.code } }),
  ]) await expect(insert()).rejects.toMatchObject({ code: 'P2002' });
  for (const update of [
    () => database.client.stockCategory.update({ where: { id: category.id }, data: { code: 'CAT-999999' } }),
    () => database.client.stockUnit.update({ where: { id: unit.id }, data: { code: 'UNIT-999999' } }),
    () => database.client.stockSize.update({ where: { id: size.id }, data: { code: 'SIZE-999999' } }),
    () => database.client.stockItem.update({ where: { id: item.id }, data: { code: 'ITEM-999999' } }),
  ]) await expect(update()).rejects.toThrow();
  for (const code of ['UNIT-000000', 'unit-000001', 'UNIT-0000001', 'UNIT-1', ' UNIT-000001', 'CAT-000999', 'UNIT-9223372036854775808']) {
    await expect(database.client.stockUnit.create({ data: { ...data, id: randomUUID(), precision: 0, code } })).rejects.toThrow();
  }
});

it('retains codes through retirement, reactivation and historical item revisions and rejects client-selected codes', async () => {
  const { app, headers, create } = await setup();
  const category = (await create('stock-categories', { name: 'Original category' })).json<{ id: string; code: string }>();
  const unit = (await create('stock-units', { name: 'Original unit', precision: 0 })).json<{ id: string; code: string }>();
  const size = (await create('stock-sizes', { name: 'Original size' })).json<{ id: string; code: string }>();
  const original = (await create('stock-items', { name: 'Item', categoryId: category.id, unitId: unit.id, sizeId: size.id })).json<StockItemView>();
  for (const [resource, value] of [['stock-categories', category], ['stock-units', unit], ['stock-sizes', size], ['stock-items', original]] as const) {
    for (const [version, isActive] of [[1, false], [2, true]] as const) {
      const changed = await app.inject({ method: 'PATCH', url: `/api/v1/${resource}/${value.id}`,
        headers: { ...headers, 'idempotency-key': randomUUID() }, payload: { version, isActive, reason: 'Change synthetic status.' } });
      expect(changed.statusCode).toBe(200);
      expect(changed.json()).toMatchObject({ code: value.code, isActive, version: version + 1 });
    }
    expect((await create(resource, { name: 'Forbidden', code: value.code })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PATCH', url: `/api/v1/${resource}/${value.id}`,
      headers: { ...headers, 'idempotency-key': randomUUID() }, payload: { version: 3, code: value.code, reason: 'Forbidden code change.' } })).statusCode).toBe(400);
  }
  const nextCategory = (await create('stock-categories', { name: 'New category' })).json<{ id: string; code: string }>();
  const nextUnit = (await create('stock-units', { name: 'New unit', precision: 3 })).json<{ id: string; code: string }>();
  const nextSize = (await create('stock-sizes', { name: 'New size' })).json<{ id: string; code: string }>();
  expect([nextCategory.code, nextUnit.code, nextSize.code]).toEqual(['CAT-000002', 'UNIT-000002', 'SIZE-000002']);
  const changed = await app.inject({ method: 'PATCH', url: `/api/v1/stock-items/${original.id}`,
    headers: { ...headers, 'idempotency-key': randomUUID() }, payload: { version: 3, categoryId: nextCategory.id,
      unitId: nextUnit.id, sizeId: nextSize.id, reason: 'Correct the current classification.' } });
  expect(changed.statusCode).toBe(200);
  expect(changed.json()).toMatchObject({ code: original.code, version: 4, category: { code: nextCategory.code },
    unit: { code: nextUnit.code, precision: 3 }, size: { code: nextSize.code } });
  expect((await app.inject({ method: 'GET', url: `/api/v1/stock-items/${original.id}/revisions/1`, headers })).json()).toEqual(original);
  const nextItem = await create('stock-items', { name: 'New item', categoryId: nextCategory.id, unitId: nextUnit.id });
  expect(nextItem.json()).toMatchObject({ code: 'ITEM-000002' });
});

it('allocates distinct codes for concurrent legitimate creates and replays one confirmed code for concurrent retries', async () => {
  const { database, create } = await setup();
  const category = (await create('stock-categories', { name: 'Category' })).json<{ id: string }>();
  const unit = (await create('stock-units', { name: 'Unit', precision: 0 })).json<{ id: string }>();
  for (const [resource, payload, prefix] of [
    ['stock-categories', { name: 'Concurrent category' }, 'CAT'],
    ['stock-units', { name: 'Concurrent unit', precision: 0 }, 'UNIT'],
    ['stock-sizes', { name: 'Concurrent size' }, 'SIZE'],
    ['stock-items', { name: 'Concurrent item', categoryId: category.id, unitId: unit.id }, 'ITEM'],
  ] as const) {
    const responses = await Promise.all(Array.from({ length: 4 }, () => create(resource, payload)));
    expect(responses.map((response) => response.statusCode)).toEqual([201, 201, 201, 201]);
    const codes = responses.map((response) => response.json<{ code: string }>().code);
    expect(new Set(codes).size).toBe(4);
    for (const code of codes) expect(code).toMatch(new RegExp(`^${prefix}-[0-9]{6}$`));
  }
  const operationId = randomUUID();
  const payload = { name: 'Retry item', categoryId: category.id, unitId: unit.id };
  const responses = await Promise.all(Array.from({ length: 4 }, () => create('stock-items', payload, operationId)));
  const original = responses[0]?.json<StockItemView>();
  expect(original).toMatchObject({ code: 'ITEM-000005' });
  for (const response of responses) { expect(response.statusCode).toBe(201); expect(response.json()).toEqual(original); }
  const conflict = await create('stock-items', { ...payload, name: 'Conflicting retry' }, operationId);
  expect(conflict.statusCode).toBe(409);
  expect(conflict.json()).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  expect(await database.client.auditEntryRecord.count({ where: { operationId } })).toBe(1);
  expect(await database.client.operationConfirmation.count({ where: { operationId } })).toBe(1);
  expect((await create('stock-items', payload)).json()).toMatchObject({ code: 'ITEM-000006' });
});

it('expands suffixes without truncation or Number precision loss and returns an explicit conflict at exhaustion', async () => {
  const { database, app, headers, create } = await setup();
  const unitId = (await create('stock-units', { name: 'Reference unit', precision: 0 })).json<{ id: string }>().id;
  const categoryId = (await create('stock-categories', { name: 'Reference category' })).json<{ id: string }>().id;
  for (const [resource, sequence, prefix, payload] of [
    ['stock-categories', 'stock_category_code_seq', 'CAT', { name: 'Boundary category' }],
    ['stock-units', 'stock_unit_code_seq', 'UNIT', { name: 'Boundary unit', precision: 0 }],
    ['stock-sizes', 'stock_size_code_seq', 'SIZE', { name: 'Boundary size' }],
    ['stock-items', 'stock_item_code_seq', 'ITEM', { name: 'Boundary item', categoryId, unitId }],
  ] as const) {
    let maximumKey = '';
    let maximumBody: unknown;
    for (const suffix of ['999999', '9007199254740993', '9223372036854775807']) {
      await database.client.$queryRaw`SELECT setval(${sequence}::regclass, ${suffix}::bigint, false)`;
      const key = randomUUID();
      const response = await create(resource, payload, key);
      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ code: `${prefix}-${suffix}` });
      if (suffix === '999999') expect((await create(resource, payload)).json()).toMatchObject({ code: `${prefix}-1000000` });
      if (suffix === '9223372036854775807') { maximumKey = key; maximumBody = response.json(); }
    }
    const operationId = randomUUID();
    const exhausted = await create(resource, payload, operationId);
    expect(exhausted.statusCode).toBe(409);
    expect(exhausted.json()).toMatchObject({ code: 'CONFLICT' });
    expect(exhausted.body).not.toContain(sequence);
    expect(exhausted.body).not.toContain('2200H');
    expect(await database.client.auditEntryRecord.count({ where: { operationId } })).toBe(0);
    expect(await database.client.operationConfirmation.count({ where: { operationId } })).toBe(0);
    const replay = await create(resource, payload, maximumKey);
    expect(replay.statusCode).toBe(201);
    expect(replay.json()).toEqual(maximumBody);
    expect((await app.inject({ method: 'GET', url: `/api/v1/${resource}`, headers })).statusCode).toBe(200);
  }
}, 30_000);

it.each(['audit', 'confirmation'])('rolls back protected code creation after a %s failure, permits a gap and retries safely', async (stage) => {
  const { database, persistence, actorId, create } = await setup();
  const categoryId = (await create('stock-categories', { name: 'Category' })).json<{ id: string }>().id;
  const unitId = (await create('stock-units', { name: 'Unit', precision: 0 })).json<{ id: string }>().id;
  const input = { actorId, operationId: randomUUID(), name: 'Rollback code item', categoryId, unitId };
  const failing = new StockCatalogService({ repository: persistence.stockCatalogRepository, clock: () => new Date(),
    transactions: (work) => persistence.stockCatalogTransactions((context) => work({ ...context,
      ...(stage === 'audit' ? { auditTrail: {
        listByEntity: (entityType: string, entityId: string) => context.auditTrail.listByEntity(entityType, entityId),
        record: async () => { throw new Error('Simulated audit failure.'); },
      } } : { idempotency: { execute: async (request) => {
        await context.idempotency.execute(request);
        throw new Error('Simulated confirmation failure.');
      } } }),
    })),
  });
  await expect(failing.createItem(input)).rejects.toThrow(`Simulated ${stage} failure.`);
  expect(await database.client.stockItem.count()).toBe(0);
  expect(await database.client.stockItemRevision.count()).toBe(0);
  expect(await database.client.auditEntryRecord.count({ where: { operationId: input.operationId } })).toBe(0);
  expect(await database.client.operationConfirmation.count({ where: { operationId: input.operationId } })).toBe(0);
  expect(await database.client.$queryRaw`SELECT last_value::text, is_called FROM stock_item_code_seq`).toEqual([{ last_value: '1', is_called: true }]);
  const service = new StockCatalogService({ repository: persistence.stockCatalogRepository,
    transactions: persistence.stockCatalogTransactions, clock: () => new Date() });
  const retry = await service.createItem(input);
  expect(retry.body).toMatchObject({ code: 'ITEM-000002' });
  expect((await service.createItem(input)).body).toEqual(retry.body);
  expect(await database.client.stockItem.count()).toBe(1);
  expect(await database.client.$queryRaw`SELECT last_value::text FROM stock_item_code_seq`).toEqual([{ last_value: '2' }]);
});
