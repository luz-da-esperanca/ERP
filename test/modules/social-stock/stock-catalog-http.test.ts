import { randomUUID } from 'node:crypto';
import { expect, it, onTestFinished } from 'vitest';
import { createApp } from '../../../src/server/app.ts';
import { InMemoryAuditTrail } from '../../../src/modules/shared/infrastructure/in-memory-audit-and-idempotency.ts';
import type { StockItemView } from '../../../src/modules/social-stock/domain/stock-catalog.ts';
import type { AccessProfile } from '../../../src/modules/access/domain/access-types.ts';

const ACTOR_ID = '01963000-0000-7000-8000-000000000201';
const clock = () => new Date('2026-10-25T15:00:00.000Z');

async function setup(profiles: readonly AccessProfile[] = ['STOCK_DISTRIBUTION']) {
  const auditTrail = new InMemoryAuditTrail(clock);
  const app = createApp({ checkDatabase: async () => {}, clock, auditTrail, seedUsers: [{
    id: ACTOR_ID, loginIdentifier: 'synthetic-stock', displayName: 'Synthetic Stock Operator',
    password: 'SyntheticPassword!123', profiles,
  }] });
  onTestFinished(() => app.close());
  const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: {
    loginIdentifier: 'synthetic-stock', password: 'SyntheticPassword!123',
  } });
  expect(login.statusCode).toBe(200);
  const headers = { authorization: `Bearer ${login.json<{ sessionToken: string }>().sessionToken}` };
  const create = (resource: string, payload: Record<string, unknown>, key = randomUUID()) => app.inject({
    method: 'POST', url: `/api/v1/${resource}`, headers: { ...headers, 'idempotency-key': key }, payload,
  });
  return { app, headers, create, auditTrail };
}

it('creates item references and retrieves the item through the protected catalog API (RF-EST-01)', async () => {
  const { app, headers, create, auditTrail } = await setup();
  const category = await create('stock-categories', { name: 'Calçados' });
  expect(category.statusCode).toBe(201);
  const unit = await create('stock-units', { name: 'Par', precision: 0 });
  expect(unit.statusCode).toBe(201);
  const size = await create('stock-sizes', { name: 'BR 39' });
  expect(size.statusCode).toBe(201);
  const payload = { name: 'Tênis sintético', categoryId: category.json<{ id: string }>().id,
    unitId: unit.json<{ id: string }>().id, sizeId: size.json<{ id: string }>().id };
  const response = await create('stock-items', payload);
  expect(response.statusCode).toBe(201);
  const item = response.json<{ id: string }>();
  expect(item).toMatchObject({ name: payload.name, version: 1, isActive: true,
    category: { id: payload.categoryId, name: 'Calçados' }, unit: { id: payload.unitId, name: 'Par', precision: 0 },
    size: { id: payload.sizeId, name: 'BR 39' } });
  const retrieved = await app.inject({ method: 'GET', url: `/api/v1/stock-items/${item.id}`, headers });
  expect(retrieved.json()).toEqual(item);
  const list = await app.inject({ method: 'GET', url: '/api/v1/stock-items?page=1&pageSize=1', headers });
  expect(list.json()).toMatchObject({ items: [item], page: 1, pageSize: 1, totalItems: 1, totalPages: 1 });
  expect(await auditTrail.listByEntity('STOCK_ITEM', item.id)).toMatchObject([{ actorId: ACTOR_ID, action: 'CREATE', after: item }]);
});

it('returns independent server-generated codes through catalog creation, references and audit', async () => {
  const { create, auditTrail } = await setup();
  const category = await create('stock-categories', { name: 'Category' });
  expect(category.json()).toMatchObject({ code: 'CAT-000001' });
  expect((await create('stock-categories', { name: 'Another category' })).json()).toMatchObject({ code: 'CAT-000002' });
  const unit = await create('stock-units', { name: 'Unit', precision: 0 });
  expect(unit.json()).toMatchObject({ code: 'UNIT-000001' });
  const size = await create('stock-sizes', { name: 'Size' });
  expect(size.json()).toMatchObject({ code: 'SIZE-000001' });
  const response = await create('stock-items', { name: 'Item', categoryId: category.json<{ id: string }>().id,
    unitId: unit.json<{ id: string }>().id, sizeId: size.json<{ id: string }>().id });
  expect(response.statusCode).toBe(201);
  expect(response.json()).toMatchObject({ code: 'ITEM-000001', category: { code: 'CAT-000001' },
    unit: { code: 'UNIT-000001' }, size: { code: 'SIZE-000001' } });
  const item = response.json<StockItemView>();
  expect(await auditTrail.listByEntity('STOCK_ITEM', item.id)).toMatchObject([{ after: item }]);
});

it('rejects invalid names, implicit unit precision, invalid references and unexpected input (VAL-06)', async () => {
  const { app, headers, create } = await setup();
  for (const name of ['', '  ', 42, null, 'x'.repeat(151)]) {
    expect((await create('stock-categories', { name })).statusCode).toBe(422);
  }
  for (const precision of [undefined, null, -1, 19, 1.5, '3']) {
    expect((await create('stock-units', { name: 'Quilo sintético', precision })).statusCode).toBe(422);
  }
  expect((await create('stock-sizes', { name: 'BR 39', precision: 0 })).statusCode).toBe(400);
  expect((await create('stock-items', { name: 'Item', categoryId: randomUUID(), unitId: randomUUID() })).statusCode).toBe(422);
  const category = (await create('stock-categories', { name: 'Categoria' })).json<{ id: string }>();
  const unit = (await create('stock-units', { name: 'Peça', precision: 0 })).json<{ id: string }>();
  for (const override of [{ categoryId: unit.id }, { unitId: category.id }, { sizeId: category.id }, { sizeId: randomUUID() }, { categoryId: 'invalid' }, { name: '' }]) {
    expect((await create('stock-items', { name: 'Item', categoryId: category.id, unitId: unit.id, ...override })).statusCode).toBe(422);
  }
  expect((await create('stock-items', { name: 'Item', categoryId: category.id, unitId: unit.id, quantity: '1' })).statusCode).toBe(400);
  const absent = await app.inject({ method: 'GET', url: `/api/v1/stock-items/${randomUUID()}`, headers });
  expect(absent.statusCode).toBe(404);
  expect(absent.headers['content-type']).toContain('application/problem+json');
  expect(absent.json()).toMatchObject({ code: 'RESOURCE_NOT_FOUND', traceId: expect.any(String) });
});

it('preserves the original unit and size when updating an item and rejects stale changes (RF-EST-01)', async () => {
  const { app, headers, create, auditTrail } = await setup();
  const categoryId = (await create('stock-categories', { name: 'Calçados' })).json<{ id: string }>().id;
  const unitId = (await create('stock-units', { name: 'Par', precision: 0 })).json<{ id: string }>().id;
  const sizeId = (await create('stock-sizes', { name: 'BR 39' })).json<{ id: string }>().id;
  const original = (await create('stock-items', { name: 'Tênis', categoryId, unitId, sizeId })).json<StockItemView>();
  const replacementUnit = (await create('stock-units', { name: 'Peça', precision: 0 })).json<{ id: string }>().id;
  const replacementSize = (await create('stock-sizes', { name: 'BR 40' })).json<{ id: string }>().id;
  const patch = { method: 'PATCH' as const, url: `/api/v1/stock-items/${original.id}`,
    headers: { ...headers, 'idempotency-key': randomUUID() },
    payload: { version: 1, unitId: replacementUnit, sizeId: replacementSize, reason: 'Correct the catalog classification.' } };
  const changed = await app.inject(patch);
  expect(changed.statusCode).toBe(200);
  expect(changed.json()).toMatchObject({ id: original.id, version: 2, unit: { id: replacementUnit }, size: { id: replacementSize } });
  expect(changed.json<StockItemView>().revisionId).not.toBe(original.revisionId);
  const previous = await app.inject({ method: 'GET', url: `/api/v1/stock-items/${original.id}/revisions/1`, headers });
  expect(previous.json()).toEqual(original);
  expect((await app.inject(patch)).json()).toEqual(changed.json());
  const stale = await app.inject({ ...patch, headers: { ...headers, 'idempotency-key': randomUUID() } });
  expect(stale.statusCode).toBe(409);
  expect(stale.json()).toMatchObject({ code: 'STALE_VERSION' });
  const audit = await auditTrail.listByEntity('STOCK_ITEM', original.id);
  expect(audit).toMatchObject([{ action: 'CREATE' }, { action: 'UPDATE', before: original, after: changed.json(), reason: patch.payload.reason }]);
});

it('deactivates options without changing their meaning and blocks inactive references in new facts (VAL-06)', async () => {
  const { app, headers, create } = await setup();
  const category = (await create('stock-categories', { name: 'Categoria' })).json<{ id: string }>();
  const unit = (await create('stock-units', { name: 'Quilo', precision: 3 })).json<{ id: string }>();
  const size = (await create('stock-sizes', { name: 'BR 39' })).json<{ id: string }>();
  for (const [resource, option] of [['stock-categories', category], ['stock-units', unit], ['stock-sizes', size]] as const) {
    const original = await app.inject({ method: 'GET', url: `/api/v1/${resource}/${option.id}`, headers });
    const response = await app.inject({ method: 'PATCH', url: `/api/v1/${resource}/${option.id}`,
      headers: { ...headers, 'idempotency-key': randomUUID() }, payload: { version: 1, isActive: false, reason: 'Retire synthetic option.' } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ...original.json<Record<string, unknown>>(), isActive: false, version: 2 });
    const forbiddenChange = await app.inject({ method: 'PATCH', url: `/api/v1/${resource}/${option.id}`,
      headers: { ...headers, 'idempotency-key': randomUUID() }, payload: { version: 2, name: 'Different meaning', reason: 'Rename.' } });
    expect(forbiddenChange.statusCode).toBe(400);
    const currentCategory = (await create('stock-categories', { name: 'Active category' })).json<{ id: string }>();
    const currentUnit = (await create('stock-units', { name: 'Active unit', precision: 0 })).json<{ id: string }>();
    const payload = { name: 'Item', categoryId: currentCategory.id, unitId: currentUnit.id,
      ...(resource === 'stock-categories' ? { categoryId: option.id } : {}),
      ...(resource === 'stock-units' ? { unitId: option.id } : {}),
      ...(resource === 'stock-sizes' ? { sizeId: option.id } : {}) };
    expect((await create('stock-items', payload)).statusCode).toBe(422);
  }
});

it.each<AccessProfile>(['ADMIN', 'SOCIAL_ASSISTANCE', 'PERIODIC_ACTIVITY', 'POINT_IN_TIME_SERVICE', 'BAZAR'])('denies unauthorized catalog access for %s, including direct writes', async (profile) => {
  const { app, headers, create } = await setup([profile]);
  for (const resource of ['stock-items', 'stock-categories', 'stock-units', 'stock-sizes']) {
    expect((await app.inject({ method: 'GET', url: `/api/v1/${resource}` })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: `/api/v1/${resource}`, headers })).statusCode).toBe(403);
    expect((await create(resource, { name: 'Forbidden' })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PATCH', url: `/api/v1/${resource}/${randomUUID()}`, headers,
      payload: { version: 1, isActive: false, reason: 'Forbidden' } })).statusCode).toBe(403);
  }
});

it('replays concurrent normalized confirmations once and rejects changed content', async () => {
  const { app, headers, create, auditTrail } = await setup(['COORDINATOR']);
  const key = randomUUID();
  const responses = await Promise.all([create('stock-categories', { name: ' Categoria ' }, key), create('stock-categories', { name: 'Categoria' }, key)]);
  expect(responses.map((response) => response.statusCode)).toEqual([201, 201]);
  expect(responses[0]?.json()).toEqual(responses[1]?.json());
  const categoryId = responses[0]?.json<{ id: string }>().id;
  expect(categoryId).toBeDefined();
  const conflict = await create('stock-categories', { name: 'Different category' }, key);
  expect(conflict.statusCode).toBe(409);
  expect(conflict.json()).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  const list = await app.inject({ method: 'GET', url: '/api/v1/stock-categories', headers });
  expect(list.json()).toMatchObject({ totalItems: 1 });
  expect(await auditTrail.listByEntity('STOCK_CATEGORY', categoryId ?? '')).toHaveLength(1);
});

it('requires an explicit item change and a valid reason', async () => {
  const { app, headers, create, auditTrail } = await setup();
  const categoryId = (await create('stock-categories', { name: 'Category' })).json<{ id: string }>().id;
  const unitId = (await create('stock-units', { name: 'Unit', precision: 0 })).json<{ id: string }>().id;
  const item = (await create('stock-items', { name: 'Item', categoryId, unitId })).json<StockItemView>();
  for (const payload of [
    { version: 1, reason: 'No requested change.' },
    { version: 1, name: 'Changed', reason: '' },
    { version: 1, name: 'Changed', reason: 'x'.repeat(1001) },
    { version: 0, name: 'Changed', reason: 'Invalid version.' },
    { version: 1, isActive: null, reason: 'Invalid flag.' },
  ]) {
    const invalid = await app.inject({ method: 'PATCH', url: `/api/v1/stock-items/${item.id}`,
      headers: { ...headers, 'idempotency-key': randomUUID() }, payload });
    expect(invalid.statusCode).toBe(422);
  }
  expect(await auditTrail.listByEntity('STOCK_ITEM', item.id)).toHaveLength(1);
});

it('can retire an item whose option was retired while preserving its historical snapshot', async () => {
  const { app, headers, create } = await setup();
  const categoryId = (await create('stock-categories', { name: 'Category' })).json<{ id: string }>().id;
  const unitId = (await create('stock-units', { name: 'Unit', precision: 0 })).json<{ id: string }>().id;
  const item = (await create('stock-items', { name: 'Item', categoryId, unitId })).json<StockItemView>();
  const retiredUnit = await app.inject({ method: 'PATCH', url: `/api/v1/stock-units/${unitId}`,
    headers: { ...headers, 'idempotency-key': randomUUID() },
    payload: { version: 1, isActive: false, reason: 'Retire obsolete unit.' } });
  expect(retiredUnit.statusCode).toBe(200);
  const retiredItem = await app.inject({ method: 'PATCH', url: `/api/v1/stock-items/${item.id}`,
    headers: { ...headers, 'idempotency-key': randomUUID() },
    payload: { version: 1, isActive: false, reason: 'Retire obsolete item.' } });
  expect(retiredItem.statusCode).toBe(200);
  expect(retiredItem.json()).toMatchObject({ isActive: false, unit: item.unit });
  expect((await app.inject({ method: 'GET', url: `/api/v1/stock-items/${item.id}/revisions/1`, headers })).json()).toEqual(item);
});

it.each(['page=0', 'pageSize=101', 'page=1&page=2', 'page=2147483649&pageSize=1', 'unexpected=true'])('rejects invalid or unsupported catalog pagination (%s)', async (query) => {
  const { app, headers } = await setup();
  for (const resource of ['stock-items', 'stock-categories', 'stock-units', 'stock-sizes']) {
    expect((await app.inject({ method: 'GET', url: `/api/v1/${resource}?${query}`, headers })).statusCode).toBe(400);
  }
});
