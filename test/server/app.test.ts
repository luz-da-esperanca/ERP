import { fileURLToPath } from 'node:url';
import { expect, it, onTestFinished, vi } from 'vitest';
import { createApp } from '../../src/server/app.ts';

it('serves the client on navigation while keeping unknown API routes as problem responses', async () => {
  const app = createApp({
    checkDatabase: async () => {},
    clientDirectory: fileURLToPath(new URL('../fixtures/client/', import.meta.url)),
  });
  onTestFinished(() => app.close());

  const page = await app.inject({ url: '/familias', headers: { accept: 'text/html' } });
  const asset = await app.inject({ url: '/asset.js' });
  const missingApi = await app.inject({ url: '/api/v1/missing', headers: { accept: 'text/html' } });
  const missingAsset = await app.inject({ url: '/missing.js' });

  expect(page.statusCode).toBe(200);
  expect(page.body).toContain('<title>ERP client fixture</title>');
  expect(asset.statusCode).toBe(200);
  expect(asset.headers['content-type']).toContain('javascript');
  expect(missingApi.statusCode).toBe(404);
  expect(missingApi.json()).toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  expect(missingAsset.statusCode).toBe(404);
});

it('rejects malformed JSON with a safe invalid request response', async () => {
  const app = createApp({ checkDatabase: async () => {} });
  app.post('/parse', async (request) => request.body);
  onTestFinished(() => app.close());

  const response = await app.inject({
    method: 'POST', url: '/parse',
    headers: { 'content-type': 'application/json' },
    payload: '{"private-value":',
  });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ code: 'INVALID_REQUEST', status: 400 });
  expect(response.body).not.toContain('private-value');
});

it.each([
  { url: '/missing?token=private-value', status: 404, code: 'RESOURCE_NOT_FOUND' },
  { url: '/failure?token=private-value', status: 500, code: 'INTERNAL_ERROR' },
])('returns a safe problem response for $status errors', async ({ url, status, code }) => {
  const app = createApp({ checkDatabase: async () => {} });
  app.get('/failure', async () => { throw new Error('private-connection-string'); });
  onTestFinished(() => app.close());

  const response = await app.inject({ method: 'GET', url, headers: { 'x-request-id': 'client-supplied-id' } });

  expect(response.statusCode).toBe(status);
  expect(response.headers['content-type']).toContain('application/problem+json');
  expect(response.json()).toMatchObject({ status, code, traceId: expect.any(String) });
  expect(response.body).not.toMatch(/private|client-supplied|stack|Error:|connection-string/);
});

it('reports liveness without querying the database', async () => {
  const checkDatabase = vi.fn<() => Promise<void>>();
  const app = createApp({ checkDatabase });
  onTestFinished(() => app.close());

  const response = await app.inject({ method: 'GET', url: '/api/v1/health' });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ status: 'ok' });
  expect(checkDatabase).not.toHaveBeenCalled();
});

it('reports a safe unavailable response when the database check fails', async () => {
  const app = createApp({
    checkDatabase: async () => { throw new Error('postgresql://private:secret@internal/database'); },
  });
  onTestFinished(() => app.close());

  const response = await app.inject({ method: 'GET', url: '/api/v1/ready' });

  expect(response.statusCode).toBe(503);
  expect(response.headers['content-type']).toContain('application/problem+json');
  expect(response.json()).toMatchObject({
    type: 'urn:erp:problem:service-unavailable',
    title: 'Serviço temporariamente indisponível',
    status: 503,
    code: 'SERVICE_UNAVAILABLE',
    traceId: expect.any(String),
  });
  expect(response.body).not.toMatch(/private|secret|internal|stack|postgresql/);
});

it('reports readiness only after the database check succeeds', async () => {
  const checkDatabase = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const app = createApp({ checkDatabase });
  onTestFinished(() => app.close());

  const response = await app.inject({ method: 'GET', url: '/api/v1/ready' });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ status: 'ok' });
  expect(checkDatabase).toHaveBeenCalledOnce();
});
