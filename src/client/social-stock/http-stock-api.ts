import type { AuthService } from '../auth/auth-state.ts';
import { readStockApiError } from './problem-details.ts';
import {
  StockApiError,
  type CatalogKind,
  type CatalogOption,
  type CatalogReference,
  type CreatableStockOriginKind,
  type NewCatalogOptionInput,
  type NewStockItemInput,
  type NewStockOriginInput,
  type Page,
  type PaginationInput,
  type StockApi,
  type StockItem,
  type StockOrigin,
  type StockOriginFilter,
  type StockOriginKind,
} from './stock-api.ts';

export type StockApiFetchClient = (input: string, init: RequestInit) => Promise<Response>;

export type CsrfProvider = Pick<AuthService, 'getCsrfToken'>;

export interface HttpStockApiOptions {
  readonly fetchClient?: StockApiFetchClient;
  readonly csrfProvider: CsrfProvider;
  readonly generateIdempotencyKey?: () => string;
}

const CATALOG_RESOURCES: Record<CatalogKind, string> = {
  CATEGORY: 'stock-categories',
  UNIT: 'stock-units',
  SIZE: 'stock-sizes',
};

const STOCK_ORIGIN_KINDS: readonly StockOriginKind[] = [
  'INDIVIDUAL_DONOR',
  'COMPANY_DONOR',
  'CAMPAIGN',
  'UNKNOWN',
  'BAZAR_TRANSFER',
];

function isStockOriginKind(value: unknown): value is StockOriginKind {
  return typeof value === 'string' && STOCK_ORIGIN_KINDS.some((kind) => kind === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function networkError(): StockApiError {
  return new StockApiError({ status: 0, code: 'NETWORK_ERROR', traceId: null, errors: [] });
}

function unexpectedResponse(status: number): StockApiError {
  return new StockApiError({ status, code: 'UNEXPECTED_RESPONSE', traceId: null, errors: [] });
}

function readOptionalCode(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readCatalogReference(body: unknown): CatalogReference | null {
  if (!isRecord(body)) return null;
  const { id, name } = body;
  if (typeof id !== 'string' || typeof name !== 'string') return null;
  return { id, code: readOptionalCode(body.code), name };
}

function readCatalogOption(body: unknown): CatalogOption | null {
  if (!isRecord(body)) return null;
  const { id, name, createdAt, updatedAt, isActive, version, precision } = body;
  if (typeof id !== 'string' || typeof name !== 'string'
    || typeof createdAt !== 'string' || typeof updatedAt !== 'string') return null;
  if (typeof isActive !== 'boolean' || typeof version !== 'number') return null;
  if (typeof precision !== 'number' && precision !== null) return null;
  return {
    id,
    code: readOptionalCode(body.code),
    name,
    precision,
    isActive,
    version,
    createdAt,
    updatedAt,
  };
}

function readStockItem(body: unknown): StockItem | null {
  if (!isRecord(body)) return null;
  const { id, revisionId, version, name, createdAt, updatedAt, isActive } = body;
  if (typeof id !== 'string' || typeof revisionId !== 'string' || typeof name !== 'string'
    || typeof createdAt !== 'string' || typeof updatedAt !== 'string') return null;
  if (typeof version !== 'number' || typeof isActive !== 'boolean') return null;
  const category = readCatalogReference(body.category);
  if (category === null || !isRecord(body.unit)) return null;
  const unitPrecision = body.unit.precision;
  if (typeof unitPrecision !== 'number') return null;
  const unit = readCatalogReference(body.unit);
  if (unit === null) return null;
  const size = body.size === null ? null : readCatalogReference(body.size);
  if (size === undefined) return null;
  return {
    id,
    code: readOptionalCode(body.code),
    revisionId,
    version,
    name,
    category,
    unit: { ...unit, precision: unitPrecision },
    size,
    isActive,
    createdAt,
    updatedAt,
  };
}

function readStockOrigin(body: unknown): StockOrigin | null {
  if (!isRecord(body)) return null;
  const { id, kind, name, createdAt, isExternalDonation, isSystemManaged } = body;
  if (typeof id !== 'string' || typeof name !== 'string' || typeof createdAt !== 'string') return null;
  if (!isStockOriginKind(kind)) return null;
  if (typeof isExternalDonation !== 'boolean' || typeof isSystemManaged !== 'boolean') return null;
  return {
    id,
    kind,
    name,
    isExternalDonation,
    isSystemManaged,
    createdAt,
  };
}

function readPage<Item>(body: unknown, readItem: (item: unknown) => Item | null): Page<Item> | null {
  if (!isRecord(body)) return null;
  const { items, page, pageSize, totalItems, totalPages } = body;
  if (!Array.isArray(items)) return null;
  if (typeof page !== 'number' || typeof pageSize !== 'number'
    || typeof totalItems !== 'number' || typeof totalPages !== 'number') return null;
  const parsed: Item[] = [];
  for (const item of items) {
    const parsedItem = readItem(item);
    if (parsedItem === null) return null;
    parsed.push(parsedItem);
  }
  return { items: parsed, page, pageSize, totalItems, totalPages };
}

function withPagination(path: string, pagination?: PaginationInput): string {
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 20;
  return `${path}?page=${page}&pageSize=${pageSize}`;
}

function withOriginFilter(path: string, filter?: StockOriginFilter, pagination?: PaginationInput): string {
  const query: string[] = [];
  if (filter?.kind !== undefined) query.push(`kind=${filter.kind}`);
  if (filter?.search !== undefined) query.push(`search=${encodeURIComponent(filter.search)}`);
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 20;
  query.push(`page=${page}`, `pageSize=${pageSize}`);
  return `${path}?${query.join('&')}`;
}

/**
 * Fetch adapter over the social-stock HTTP contracts. Reads stay CSRF-free;
 * every mutation signs the session verifier and a fresh idempotency key.
 * Malformed success payloads and transport failures surface as StockApiError.
 */
export function createHttpStockApi(options: HttpStockApiOptions): StockApi {
  const fetchClient = options.fetchClient ?? globalThis.fetch.bind(globalThis);
  const generateIdempotencyKey = options.generateIdempotencyKey ?? (() => globalThis.crypto.randomUUID());
  const csrfProvider = options.csrfProvider;

  async function readJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  async function get<T>(path: string, parse: (body: unknown) => T | null): Promise<T> {
    let response: Response;
    try {
      response = await fetchClient(path, { method: 'GET', credentials: 'same-origin' });
    } catch {
      throw networkError();
    }
    if (!response.ok) throw await readStockApiError(response);
    const parsed = parse(await readJson(response));
    if (parsed === null) throw unexpectedResponse(response.status);
    return parsed;
  }

  async function post<T>(path: string, payload: Record<string, unknown>, parse: (body: unknown) => T | null): Promise<T> {
    const csrfToken = csrfProvider.getCsrfToken();
    if (csrfToken === null) {
      throw new StockApiError({ status: 0, code: 'MISSING_CSRF_TOKEN', traceId: null, errors: [] });
    }
    let response: Response;
    try {
      response = await fetchClient(path, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
          'Idempotency-Key': generateIdempotencyKey(),
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      throw networkError();
    }
    if (!response.ok) throw await readStockApiError(response);
    const parsed = parse(await readJson(response));
    if (parsed === null) throw unexpectedResponse(response.status);
    return parsed;
  }

  function createOptionPayload(input: NewCatalogOptionInput): Record<string, unknown> {
    if (input.precision === undefined) return { name: input.name };
    return { name: input.name, precision: input.precision };
  }

  function createItemPayload(input: NewStockItemInput): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      name: input.name,
      categoryId: input.categoryId,
      unitId: input.unitId,
    };
    if (input.sizeId !== undefined) payload.sizeId = input.sizeId;
    return payload;
  }

  return {
    async listOptions(kind: CatalogKind, pagination?: PaginationInput): Promise<Page<CatalogOption>> {
      return get(withPagination(`/api/v1/${CATALOG_RESOURCES[kind]}`, pagination),
        (body) => readPage(body, readCatalogOption));
    },

    async getOption(kind: CatalogKind, id: string): Promise<CatalogOption> {
      return get(`/api/v1/${CATALOG_RESOURCES[kind]}/${id}`, readCatalogOption);
    },

    async createOption(kind: CatalogKind, input: NewCatalogOptionInput): Promise<CatalogOption> {
      return post(`/api/v1/${CATALOG_RESOURCES[kind]}`, createOptionPayload(input), readCatalogOption);
    },

    async listItems(pagination?: PaginationInput): Promise<Page<StockItem>> {
      return get(withPagination('/api/v1/stock-items', pagination),
        (body) => readPage(body, readStockItem));
    },

    async getItem(id: string): Promise<StockItem> {
      return get(`/api/v1/stock-items/${id}`, readStockItem);
    },

    async createItem(input: NewStockItemInput): Promise<StockItem> {
      return post('/api/v1/stock-items', createItemPayload(input), readStockItem);
    },

    async listOrigins(filter?: StockOriginFilter, pagination?: PaginationInput): Promise<Page<StockOrigin>> {
      return get(withOriginFilter('/api/v1/stock-origins', filter, pagination),
        (body) => readPage(body, readStockOrigin));
    },

    async getOrigin(id: string): Promise<StockOrigin> {
      return get(`/api/v1/stock-origins/${id}`, readStockOrigin);
    },

    async createOrigin(input: NewStockOriginInput): Promise<StockOrigin> {
      const kind: CreatableStockOriginKind = input.kind;
      return post('/api/v1/stock-origins', { kind, name: input.name }, readStockOrigin);
    },
  };
}
