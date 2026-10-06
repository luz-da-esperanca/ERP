import type { z } from 'zod';
import { ApiRequestError } from './api-client';
import type { ApiClient } from './api-client';

export function apiQuery(path: string, query: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  return params.size ? `${path}?${params.toString()}` : path;
}

export async function allApiPages<T>(
  api: ApiClient,
  path: string,
  schema: z.ZodType<{
    data: T[];
    pagination: { page: number; pageSize: number; total: number };
  }>,
  query: object = {},
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  while (true) {
    const result = await api.request(
      apiQuery(path, { ...query, page, pageSize: 100 }),
      schema,
    );
    if (result.pagination.page !== page)
      throw new ApiRequestError('INVALID_RESPONSE', 200);
    items.push(...result.data);
    if (page * result.pagination.pageSize >= result.pagination.total)
      return items;
    if (!result.data.length) throw new ApiRequestError('INVALID_RESPONSE', 200);
    page += 1;
  }
}
