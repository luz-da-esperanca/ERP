export interface Pagination {
  readonly page: number;
  readonly pageSize: number;
}

export interface Page<Item> extends Pagination {
  readonly items: readonly Item[];
  readonly totalItems: number;
  readonly totalPages: number;
}

export const DEFAULT_PAGINATION: Pagination = Object.freeze({ page: 1, pageSize: 20 });

export function buildPage<Item>(items: readonly Item[], totalItems: number, pagination: Pagination): Page<Item> {
  return { items, ...pagination, totalItems, totalPages: Math.ceil(totalItems / pagination.pageSize) };
}
