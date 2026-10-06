import { z } from 'zod';

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export interface ApiRequestOptions {
  method?: RequestMethod;
  body?: unknown;
  idempotencyKey?: string;
}
const failureSchema = z.object({
  error: z.object({
    code: z.string(),
    requestId: z.string(),
    details: z.unknown().optional(),
  }),
});
export class ApiRequestError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly requestId: string | null = null,
    readonly details?: unknown,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(`API request failed: ${code}`);
  }
}

export class ApiClient {
  private readonly unauthorizedListeners = new Set<() => void>();
  constructor(
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}
  subscribeUnauthorized(listener: () => void): () => void {
    this.unauthorizedListeners.add(listener);
    return () => {
      this.unauthorizedListeners.delete(listener);
    };
  }

  async request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: ApiRequestOptions = {},
  ): Promise<T> {
    const response = await this.send(path, options);
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new ApiRequestError('INVALID_RESPONSE', response.status);
    }
    const result = schema.safeParse(value);
    if (!result.success)
      throw new ApiRequestError('INVALID_RESPONSE', response.status);
    return result.data;
  }
  async requestEmpty(path: string, options: ApiRequestOptions): Promise<void> {
    const response = await this.send(path, options);
    if (response.status !== 204)
      throw new ApiRequestError('INVALID_RESPONSE', response.status);
  }
  private async send(
    path: string,
    options: ApiRequestOptions,
  ): Promise<Response> {
    const method = options.method ?? 'GET';
    const headers: Record<string, string> = {};
    if (method !== 'GET') {
      headers['Content-Type'] = 'application/json';
      headers['X-ERP-Request'] = '1';
    }
    if (options.idempotencyKey)
      headers['Idempotency-Key'] = z.uuid().parse(options.idempotencyKey);
    let response: Response;
    try {
      response = await this.fetcher(`/api/v1${path}`, {
        method,
        credentials: 'include',
        cache: 'no-store',
        headers,
        ...(options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
      });
    } catch {
      throw new ApiRequestError('NETWORK_ERROR', 0);
    }
    if (response.status === 401)
      this.unauthorizedListeners.forEach((listener) => listener());
    if (!response.ok) {
      let value: unknown;
      try {
        value = await response.json();
      } catch {
        throw new ApiRequestError('INVALID_RESPONSE', response.status);
      }
      const failure = failureSchema.safeParse(value);
      if (!failure.success)
        throw new ApiRequestError('INVALID_RESPONSE', response.status);
      const { error } = failure.data;
      const retryAfter = response.headers.get('Retry-After');
      throw new ApiRequestError(
        error.code,
        response.status,
        error.requestId,
        error.details,
        retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : null,
      );
    }
    return response;
  }
}
