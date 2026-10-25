import type { CatalogKind, CatalogOption, StockItemView } from '../domain/stock-catalog.ts';
import { requireCatalogName, requireUnitPrecision } from '../domain/stock-catalog.ts';
import { requireChangeReason } from '../../shared/change-reason.ts';
import { DEFAULT_PAGINATION, type Page, type Pagination } from '../../shared/pagination.ts';
import type { MutationContext, TransactionRunner } from '../../shared/transactions.ts';
import { generateUuidV7, isUuidV4OrV7 } from '../../shared/identifiers-and-time.ts';
import { resourceNotFoundError, staleVersionError, validationFailedError } from '../../shared/errors.ts';

export interface StockCatalogRepositoryPort {
  listOptions(kind: CatalogKind, pagination: Pagination): Promise<Page<CatalogOption>>;
  findOption(kind: CatalogKind, id: string): Promise<CatalogOption | null>;
  findOptionForUse(kind: CatalogKind, id: string): Promise<CatalogOption | null>;
  createOption(kind: CatalogKind, option: CatalogOption): Promise<void>;
  updateOption(kind: CatalogKind, option: CatalogOption, expectedVersion: number): Promise<boolean>;
  listItems(pagination: Pagination): Promise<Page<StockItemView>>;
  findItem(id: string, version?: number): Promise<StockItemView | null>;
  createItem(item: StockItemView): Promise<void>;
  updateItem(item: StockItemView, expectedVersion: number): Promise<boolean>;
}

interface OperationInput {
  readonly actorId: string;
  readonly operationId: string;
}

interface StockCatalogDependencies {
  readonly repository: StockCatalogRepositoryPort;
  readonly transactions: TransactionRunner<MutationContext<StockCatalogRepositoryPort>>;
  readonly clock: () => Date;
}

export class StockCatalogService {
  private readonly dependencies: StockCatalogDependencies;

  constructor(dependencies: StockCatalogDependencies) {
    this.dependencies = dependencies;
  }

  listOptions(kind: CatalogKind, pagination = DEFAULT_PAGINATION) {
    return this.dependencies.repository.listOptions(kind, pagination);
  }

  async getOption(kind: CatalogKind, id: string) {
    if (!isUuidV4OrV7(id)) throw resourceNotFoundError();
    const option = await this.dependencies.repository.findOption(kind, id);
    if (!option) throw resourceNotFoundError();
    return option;
  }

  listItems(pagination = DEFAULT_PAGINATION) {
    return this.dependencies.repository.listItems(pagination);
  }

  async getItem(id: string, version?: number) {
    if (!isUuidV4OrV7(id)) throw resourceNotFoundError();
    const item = await this.dependencies.repository.findItem(id, version);
    if (!item) throw resourceNotFoundError();
    return item;
  }

  async createOption(kind: CatalogKind, input: OperationInput & { readonly name: unknown; readonly precision?: unknown }) {
    const name = requireCatalogName(input.name);
    const precision = kind === 'UNIT' ? requireUnitPrecision(input.precision) : null;
    return this.dependencies.transactions(({ repository, auditTrail, idempotency }) => idempotency.execute({
      actorId: input.actorId, operationId: input.operationId, operationType: `CREATE_STOCK_${kind}`,
      payload: { name, precision },
      run: async () => {
        const now = this.dependencies.clock();
        const option: CatalogOption = { id: generateUuidV7(now.getTime()), name, precision,
          isActive: true, version: 1, createdAt: now.toISOString(), updatedAt: now.toISOString() };
        await repository.createOption(kind, option);
        await auditTrail.record({ actorId: input.actorId, operationId: input.operationId,
          entityType: `STOCK_${kind}`, entityId: option.id, action: 'CREATE', after: { ...option } });
        return { statusCode: 201, body: option };
      },
    }));
  }

  async updateOption(kind: CatalogKind, input: OperationInput & {
    readonly id: string; readonly version: unknown; readonly isActive: unknown; readonly reason: unknown;
  }) {
    if (!isUuidV4OrV7(input.id)) throw resourceNotFoundError();
    const version = requireVersion(input.version);
    const reason = requireChangeReason(input.reason);
    if (typeof input.isActive !== 'boolean') {
      throw validationFailedError([{ field: 'isActive', code: 'INVALID_FORMAT', message: 'Informe se a opção está ativa.' }]);
    }
    const isActive = input.isActive;
    return this.dependencies.transactions(({ repository, auditTrail, idempotency }) => idempotency.execute({
      actorId: input.actorId, operationId: input.operationId, operationType: `UPDATE_STOCK_${kind}`,
      payload: { id: input.id, version, reason, isActive },
      run: async () => {
        const current = await repository.findOption(kind, input.id);
        if (!current) throw resourceNotFoundError();
        if (current.version !== version) throw staleVersionError();
        const option = { ...current, isActive, version: version + 1, updatedAt: this.dependencies.clock().toISOString() };
        if (!await repository.updateOption(kind, option, version)) throw staleVersionError();
        await auditTrail.record({ actorId: input.actorId, operationId: input.operationId,
          entityType: `STOCK_${kind}`, entityId: option.id, action: 'UPDATE', before: { ...current }, after: { ...option }, reason });
        return { statusCode: 200, body: option };
      },
    }));
  }

  async createItem(input: OperationInput & {
    readonly name: unknown; readonly categoryId: unknown; readonly unitId: unknown; readonly sizeId?: unknown;
  }) {
    const name = requireCatalogName(input.name);
    return this.dependencies.transactions(({ repository, auditTrail, idempotency }) => idempotency.execute({
      actorId: input.actorId, operationId: input.operationId, operationType: 'CREATE_STOCK_ITEM',
      payload: { name, categoryId: input.categoryId, unitId: input.unitId, sizeId: input.sizeId ?? null },
      run: async () => {
        const references = await this.resolveReferences(repository, input);
        const now = this.dependencies.clock();
        const item: StockItemView = { id: generateUuidV7(now.getTime()), revisionId: generateUuidV7(now.getTime()),
          version: 1, name, ...references, isActive: true,
          createdAt: now.toISOString(), updatedAt: now.toISOString() };
        await repository.createItem(item);
        await auditTrail.record({ actorId: input.actorId, operationId: input.operationId,
          entityType: 'STOCK_ITEM', entityId: item.id, action: 'CREATE', after: { ...item } });
        return { statusCode: 201, body: item };
      },
    }));
  }

  async updateItem(input: OperationInput & {
    readonly id: string; readonly version: unknown; readonly reason: unknown;
    readonly name?: unknown; readonly categoryId?: unknown; readonly unitId?: unknown;
    readonly sizeId?: unknown; readonly isActive?: unknown;
  }) {
    const version = requireVersion(input.version);
    const reason = requireChangeReason(input.reason);
    if (!isUuidV4OrV7(input.id)) throw resourceNotFoundError();
    const name = input.name === undefined ? undefined : requireCatalogName(input.name);
    if ([input.name, input.categoryId, input.unitId, input.sizeId, input.isActive].every((value) => value === undefined)) {
      throw validationFailedError([{ field: 'item', code: 'CHANGE_REQUIRED', message: 'Informe ao menos um campo para alterar.' }]);
    }
    if (input.isActive !== undefined && typeof input.isActive !== 'boolean') {
      throw validationFailedError([{ field: 'isActive', code: 'INVALID_FORMAT', message: 'Informe se o item está ativo.' }]);
    }
    const isActive = input.isActive;
    return this.dependencies.transactions(({ repository, auditTrail, idempotency }) => idempotency.execute({
      actorId: input.actorId, operationId: input.operationId, operationType: 'UPDATE_STOCK_ITEM',
      payload: { id: input.id, version, reason, name, categoryId: input.categoryId,
        unitId: input.unitId, sizeId: input.sizeId, isActive },
      run: async () => {
        const current = await repository.findItem(input.id);
        if (!current) throw resourceNotFoundError();
        if (current.version !== version) throw staleVersionError();
        // Retiring an obsolete item must remain possible after its reference was retired.
        const isRetirementOnly = isActive === false && name === undefined && input.categoryId === undefined
          && input.unitId === undefined && input.sizeId === undefined;
        const references = isRetirementOnly ? { category: current.category, unit: current.unit, size: current.size }
          : await this.resolveReferences(repository, {
          categoryId: input.categoryId === undefined ? current.category.id : input.categoryId,
          unitId: input.unitId === undefined ? current.unit.id : input.unitId,
          sizeId: input.sizeId === undefined ? current.size?.id ?? null : input.sizeId,
        });
        const now = this.dependencies.clock();
        const item: StockItemView = { ...current, ...references, name: name ?? current.name,
          isActive: isActive ?? current.isActive, version: version + 1, revisionId: generateUuidV7(now.getTime()), updatedAt: now.toISOString() };
        if (!await repository.updateItem(item, version)) throw staleVersionError();
        await auditTrail.record({ actorId: input.actorId, operationId: input.operationId,
          entityType: 'STOCK_ITEM', entityId: item.id, action: 'UPDATE', before: { ...current }, after: { ...item }, reason });
        return { statusCode: 200, body: item };
      },
    }));
  }

  private async resolveReferences(repository: StockCatalogRepositoryPort, input: {
    readonly categoryId: unknown; readonly unitId: unknown; readonly sizeId?: unknown;
  }) {
    const category = await this.requireOption(repository, 'CATEGORY', input.categoryId, 'categoryId');
    const unit = await this.requireOption(repository, 'UNIT', input.unitId, 'unitId');
    const size = input.sizeId == null ? null : await this.requireOption(repository, 'SIZE', input.sizeId, 'sizeId');
    if (unit.precision === null) throw new Error('A stock unit must define precision.');
    return { category: { id: category.id, name: category.name }, unit: { id: unit.id, name: unit.name, precision: unit.precision },
      size: size ? { id: size.id, name: size.name } : null };
  }

  private async requireOption(repository: StockCatalogRepositoryPort, kind: CatalogKind, value: unknown, field: string) {
    const option = typeof value === 'string' && isUuidV4OrV7(value) ? await repository.findOptionForUse(kind, value.toLowerCase()) : null;
    if (!option?.isActive) throw validationFailedError([{ field, code: 'REFERENCE_NOT_FOUND', message: 'Selecione uma opção existente e ativa.' }]);
    return option;
  }
}

function requireVersion(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw validationFailedError([{ field: 'version', code: 'INVALID_VERSION', message: 'Informe a versão positiva do registro.' }]);
  }
  return value;
}
