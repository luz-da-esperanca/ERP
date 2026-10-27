import { describe, expect, it } from 'vitest';
import { StockOriginsService } from '../../../src/modules/social-stock/application/stock-origins-service.ts';
import type { StockOriginsRepositoryPort } from '../../../src/modules/social-stock/application/stock-origins-service.ts';
import {
  CREATABLE_STOCK_ORIGIN_KINDS,
  SYSTEM_STOCK_ORIGIN_DEFINITIONS,
} from '../../../src/modules/social-stock/domain/stock-origin-types.ts';
import { InMemoryStockOriginsRepository } from '../../../src/modules/social-stock/infrastructure/in-memory-stock-origins-repository.ts';
import type { AuditTrailPort } from '../../../src/modules/shared/audit-and-idempotency.ts';
import { ApplicationError } from '../../../src/modules/shared/errors.ts';
import { isUuidV4OrV7 } from '../../../src/modules/shared/identifiers-and-time.ts';
import { InMemoryAuditTrail, InMemoryIdempotencyStore } from '../../../src/modules/shared/infrastructure/in-memory-audit-and-idempotency.ts';
import type { MutationContext, TransactionRunner } from '../../../src/modules/shared/transactions.ts';

const FIXED_NOW = new Date('2026-10-25T12:00:00.000Z');
const fixedClock = () => FIXED_NOW;
const ACTOR_ID = '01963000-0000-7000-8000-000000000002';
const OPERATION_ID = '01963000-0000-7000-8000-000000000901';

type RollbackParticipant = { checkpoint: () => () => void };
type AuditableParticipant = AuditTrailPort & RollbackParticipant;

interface TestContext {
  readonly service: StockOriginsService;
  readonly repository: InMemoryStockOriginsRepository;
  readonly auditTrail: InMemoryAuditTrail;
  readonly count: () => Promise<number>;
}

/**
 * Builds the service with a local transaction runner: every participant is
 * checkpointed before the use case runs and restored when it fails.
 */
function setup(decorateAuditTrail?: (persistent: InMemoryAuditTrail) => AuditableParticipant): TestContext {
  const repository = new InMemoryStockOriginsRepository(fixedClock);
  const persistentAuditTrail = new InMemoryAuditTrail(fixedClock);
  const auditTrail = decorateAuditTrail ? decorateAuditTrail(persistentAuditTrail) : persistentAuditTrail;
  const idempotency = new InMemoryIdempotencyStore();
  const participants: readonly RollbackParticipant[] = [repository, auditTrail, idempotency];

  const transactions: TransactionRunner<MutationContext<StockOriginsRepositoryPort>> = async (work) => {
    const rollback = participants.map((participant) => participant.checkpoint());
    try {
      return await work({ repository, auditTrail, idempotency });
    } catch (error) {
      for (const restore of rollback.reverse()) restore();
      throw error;
    }
  };

  const service = new StockOriginsService({ repository, transactions, clock: fixedClock });
  return {
    service,
    repository,
    auditTrail: persistentAuditTrail,
    count: () => repository.countStockOrigins(),
  };
}

async function expectApplicationError(run: () => Promise<unknown>, status: number, code: string): Promise<ApplicationError> {
  try {
    await run();
  } catch (error) {
    expect(error).toBeInstanceOf(ApplicationError);
    const applicationError = error as ApplicationError;
    expect(applicationError.status).toBe(status);
    expect(applicationError.code).toBe(code);
    return applicationError;
  }
  throw new Error(`Expected the operation to fail with ${String(status)}.`);
}

describe('StockOriginsService (G-02 / RF-EST-02 / RF-EST-03 / RF-BAZ-04)', () => {
  it('creates the three named donation kinds with 201, a server-generated id and the derived flags', async () => {
    const { service } = setup();

    for (const [index, kind] of CREATABLE_STOCK_ORIGIN_KINDS.entries()) {
      const created = await service.createStockOrigin({
        actorId: ACTOR_ID,
        operationId: `01963000-0000-7000-8000-0000000009${String(index + 20).padStart(2, '0')}`,
        kind,
        name: `  Sintética ${kind}  `,
      });
      expect(created.statusCode).toBe(201);
      expect(created.body).toEqual({
        id: expect.any(String),
        kind,
        name: `Sintética ${kind}`,
        isExternalDonation: true,
        isSystemManaged: false,
        createdAt: '2026-10-25T12:00:00.000Z',
      });
      expect(isUuidV4OrV7(created.body.id)).toBe(true);
    }
  });

  it('rejects invalid kinds, system kinds, and invalid names without recording anything', async () => {
    const { service, auditTrail, count } = setup();
    const invalidInputs = [
      { kind: 'DONOR', name: 'Synthetic Origin' },
      { kind: 'UNKNOWN', name: 'Ignorada' },
      { kind: 'BAZAR_TRANSFER', name: 'Transferida' },
      { kind: 'CAMPAIGN', name: '' },
      { kind: 'CAMPAIGN', name: 'x'.repeat(151) },
      { kind: 'CAMPAIGN', name: undefined },
    ];
    const before = await count();

    for (const [index, input] of invalidInputs.entries()) {
      await expectApplicationError(
        () => service.createStockOrigin({
          actorId: ACTOR_ID,
          operationId: `01963000-0000-7000-8000-0000000009${String(index).padStart(2, '0')}`,
          kind: input.kind,
          name: input.name,
        }),
        422,
        'VALIDATION_FAILED',
      );
    }

    expect(await count()).toBe(before);
    expect(auditTrail.all()).toHaveLength(0);
  });

  it('stores no idempotency confirmation for a failed creation', async () => {
    const { service, count } = setup();

    await expectApplicationError(
      () => service.createStockOrigin({ actorId: ACTOR_ID, operationId: OPERATION_ID, kind: 'UNKNOWN', name: 'Ignorada' }),
      422,
      'VALIDATION_FAILED',
    );

    // The same key is still free: a later valid payload with that key succeeds instead of conflicting.
    const created = await service.createStockOrigin({
      actorId: ACTOR_ID,
      operationId: OPERATION_ID,
      kind: 'COMPANY_DONOR',
      name: 'Sintética Empresa',
    });
    expect(created.statusCode).toBe(201);
    expect(await count()).toBe(SYSTEM_STOCK_ORIGIN_DEFINITIONS.length + 1);
  });

  it('replays the same key with the same payload without duplicating the record or the audit', async () => {
    const { service, auditTrail, count } = setup();
    const payload = { kind: 'INDIVIDUAL_DONOR', name: 'Sintética Pessoa Física' };

    const first = await service.createStockOrigin({ actorId: ACTOR_ID, operationId: OPERATION_ID, ...payload });
    const replay = await service.createStockOrigin({ actorId: ACTOR_ID, operationId: OPERATION_ID, ...payload });

    expect(first.statusCode).toBe(201);
    expect(replay.statusCode).toBe(201);
    expect(replay.body).toEqual(first.body);
    expect(await count()).toBe(SYSTEM_STOCK_ORIGIN_DEFINITIONS.length + 1);
    expect(auditTrail.all()).toHaveLength(1);
  });

  it('conflicts when the same key carries a different payload', async () => {
    const { service } = setup();

    await service.createStockOrigin({
      actorId: ACTOR_ID,
      operationId: OPERATION_ID,
      kind: 'INDIVIDUAL_DONOR',
      name: 'Sintética Pessoa Física',
    });

    await expectApplicationError(
      () => service.createStockOrigin({
        actorId: ACTOR_ID,
        operationId: OPERATION_ID,
        kind: 'CAMPAIGN',
        name: 'Campanha Sintética',
      }),
      409,
      'IDEMPOTENCY_CONFLICT',
    );
  });

  it('writes an audit entry with actor, entity, action, operation and the created snapshot', async () => {
    const { service, auditTrail } = setup();

    const created = await service.createStockOrigin({
      actorId: ACTOR_ID,
      operationId: OPERATION_ID,
      kind: 'CAMPAIGN',
      name: 'Campanha Solidária Sintética',
    });

    const entries = await auditTrail.listByEntity('STOCK_ORIGIN', created.body.id);
    expect(entries).toHaveLength(1);
    const entry = entries[0]!;
    expect(entry.actorId).toBe(ACTOR_ID);
    expect(entry.entityType).toBe('STOCK_ORIGIN');
    expect(entry.action).toBe('CREATE');
    expect(entry.before).toBeNull();
    expect(entry.after).toEqual({ ...created.body });
    expect(entry.operationId).toBe(OPERATION_ID);
    expect(entry.factDate).toBe('2026-10-25');
  });

  it('rolls back the record and leaves the key free when the audit write fails', async () => {
    let remainingFailures = 1;
    const { service, auditTrail, count } = setup((persistent) => ({
      record: async (input) => {
        if (remainingFailures > 0) {
          remainingFailures -= 1;
          throw new Error('Simulated audit failure.');
        }
        return persistent.record(input);
      },
      listByEntity: (entityType, entityId) => persistent.listByEntity(entityType, entityId),
      checkpoint: () => persistent.checkpoint(),
    }));
    const creation = {
      actorId: ACTOR_ID,
      operationId: OPERATION_ID,
      kind: 'CAMPAIGN',
      name: 'Campanha Falha',
    };

    await expect(service.createStockOrigin(creation)).rejects.toThrow('Simulated audit failure.');

    expect(await count()).toBe(SYSTEM_STOCK_ORIGIN_DEFINITIONS.length);
    expect(auditTrail.all()).toHaveLength(0);

    // No confirmation was stored, so the same key can still complete the operation exactly once.
    const retried = await service.createStockOrigin(creation);
    expect(retried.statusCode).toBe(201);
    expect(await count()).toBe(SYSTEM_STOCK_ORIGIN_DEFINITIONS.length + 1);
    expect(auditTrail.all()).toHaveLength(1);
  });

  it('lists the system records, filters by kind and search, and paginates', async () => {
    const { service } = setup();
    await service.createStockOrigin({ actorId: ACTOR_ID, operationId: '01963000-0000-7000-8000-000000000911', kind: 'CAMPAIGN', name: 'Campanha Natal Solidário' });
    await service.createStockOrigin({ actorId: ACTOR_ID, operationId: '01963000-0000-7000-8000-000000000912', kind: 'COMPANY_DONOR', name: 'Empresa Sintética Ltda' });

    const all = await service.listStockOrigins();
    expect(all.totalItems).toBe(4);
    expect(all.items.map((item) => item.name)).toEqual([
      'Campanha Natal Solidário',
      'Empresa Sintética Ltda',
      'Origem desconhecida',
      'Transferência do Bazar',
    ]);

    const systemKind = await service.listStockOrigins({ kind: 'UNKNOWN' });
    expect(systemKind.items).toHaveLength(1);
    expect(systemKind.items[0]!.isSystemManaged).toBe(true);

    const search = await service.listStockOrigins({ search: 'campanha' });
    expect(search.items.map((item) => item.name)).toEqual(['Campanha Natal Solidário']);

    const firstPage = await service.listStockOrigins(undefined, { page: 1, pageSize: 2 });
    const secondPage = await service.listStockOrigins(undefined, { page: 2, pageSize: 2 });
    expect(firstPage).toMatchObject({ page: 1, pageSize: 2, totalItems: 4, totalPages: 2 });
    expect(firstPage.items).toHaveLength(2);
    expect(secondPage.items).toHaveLength(2);
    expect(new Set([...firstPage.items, ...secondPage.items].map((item) => item.id)).size).toBe(4);
  });

  it('returns the two system records with the agreed identifiers and flags', async () => {
    const { service } = setup();

    const page = await service.listStockOrigins();
    const unknown = page.items.find((item) => item.kind === 'UNKNOWN');
    const bazar = page.items.find((item) => item.kind === 'BAZAR_TRANSFER');

    expect(page.totalItems).toBe(2);
    expect(unknown).toMatchObject({
      id: '01963000-0000-7000-8000-000000000701',
      name: 'Origem desconhecida',
      isExternalDonation: true,
      isSystemManaged: true,
      createdAt: '2026-10-25T12:00:00.000Z',
    });
    expect(bazar).toMatchObject({
      id: '01963000-0000-7000-8000-000000000702',
      name: 'Transferência do Bazar',
      isExternalDonation: false,
      isSystemManaged: true,
    });
  });

  it('fetches an origin by id and returns 404 for unknown or malformed ids', async () => {
    const { service } = setup();

    const systemOrigin = await service.getStockOriginById('01963000-0000-7000-8000-000000000702');
    expect(systemOrigin).toMatchObject({ kind: 'BAZAR_TRANSFER', isExternalDonation: false });

    await expectApplicationError(
      () => service.getStockOriginById('01963000-0000-7000-8000-0000000007ff'),
      404,
      'RESOURCE_NOT_FOUND',
    );
    await expectApplicationError(
      () => service.getStockOriginById('not-a-uuid'),
      404,
      'RESOURCE_NOT_FOUND',
    );
  });

  it('never exposes financial or CRM fields through any view', async () => {
    const { service } = setup();
    const created = await service.createStockOrigin({
      actorId: ACTOR_ID,
      operationId: OPERATION_ID,
      kind: 'INDIVIDUAL_DONOR',
      name: 'Sintética Pessoa Física',
    });

    const forbiddenKeys = [
      'value', 'estimatedValue', 'amount', 'currency', 'cpf', 'cnpj',
      'email', 'phone', 'address', 'campaignGoal', 'active', 'version', 'updatedAt',
    ];
    for (const view of [created.body, ...(await service.listStockOrigins()).items]) {
      for (const key of forbiddenKeys) {
        expect(Object.keys(view)).not.toContain(key);
      }
    }
  });
});
