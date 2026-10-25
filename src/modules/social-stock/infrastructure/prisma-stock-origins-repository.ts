import { DEFAULT_PAGINATION, type Pagination } from '../../shared/pagination.ts';
import type { Prisma, StockOrigin as StockOriginRow } from '../../../server/generated/prisma/client.ts';
import type { StockOriginsRepositoryPort } from '../application/stock-origins-service.ts';
import type {
  StockOriginFilter,
  StockOriginKind,
  StockOriginRecord,
} from '../domain/stock-origin-types.ts';

function mapStockOriginRow(row: StockOriginRow): StockOriginRecord {
  return {
    id: row.id,
    kind: row.kind as StockOriginKind,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  };
}

export class PrismaStockOriginsRepository implements StockOriginsRepositoryPort {
  private readonly client: Prisma.TransactionClient;

  constructor(client: Prisma.TransactionClient) {
    this.client = client;
  }

  async listStockOrigins(
    filter?: StockOriginFilter,
    pagination: Pagination = DEFAULT_PAGINATION,
  ): Promise<readonly StockOriginRecord[]> {
    const rows = await this.client.stockOrigin.findMany({
      where: this.buildFilter(filter),
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => mapStockOriginRow(row));
  }

  async countStockOrigins(filter?: StockOriginFilter): Promise<number> {
    return this.client.stockOrigin.count({ where: this.buildFilter(filter) });
  }

  async findStockOriginById(id: string): Promise<StockOriginRecord | null> {
    const row = await this.client.stockOrigin.findUnique({ where: { id } });
    return row ? mapStockOriginRow(row) : null;
  }

  async createStockOrigin(record: StockOriginRecord): Promise<StockOriginRecord> {
    const created = await this.client.stockOrigin.create({
      data: {
        id: record.id,
        kind: record.kind,
        name: record.name,
        createdAt: new Date(record.createdAt),
      },
    });
    return mapStockOriginRow(created);
  }

  private buildFilter(filter?: StockOriginFilter): Prisma.StockOriginWhereInput {
    const search = filter?.search?.trim();
    return {
      ...(filter?.kind ? { kind: filter.kind } : {}),
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };
  }
}
