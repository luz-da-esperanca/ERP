import { describe, expect, it, vi } from 'vitest';
import {
  createHttpStockApi,
  type StockApiFetchClient,
} from '../../../src/client/social-stock/http-stock-api.ts';
import { StockApiError } from '../../../src/client/social-stock/stock-api.ts';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function problemResponse(status: number, code: string, extra: Record<string, unknown> = {}): Response {
  return jsonResponse(status, {
    type: `urn:erp:problem:${code.toLowerCase()}`,
    title: 'Synthetic problem',
    status,
    detail: 'Synthetic detail.',
    code,
    traceId: 'synthetic-trace-id',
    ...extra,
  });
}

const createdAt = '2026-10-26T12:00:00.000Z';

describe('HTTP stock API', () => {
  it('lists catalog options with pagination and preserves unknown data', async () => {
    const fetchClient = vi.fn<StockApiFetchClient>(async (input, init) => {
      expect(input).toBe('/api/v1/stock-units?page=2&pageSize=10');
      expect(init).toEqual({ method: 'GET', credentials: 'same-origin' });
      return jsonResponse(200, {
        items: [
          { id: 'unit-1', code: 'UNIT-000001', name: 'Quilograma', precision: 3,
            isActive: true, version: 1, createdAt, updatedAt: createdAt },
          { id: 'unit-2', name: 'Avulso', precision: 0,
            isActive: true, version: 1, createdAt, updatedAt: createdAt },
        ],
        page: 2, pageSize: 10, totalItems: 2, totalPages: 1,
      });
    });
    const api = createHttpStockApi({
      fetchClient,
      csrfProvider: { getCsrfToken: () => null },
    });

    const page = await api.listOptions('UNIT', { page: 2, pageSize: 10 });

    expect(page.page).toBe(2);
    expect(page.totalItems).toBe(2);
    expect(page.items[0]?.code).toBe('UNIT-000001');
    expect(page.items[0]?.precision).toBe(3);
    expect(page.items[1]?.code).toBeNull();
    expect(page.items[1]?.precision).toBe(0);
  });

  it('sends exactly the allowed fields when creating a category', async () => {
    const fetchClient = vi.fn<StockApiFetchClient>(async (input, init) => {
      expect(input).toBe('/api/v1/stock-categories');
      expect(init.method).toBe('POST');
      expect(init.credentials).toBe('same-origin');
      const headers = new Headers(init.headers);
      expect(headers.get('content-type')).toBe('application/json');
      expect(headers.get('Idempotency-Key')).toBe('opaque-operation-id');
      expect(headers.get('X-CSRF-Token')).toBe('opaque-csrf-token');
      expect(JSON.parse(String(init.body))).toEqual({ name: 'Roupas' });
      return jsonResponse(201, { id: 'category-1', code: 'CAT-000001', name: 'Roupas',
        precision: null, isActive: true, version: 1, createdAt, updatedAt: createdAt });
    });
    const api = createHttpStockApi({
      fetchClient,
      csrfProvider: { getCsrfToken: () => 'opaque-csrf-token' },
      generateIdempotencyKey: () => 'opaque-operation-id',
    });

    const created = await api.createOption('CATEGORY', { name: 'Roupas' });

    expect(created.code).toBe('CAT-000001');
    expect(created.precision).toBeNull();
  });

  it('creates units with precision and items without inventing sizeId', async () => {
    const seen: unknown[] = [];
    const fetchClient = vi.fn<StockApiFetchClient>(async (input, init) => {
      seen.push(JSON.parse(String(init.body)));
      if (input === '/api/v1/stock-units') {
        return jsonResponse(201, { id: 'unit-1', code: 'UNIT-000001', name: 'Par', precision: 0,
          isActive: true, version: 1, createdAt, updatedAt: createdAt });
      }
      return jsonResponse(201, { id: 'item-1', code: 'ITEM-000001', revisionId: 'rev-1', version: 1,
        name: 'Calça', category: { id: 'c1', code: 'CAT-000001', name: 'Roupas' },
        unit: { id: 'u1', code: 'UNIT-000001', name: 'Par', precision: 0 },
        size: null, isActive: true, createdAt, updatedAt: createdAt });
    });
    const api = createHttpStockApi({
      fetchClient,
      csrfProvider: { getCsrfToken: () => 'opaque-csrf-token' },
      generateIdempotencyKey: () => 'opaque-operation-id',
    });

    await api.createOption('UNIT', { name: 'Par', precision: 0 });
    const item = await api.createItem({ name: 'Calça', categoryId: 'c1', unitId: 'u1' });

    expect(seen[0]).toEqual({ name: 'Par', precision: 0 });
    expect(seen[1]).toEqual({ name: 'Calça', categoryId: 'c1', unitId: 'u1' });
    expect(item.size).toBeNull();
    expect(item.unit.precision).toBe(0);
  });

  it('creates origins with kind and name', async () => {
    const fetchClient = vi.fn<StockApiFetchClient>(async (input, init) => {
      expect(input).toBe('/api/v1/stock-origins');
      expect(JSON.parse(String(init.body))).toEqual({ kind: 'INDIVIDUAL_DONOR', name: 'Doadora Maria' });
      return jsonResponse(201, { id: 'origin-1', kind: 'INDIVIDUAL_DONOR', name: 'Doadora Maria',
        isExternalDonation: true, isSystemManaged: false, createdAt });
    });
    const api = createHttpStockApi({
      fetchClient,
      csrfProvider: { getCsrfToken: () => 'opaque-csrf-token' },
      generateIdempotencyKey: () => 'opaque-operation-id',
    });

    const created = await api.createOrigin({ kind: 'INDIVIDUAL_DONOR', name: 'Doadora Maria' });

    expect(created.isSystemManaged).toBe(false);
  });

  it('lists origins with kind and search filters', async () => {
    const fetchClient = vi.fn<StockApiFetchClient>(async (input) => {
      expect(input).toBe('/api/v1/stock-origins?kind=CAMPAIGN&search=inverno&page=1&pageSize=20');
      return jsonResponse(200, { items: [{ id: 'origin-9', kind: 'CAMPAIGN', name: 'Campanha Inverno',
        isExternalDonation: true, isSystemManaged: false, createdAt }],
        page: 1, pageSize: 20, totalItems: 1, totalPages: 1 });
    });
    const api = createHttpStockApi({
      fetchClient,
      csrfProvider: { getCsrfToken: () => null },
    });

    const page = await api.listOrigins({ kind: 'CAMPAIGN', search: 'inverno' });

    expect(page.items).toHaveLength(1);
  });

  it('maps validation failures to field errors', async () => {
    const fetchClient = vi.fn<StockApiFetchClient>(async () => problemResponse(422, 'VALIDATION_FAILED', {
      errors: [{ field: 'name', code: 'REQUIRED_FIELD', message: 'Synthetic required.' }],
    }));
    const api = createHttpStockApi({
      fetchClient,
      csrfProvider: { getCsrfToken: () => 'opaque-csrf-token' },
    });

    const failure = await api.createOption('CATEGORY', { name: '' }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(StockApiError);
    const stockError = failure as StockApiError;
    expect(stockError.status).toBe(422);
    expect(stockError.code).toBe('VALIDATION_FAILED');
    expect(stockError.traceId).toBe('synthetic-trace-id');
    expect(stockError.errors).toEqual([{ field: 'name', code: 'REQUIRED_FIELD', message: 'Synthetic required.' }]);
  });

  it('maps access failures preserving code and traceId', async () => {
    const forbiddenFetch = vi.fn<StockApiFetchClient>(async () => problemResponse(403, 'FORBIDDEN'));
    const api = createHttpStockApi({
      fetchClient: forbiddenFetch,
      csrfProvider: { getCsrfToken: () => 'opaque-csrf-token' },
    });

    const failure = await api.listItems().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(StockApiError);
    expect((failure as StockApiError).status).toBe(403);
    expect((failure as StockApiError).code).toBe('FORBIDDEN');

    const unauthorizedFetch = vi.fn<StockApiFetchClient>(async () => problemResponse(401, 'AUTH_REQUIRED'));
    const sessionApi = createHttpStockApi({
      fetchClient: unauthorizedFetch,
      csrfProvider: { getCsrfToken: () => null },
    });
    const sessionFailure = await sessionApi.listItems().catch((error: unknown) => error);
    expect((sessionFailure as StockApiError).code).toBe('AUTH_REQUIRED');
  });

  it('maps conflicts preserving the specific code', async () => {
    for (const code of ['STALE_VERSION', 'IDEMPOTENCY_CONFLICT', 'DUPLICATE_RESOURCE']) {
      const fetchClient = vi.fn<StockApiFetchClient>(async () => problemResponse(409, code));
      const api = createHttpStockApi({
        fetchClient,
        csrfProvider: { getCsrfToken: () => 'opaque-csrf-token' },
      });
      const failure = await api.listItems().catch((error: unknown) => error);
      expect((failure as StockApiError).status).toBe(409);
      expect((failure as StockApiError).code).toBe(code);
    }
  });

  it('maps malformed success payloads to a generic error', async () => {
    const fetchClient = vi.fn<StockApiFetchClient>(async () => jsonResponse(200, { items: null }));
    const api = createHttpStockApi({
      fetchClient,
      csrfProvider: { getCsrfToken: () => null },
    });

    const failure = await api.listItems().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(StockApiError);
    expect((failure as StockApiError).code).toBe('UNEXPECTED_RESPONSE');
  });

  it('maps non-JSON failures to a generic error keeping the HTTP status', async () => {
    const fetchClient = vi.fn<StockApiFetchClient>(
      async () => new Response('<html>proxy</html>', { status: 500 }),
    );
    const api = createHttpStockApi({
      fetchClient,
      csrfProvider: { getCsrfToken: () => null },
    });

    const failure = await api.listItems().catch((error: unknown) => error);

    expect((failure as StockApiError).status).toBe(500);
    expect((failure as StockApiError).code).toBe('UNEXPECTED_RESPONSE');
    expect((failure as StockApiError).traceId).toBeNull();
  });

  it('wraps network failures in a single error shape', async () => {
    const fetchClient = vi.fn<StockApiFetchClient>(async () => {
      throw new Error('network down');
    });
    const api = createHttpStockApi({
      fetchClient,
      csrfProvider: { getCsrfToken: () => null },
    });

    const failure = await api.listItems().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(StockApiError);
    expect((failure as StockApiError).status).toBe(0);
    expect((failure as StockApiError).code).toBe('NETWORK_ERROR');
  });

  it('refuses mutations without a CSRF verifier before sending anything', async () => {
    const fetchClient = vi.fn<StockApiFetchClient>(async () => jsonResponse(201, {}));
    const api = createHttpStockApi({
      fetchClient,
      csrfProvider: { getCsrfToken: () => null },
    });

    const failure = await api.createOption('CATEGORY', { name: 'Roupas' }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(StockApiError);
    expect((failure as StockApiError).code).toBe('MISSING_CSRF_TOKEN');
    expect(fetchClient).not.toHaveBeenCalled();
  });

  it('preserves items without size and absent reference codes', async () => {
    const fetchClient = vi.fn<StockApiFetchClient>(async () => jsonResponse(200, {
      id: 'item-1', revisionId: 'rev-1', version: 1, name: 'Cobertor',
      category: { id: 'c1', name: 'Cama e banho' },
      unit: { id: 'u1', name: 'Peça', precision: 0 },
      size: null, isActive: true, createdAt, updatedAt: createdAt,
    }));
    const api = createHttpStockApi({
      fetchClient,
      csrfProvider: { getCsrfToken: () => null },
    });

    const item = await api.getItem('item-1');

    expect(item.code).toBeNull();
    expect(item.size).toBeNull();
    expect(item.category.code).toBeNull();
    expect(item.unit.precision).toBe(0);
  });
});
