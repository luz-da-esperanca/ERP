import { Prisma } from '../../../server/generated/prisma/client.ts';
import type { StockCatalogRepositoryPort } from '../application/stock-catalog-service.ts';
import type { CatalogKind, CatalogOption, NewCatalogOption, NewStockItem, StockItemView } from '../domain/stock-catalog.ts';
import { catalogCodeCapacityError } from '../domain/stock-catalog.ts';
import { buildPage, type Pagination } from '../../shared/pagination.ts';

interface OptionRow {
  readonly id: string;
  readonly code: string;
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

function revisionData(item: NewStockItem) {
  return { id: item.revisionId, version: item.version, name: item.name, categoryId: item.category.id,
    categoryName: item.category.name, unitId: item.unit.id, unitName: item.unit.name, unitPrecision: item.unit.precision,
    sizeId: item.size?.id ?? null, sizeName: item.size?.name ?? null, isActive: item.isActive, recordedAt: new Date(item.updatedAt) };
}

const REVISION_CODE_RELATIONS = {
  category: { select: { code: true } }, unit: { select: { code: true } }, size: { select: { code: true } },
} satisfies Prisma.StockItemRevisionInclude;

function itemView(row: Prisma.StockItemRevisionGetPayload<{ include: typeof REVISION_CODE_RELATIONS }>, createdAt: Date, code: string): StockItemView {
  return { id: row.itemId, code, revisionId: row.id, version: row.version, name: row.name,
    category: { id: row.categoryId, code: row.category.code, name: row.categoryName },
    unit: { id: row.unitId, code: row.unit.code, name: row.unitName, precision: row.unitPrecision },
    size: row.sizeId !== null && row.sizeName !== null && row.size !== null ? { id: row.sizeId, code: row.size.code, name: row.sizeName } : null,
    isActive: row.isActive, createdAt: createdAt.toISOString(), updatedAt: row.recordedAt.toISOString() };
}

function isCodeSequenceExhaustion(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const adapterError = error.meta?.driverAdapterError;
  const cause = adapterError !== null && typeof adapterError === 'object' && 'cause' in adapterError ? adapterError.cause : undefined;
  return cause !== null && typeof cause === 'object' && 'originalCode' in cause && cause.originalCode === '2200H';
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

  async createOption(kind: CatalogKind, option: NewCatalogOption) {
    const data = { id: option.id, name: option.name, isActive: option.isActive, version: option.version,
      createdAt: new Date(option.createdAt), updatedAt: new Date(option.updatedAt) };
    try {
      if (kind === 'CATEGORY') return optionView(await this.client.stockCategory.create({ data }));
      if (kind === 'SIZE') return optionView(await this.client.stockSize.create({ data }));
      if (option.precision === null) throw new Error('A stock unit must define precision.');
      return optionView(await this.client.stockUnit.create({ data: { ...data, precision: option.precision } }));
    } catch (error) {
      throw isCodeSequenceExhaustion(error) ? catalogCodeCapacityError() : error;
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
        orderBy: { id: 'asc' }, include: { revisions: { orderBy: { version: 'desc' }, take: 1, include: REVISION_CODE_RELATIONS } } }),
      this.client.stockItem.count(),
    ]);
    return buildPage(rows.map((row) => {
      const revision = row.revisions[0];
      if (!revision) throw new Error('A persisted stock item must have a revision.');
      return itemView(revision, row.createdAt, row.code);
    }), count, pagination);
  }

  async findItem(id: string, version?: number) {
    const row = await this.client.stockItem.findUnique({ where: { id }, include: { revisions: {
      ...(version === undefined ? {} : { where: { version } }), orderBy: { version: 'desc' }, take: 1, include: REVISION_CODE_RELATIONS } } });
    const revision = row?.revisions[0];
    return row && revision ? itemView(revision, row.createdAt, row.code) : null;
  }

  async createItem(item: NewStockItem) {
    try {
      const created = await this.client.stockItem.create({ data: { id: item.id, version: item.version,
        createdAt: new Date(item.createdAt), updatedAt: new Date(item.updatedAt), revisions: { create: revisionData(item) } } });
      return { ...item, code: created.code };
    } catch (error) {
      throw isCodeSequenceExhaustion(error) ? catalogCodeCapacityError() : error;
    }
  }

  async updateItem(item: StockItemView, expectedVersion: number) {
    const result = await this.client.stockItem.updateMany({ where: { id: item.id, version: expectedVersion },
      data: { version: item.version, updatedAt: new Date(item.updatedAt) } });
    if (result.count !== 1) return false;
    await this.client.stockItemRevision.create({ data: { ...revisionData(item), itemId: item.id } });
    return true;
  }
}
