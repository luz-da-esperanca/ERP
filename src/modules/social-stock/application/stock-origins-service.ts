import { resourceNotFoundError } from '../../shared/errors.ts';
import { generateUuidV7, isUuidV4OrV7 } from '../../shared/identifiers-and-time.ts';
import { buildPage, DEFAULT_PAGINATION, type Page, type Pagination } from '../../shared/pagination.ts';
import type { MutationContext, TransactionRunner } from '../../shared/transactions.ts';
import {
  toStockOriginView,
  validateCreateStockOriginInput,
  type StockOriginFilter,
  type StockOriginRecord,
  type StockOriginView,
} from '../domain/stock-origin-types.ts';

export interface StockOriginsRepositoryPort {
  listStockOrigins(filter?: StockOriginFilter, pagination?: Pagination): Promise<readonly StockOriginRecord[]>;
  countStockOrigins(filter?: StockOriginFilter): Promise<number>;
  findStockOriginById(id: string): Promise<StockOriginRecord | null>;
  createStockOrigin(record: StockOriginRecord): Promise<StockOriginRecord>;
}

export interface StockOriginsServiceDependencies {
  readonly repository: StockOriginsRepositoryPort;
  readonly transactions: TransactionRunner<MutationContext<StockOriginsRepositoryPort>>;
  readonly clock?: () => Date;
}

export class StockOriginsService {
  private readonly repository: StockOriginsRepositoryPort;
  private readonly transactions: TransactionRunner<MutationContext<StockOriginsRepositoryPort>>;
  private readonly clock: () => Date;

  constructor(deps: StockOriginsServiceDependencies) {
    this.repository = deps.repository;
    this.transactions = deps.transactions;
    this.clock = deps.clock ?? (() => new Date());
  }

  async listStockOrigins(
    filter?: StockOriginFilter,
    pagination: Pagination = DEFAULT_PAGINATION,
  ): Promise<Page<StockOriginView>> {
    const [records, totalItems] = await Promise.all([
      this.repository.listStockOrigins(filter, pagination),
      this.repository.countStockOrigins(filter),
    ]);
    return buildPage(records.map(toStockOriginView), totalItems, pagination);
  }

  async getStockOriginById(id: string): Promise<StockOriginView> {
    if (!isUuidV4OrV7(id)) {
      throw resourceNotFoundError('Origem de estoque não encontrada.');
    }
    const record = await this.repository.findStockOriginById(id);
    if (!record) {
      throw resourceNotFoundError('Origem de estoque não encontrada.');
    }
    return toStockOriginView(record);
  }

  async createStockOrigin(input: {
    readonly actorId: string;
    readonly operationId: string;
    readonly kind: unknown;
    readonly name: unknown;
  }): Promise<{ readonly statusCode: number; readonly body: StockOriginView }> {
    const validated = validateCreateStockOriginInput({ kind: input.kind, name: input.name });

    const result = await this.transactions(({ repository, auditTrail, idempotency }) => idempotency.execute({
      operationType: 'CREATE_STOCK_ORIGIN',
      actorId: input.actorId,
      operationId: input.operationId,
      payload: {
        kind: validated.kind,
        name: validated.name,
      },
      run: async () => {
        const now = this.clock();
        const record: StockOriginRecord = {
          id: generateUuidV7(now.getTime()),
          kind: validated.kind,
          name: validated.name,
          createdAt: now.toISOString(),
        };

        const saved = await repository.createStockOrigin(record);
        const view = toStockOriginView(saved);

        await auditTrail.record({
          actorId: input.actorId,
          entityType: 'STOCK_ORIGIN',
          entityId: saved.id,
          action: 'CREATE',
          before: null,
          after: { ...view },
          operationId: input.operationId,
        });

        return { statusCode: 201, body: view };
      },
    }));

    return { statusCode: result.statusCode, body: result.body };
  }
}
