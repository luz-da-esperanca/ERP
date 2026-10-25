import type { Prisma } from '../../../server/generated/prisma/client.ts';
import type { StockCatalogRepositoryPort } from '../application/stock-catalog-service.ts';
import type { CatalogKind, CatalogOption, StockItemView } from '../domain/stock-catalog.ts';
import { buildPage, type Pagination } from '../../shared/pagination.ts';

interface OptionRow {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly version: number;
  readonly precision?: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function optionView(row: OptionRow): CatalogOption {
  return { ...row, precision: row.precision ?? null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

function revisionData(item: StockItemView) {
  return { id: item.revisionId, version: item.version, name: item.name, categoryId: item.category.id,
    categoryName: item.category.name, unitId: item.unit.id, unitName: item.unit.name, unitPrecision: item.unit.precision,
    sizeId: item.size?.id ?? null, sizeName: item.size?.name ?? null, isActive: item.isActive, recordedAt: new Date(item.updatedAt) };
}

function itemView(row: Prisma.StockItemRevisionGetPayload<object>, createdAt: Date): StockItemView {
  return { id: row.itemId, revisionId: row.id, version: row.version, name: row.name,
    category: { id: row.categoryId, name: row.categoryName },
    unit: { id: row.unitId, name: row.unitName, precision: row.unitPrecision },
    size: row.sizeId !== null && row.sizeName !== null ? { id: row.sizeId, name: row.sizeName } : null,
    isActive: row.isActive, createdAt: createdAt.toISOString(), updatedAt: row.recordedAt.toISOString() };
}

export class PrismaStockCatalogRepository implements StockCatalogRepositoryPort {
  private readonly client: Prisma.TransactionClient;

  constructor(client: Prisma.TransactionClient) {
    this.client = client;
  }

  async listOptions(kind: CatalogKind, pagination: Pagination) {
    const query = { skip: (pagination.page - 1) * pagination.pageSize, take: pagination.pageSize,
      orderBy: [{ name: 'asc' }, { id: 'asc' }] satisfies Prisma.StockCategoryOrderByWithRelationInput[] };
    const [rows, count] = kind === 'CATEGORY'
      ? await Promise.all([this.client.stockCategory.findMany(query), this.client.stockCategory.count()])
      : kind === 'UNIT'
        ? await Promise.all([this.client.stockUnit.findMany(query), this.client.stockUnit.count()])
        : await Promise.all([this.client.stockSize.findMany(query), this.client.stockSize.count()]);
    return buildPage(rows.map(optionView), count, pagination);
  }

  async findOption(kind: CatalogKind, id: string) {
    const row = kind === 'CATEGORY' ? await this.client.stockCategory.findUnique({ where: { id } })
      : kind === 'UNIT' ? await this.client.stockUnit.findUnique({ where: { id } })
        : await this.client.stockSize.findUnique({ where: { id } });
    return row ? optionView(row) : null;
  }

  async findOptionForUse(kind: CatalogKind, id: string) {
    // Keep the referenced row stable until item, audit and confirmation commit together.
    if (kind === 'CATEGORY') await this.client.$queryRaw`SELECT id FROM stock_categories WHERE id = ${id}::uuid FOR SHARE`;
    else if (kind === 'UNIT') await this.client.$queryRaw`SELECT id FROM stock_units WHERE id = ${id}::uuid FOR SHARE`;
    else await this.client.$queryRaw`SELECT id FROM stock_sizes WHERE id = ${id}::uuid FOR SHARE`;
    return this.findOption(kind, id);
  }

  async createOption(kind: CatalogKind, option: CatalogOption) {
    const data = { id: option.id, name: option.name, isActive: option.isActive, version: option.version,
      createdAt: new Date(option.createdAt), updatedAt: new Date(option.updatedAt) };
    if (kind === 'CATEGORY') await this.client.stockCategory.create({ data });
    else if (kind === 'SIZE') await this.client.stockSize.create({ data });
    else {
      if (option.precision === null) throw new Error('A stock unit must define precision.');
      await this.client.stockUnit.create({ data: { ...data, precision: option.precision } });
    }
  }

  async updateOption(kind: CatalogKind, option: CatalogOption, expectedVersion: number) {
    const query = { where: { id: option.id, version: expectedVersion }, data: {
      isActive: option.isActive, version: option.version, updatedAt: new Date(option.updatedAt) } };
    const result = kind === 'CATEGORY' ? await this.client.stockCategory.updateMany(query)
      : kind === 'UNIT' ? await this.client.stockUnit.updateMany(query) : await this.client.stockSize.updateMany(query);
    return result.count === 1;
  }

  async listItems(pagination: Pagination) {
    const [rows, count] = await Promise.all([
      this.client.stockItem.findMany({ skip: (pagination.page - 1) * pagination.pageSize, take: pagination.pageSize,
        orderBy: { id: 'asc' }, include: { revisions: { orderBy: { version: 'desc' }, take: 1 } } }),
      this.client.stockItem.count(),
    ]);
    return buildPage(rows.map((row) => {
      const revision = row.revisions[0];
      if (!revision) throw new Error('A persisted stock item must have a revision.');
      return itemView(revision, row.createdAt);
    }), count, pagination);
  }

  async findItem(id: string, version?: number) {
    const row = await this.client.stockItem.findUnique({ where: { id }, include: { revisions: {
      ...(version === undefined ? {} : { where: { version } }), orderBy: { version: 'desc' }, take: 1 } } });
    const revision = row?.revisions[0];
    return row && revision ? itemView(revision, row.createdAt) : null;
  }

  async createItem(item: StockItemView) {
    await this.client.stockItem.create({ data: { id: item.id, version: item.version,
      createdAt: new Date(item.createdAt), updatedAt: new Date(item.updatedAt), revisions: { create: revisionData(item) } } });
  }

  async updateItem(item: StockItemView, expectedVersion: number) {
    const result = await this.client.stockItem.updateMany({ where: { id: item.id, version: expectedVersion },
      data: { version: item.version, updatedAt: new Date(item.updatedAt) } });
    if (result.count !== 1) return false;
    await this.client.stockItemRevision.create({ data: { ...revisionData(item), itemId: item.id } });
    return true;
  }
}
