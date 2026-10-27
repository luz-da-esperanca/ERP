import { DEFAULT_PAGINATION, type Pagination } from '../../shared/pagination.ts';
import type { StockOriginsRepositoryPort } from '../application/stock-origins-service.ts';
import {
  SYSTEM_STOCK_ORIGIN_DEFINITIONS,
  type StockOriginFilter,
  type StockOriginRecord,
} from '../domain/stock-origin-types.ts';

export class InMemoryStockOriginsRepository implements StockOriginsRepositoryPort {
  private readonly recordsById = new Map<string, StockOriginRecord>();

  constructor(clock: () => Date = () => new Date()) {
    const seededAt = clock().toISOString();
    for (const definition of SYSTEM_STOCK_ORIGIN_DEFINITIONS) {
      this.recordsById.set(definition.id, {
        id: definition.id,
        kind: definition.kind,
        name: definition.name,
        createdAt: seededAt,
      });
    }
  }

  async listStockOrigins(
    filter?: StockOriginFilter,
    pagination: Pagination = DEFAULT_PAGINATION,
  ): Promise<readonly StockOriginRecord[]> {
    const offset = (pagination.page - 1) * pagination.pageSize;
    return this.matchingRecords(filter).slice(offset, offset + pagination.pageSize);
  }

  async countStockOrigins(filter?: StockOriginFilter): Promise<number> {
    return this.matchingRecords(filter).length;
  }

  async findStockOriginById(id: string): Promise<StockOriginRecord | null> {
    return this.recordsById.get(id.toLowerCase()) ?? this.recordsById.get(id) ?? null;
  }

  async createStockOrigin(record: StockOriginRecord): Promise<StockOriginRecord> {
    this.recordsById.set(record.id.toLowerCase(), record);
    return record;
  }

  checkpoint(): () => void {
    const snapshot = structuredClone(this.recordsById);
    return () => {
      this.recordsById.clear();
      for (const [id, record] of snapshot) this.recordsById.set(id, record);
    };
  }

  private matchingRecords(filter?: StockOriginFilter): readonly StockOriginRecord[] {
    const normalizedSearch = filter?.search?.trim().toLowerCase();

    return [...this.recordsById.values()]
      .filter((record) => {
        if (filter?.kind && record.kind !== filter.kind) return false;
        if (normalizedSearch && !record.name.toLowerCase().includes(normalizedSearch)) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id));
  }
}
