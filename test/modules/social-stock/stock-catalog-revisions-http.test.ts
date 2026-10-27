import { randomUUID } from 'node:crypto';
import { expect, it, onTestFinished } from 'vitest';
import { createApp } from '../../../src/server/app.ts';

it('accepts only canonical positive historical revision identifiers within the persistence range', async () => {
  const app = createApp({ checkDatabase: async () => {}, seedUsers: [{
    id: randomUUID(), loginIdentifier: 'synthetic-revisions', displayName: 'Synthetic Stock Operator',
    password: 'SyntheticPassword!123', profiles: ['STOCK_DISTRIBUTION'],
  }] });
  onTestFinished(() => app.close());
  const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login',
    payload: { loginIdentifier: 'synthetic-revisions', password: 'SyntheticPassword!123' } });
  expect(login.statusCode).toBe(200);
  const headers = { authorization: `Bearer ${login.json<{ sessionToken: string }>().sessionToken}` };
  async function create(resource: string, payload: Record<string, unknown>) {
    const response = await app.inject({ method: 'POST', url: `/api/v1/${resource}`,
      headers: { ...headers, 'idempotency-key': randomUUID() }, payload });
    expect(response.statusCode).toBe(201);
    return response.json<{ id: string }>();
  }
  const category = await create('stock-categories', { name: 'Synthetic category' });
  const unit = await create('stock-units', { name: 'Synthetic unit', precision: 0 });
  const item = await create('stock-items', { name: 'Synthetic item', categoryId: category.id, unitId: unit.id });
  const valid = await app.inject({ method: 'GET', url: `/api/v1/stock-items/${item.id}/revisions/1`, headers });
  expect(valid.statusCode).toBe(200);
  expect(valid.json()).toMatchObject({ id: item.id, version: 1 });
  for (const version of ['01', '001', '0', '00', '-1', '+1', '1.0', '1e0', ' 1', '1 ', '1 0', '\t1', '2147483648', '9007199254740991', '2']) {
    const response = await app.inject({ method: 'GET',
      url: `/api/v1/stock-items/${item.id}/revisions/${encodeURIComponent(version)}`, headers });
    expect(response.statusCode, `revision ${JSON.stringify(version)}`).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json()).toMatchObject({ code: 'RESOURCE_NOT_FOUND', status: 404, traceId: expect.any(String) });
  }
});
