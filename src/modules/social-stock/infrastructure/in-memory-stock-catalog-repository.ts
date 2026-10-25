import type { StockCatalogRepositoryPort } from '../application/stock-catalog-service.ts';
import type { CatalogKind, CatalogOption, StockItemView } from '../domain/stock-catalog.ts';
import { buildPage, type Pagination } from '../../shared/pagination.ts';

export class InMemoryStockCatalogRepository implements StockCatalogRepositoryPort {
  private options = new Map<CatalogKind, Map<string, CatalogOption>>();
  private items = new Map<string, StockItemView[]>();

  async listOptions(kind: CatalogKind, pagination: Pagination) {
    return this.page([...(this.options.get(kind)?.values() ?? [])], pagination);
  }

  async findOption(kind: CatalogKind, id: string) {
    return this.options.get(kind)?.get(id) ?? null;
  }

  findOptionForUse(kind: CatalogKind, id: string) {
    return this.findOption(kind, id);
  }

  async createOption(kind: CatalogKind, option: CatalogOption) {
    const options = this.options.get(kind) ?? new Map<string, CatalogOption>();
    options.set(option.id, structuredClone(option));
    this.options.set(kind, options);
  }

  async updateOption(kind: CatalogKind, option: CatalogOption, expectedVersion: number) {
    if (this.options.get(kind)?.get(option.id)?.version !== expectedVersion) return false;
    await this.createOption(kind, option);
    return true;
  }

  async listItems(pagination: Pagination) {
    return this.page([...this.items.values()].flatMap((revisions) => revisions.slice(-1)), pagination,
      (a, b) => a.id.localeCompare(b.id));
  }

  async findItem(id: string, version?: number) {
    const revisions = this.items.get(id);
    const item = version === undefined ? revisions?.at(-1) : revisions?.find((revision) => revision.version === version);
    return item ? structuredClone(item) : null;
  }

  async createItem(item: StockItemView) {
    this.items.set(item.id, [structuredClone(item)]);
  }

  async updateItem(item: StockItemView, expectedVersion: number) {
    const revisions = this.items.get(item.id);
    if (!revisions || revisions.at(-1)?.version !== expectedVersion) return false;
    revisions.push(structuredClone(item));
    return true;
  }

  private page<T extends { readonly name: string; readonly id: string }>(records: T[], pagination: Pagination,
    compare: (a: T, b: T) => number = (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)) {
    records.sort(compare);
    const offset = (pagination.page - 1) * pagination.pageSize;
    return buildPage(structuredClone(records.slice(offset, offset + pagination.pageSize)), records.length, pagination);
  }

  checkpoint(): () => void {
    const options = structuredClone(this.options);
    const items = structuredClone(this.items);
    return () => { this.options = options; this.items = items; };
  }
}
