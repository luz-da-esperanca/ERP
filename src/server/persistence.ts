import type { AccessRepositoryPort } from '../modules/access/application/access-service.ts';
import { InMemoryAccessRepository, type SeedUserInput } from '../modules/access/infrastructure/in-memory-access-repository.ts';
import { PrismaAccessRepository } from '../modules/access/infrastructure/prisma-access-repository.ts';
import type { ProjectsRepositoryPort } from '../modules/activities/application/projects-service.ts';
import { InMemoryProjectsRepository } from '../modules/activities/infrastructure/in-memory-projects-repository.ts';
import { PrismaProjectsRepository } from '../modules/activities/infrastructure/prisma-projects-repository.ts';
import { InMemoryAuditTrail, InMemoryIdempotencyStore } from '../modules/shared/infrastructure/in-memory-audit-and-idempotency.ts';
import { PrismaAuditTrail, PrismaIdempotencyStore } from '../modules/shared/prisma-audit-and-idempotency.ts';
import type { MutationContext, TransactionRunner } from '../modules/shared/transactions.ts';
import type { StockOriginsRepositoryPort } from '../modules/social-stock/application/stock-origins-service.ts';
import { InMemoryStockOriginsRepository } from '../modules/social-stock/infrastructure/in-memory-stock-origins-repository.ts';
import { PrismaStockOriginsRepository } from '../modules/social-stock/infrastructure/prisma-stock-origins-repository.ts';
import type { Prisma, PrismaClient } from './generated/prisma/client.ts';
import { translatePersistenceError } from './persistence-errors.ts';

export interface Persistence {
  readonly accessRepository: AccessRepositoryPort;
  readonly projectsRepository: ProjectsRepositoryPort;
  readonly stockOriginsRepository: StockOriginsRepositoryPort;
  readonly accessTransactions: TransactionRunner<MutationContext<AccessRepositoryPort>>;
  readonly projectTransactions: TransactionRunner<MutationContext<ProjectsRepositoryPort>>;
  readonly stockOriginTransactions: TransactionRunner<MutationContext<StockOriginsRepositoryPort>>;
}

export function createPrismaPersistence(client: PrismaClient, clock: () => Date = () => new Date()): Persistence {
  const accessRepository = new PrismaAccessRepository(client);
  const projectsRepository = new PrismaProjectsRepository(client);
  const stockOriginsRepository = new PrismaStockOriginsRepository(client);
  async function run<Result>(work: (transaction: Prisma.TransactionClient) => Promise<Result>): Promise<Result> {
    try {
      return await client.$transaction(work, { maxWait: 10_000, timeout: 10_000 });
    } catch (error) {
      // Translate only after Prisma has rolled back the complete operation.
      throw translatePersistenceError(error) ?? error;
    }
  }
  return {
    accessRepository,
    projectsRepository,
    stockOriginsRepository,
    accessTransactions: (work) => run((transaction) => work({
      repository: new PrismaAccessRepository(transaction),
      auditTrail: new PrismaAuditTrail(transaction, clock),
      idempotency: new PrismaIdempotencyStore(transaction, clock),
    })),
    projectTransactions: (work) => run((transaction) => work({
      repository: new PrismaProjectsRepository(transaction),
      auditTrail: new PrismaAuditTrail(transaction, clock),
      idempotency: new PrismaIdempotencyStore(transaction, clock),
    })),
    stockOriginTransactions: (work) => run((transaction) => work({
      repository: new PrismaStockOriginsRepository(transaction),
      auditTrail: new PrismaAuditTrail(transaction, clock),
      idempotency: new PrismaIdempotencyStore(transaction, clock),
    })),
  };
}

export function createInMemoryPersistence(
  seedUsers: readonly SeedUserInput[],
  clock: () => Date,
  auditTrail = new InMemoryAuditTrail(clock),
): Persistence {
  const accessRepository = new InMemoryAccessRepository(seedUsers);
  const projectsRepository = new InMemoryProjectsRepository();
  const stockOriginsRepository = new InMemoryStockOriginsRepository(clock);
  const idempotency = new InMemoryIdempotencyStore();
  const participants = [accessRepository, projectsRepository, stockOriginsRepository, auditTrail, idempotency];
  let pending: Promise<unknown> = Promise.resolve();
  function runner<Repository>(repository: Repository): TransactionRunner<MutationContext<Repository>> {
    return (work) => {
      const result = pending.then(async () => {
        const rollback = participants.map((participant) => participant.checkpoint());
        try {
          return await work({ repository, auditTrail, idempotency });
        } catch (error) {
          for (const restore of rollback.reverse()) restore();
          throw error;
        }
      });
      pending = result.catch(() => {});
      return result;
    };
  }
  return { accessRepository, projectsRepository, stockOriginsRepository,
    accessTransactions: runner(accessRepository), projectTransactions: runner(projectsRepository),
    stockOriginTransactions: runner(stockOriginsRepository) };
}
