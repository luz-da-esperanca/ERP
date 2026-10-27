import type { StockCatalogRepositoryPort } from '../application/stock-catalog-service.ts';
import type { CatalogKind, CatalogOption, NewCatalogOption, NewStockItem, StockItemView } from '../domain/stock-catalog.ts';
import { catalogCodeCapacityError } from '../domain/stock-catalog.ts';
import { buildPage, type Pagination } from '../../shared/pagination.ts';

const MAX_CODE_SEQUENCE_VALUE = 9_223_372_036_854_775_807n;

export class InMemoryStockCatalogRepository implements StockCatalogRepositoryPort {
  private options = new Map<CatalogKind, Map<string, CatalogOption>>();
  private items = new Map<string, StockItemView[]>();
  // Allocations deliberately remain outside checkpoints, matching PostgreSQL sequence gaps on rollback.
  private readonly codeCounters = new Map<CatalogKind | 'ITEM', bigint>();

  private nextCode(kind: CatalogKind | 'ITEM') {
    const next = (this.codeCounters.get(kind) ?? 0n) + 1n;
    if (next > MAX_CODE_SEQUENCE_VALUE) throw catalogCodeCapacityError();
    this.codeCounters.set(kind, next);
    return `${kind === 'CATEGORY' ? 'CAT' : kind}-${next.toString().padStart(6, '0')}`;
  }

  async listOptions(kind: CatalogKind, pagination: Pagination) {
    return this.page([...(this.options.get(kind)?.values() ?? [])], pagination);
  }

  async findOption(kind: CatalogKind, id: string) {
    return this.options.get(kind)?.get(id) ?? null;
  }

  findOptionForUse(kind: CatalogKind, id: string) {
    return this.findOption(kind, id);
  }

  async createOption(kind: CatalogKind, option: NewCatalogOption) {
    const saved: CatalogOption = { ...option, code: this.nextCode(kind) };
    const options = this.options.get(kind) ?? new Map<string, CatalogOption>();
    options.set(option.id, structuredClone(saved));
    this.options.set(kind, options);
    return saved;
  }

  async updateOption(kind: CatalogKind, option: CatalogOption, expectedVersion: number) {
    if (this.options.get(kind)?.get(option.id)?.version !== expectedVersion) return false;
    this.options.get(kind)?.set(option.id, structuredClone(option));
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

  async createItem(item: NewStockItem) {
    const saved: StockItemView = { ...item, code: this.nextCode('ITEM') };
    this.items.set(item.id, [structuredClone(saved)]);
    return saved;
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
