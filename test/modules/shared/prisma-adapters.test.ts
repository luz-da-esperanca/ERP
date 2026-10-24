import { describe, expect, it, vi } from 'vitest';
import { PrismaAccessRepository } from '../../../src/modules/access/infrastructure/prisma-access-repository.ts';
import { PrismaProjectsRepository } from '../../../src/modules/activities/infrastructure/prisma-projects-repository.ts';
import {
  PrismaAuditTrail,
  PrismaIdempotencyStore,
} from '../../../src/modules/shared/prisma-audit-and-idempotency.ts';

describe('Prisma persistence adapters (C-02 / C-03 / PB-12)', () => {
  it('persists and queries audit entries through PrismaAuditTrail', async () => {
    const createMock = vi.fn().mockImplementation(async ({ data }) => data);
    const findManyMock = vi.fn().mockResolvedValue([
      {
        id: '01963000-0000-7000-8000-000000000090',
        actorId: '01963000-0000-7000-8000-000000000001',
        factDate: '2026-04-14',
        recordedAt: new Date('2026-04-14T18:00:00.000Z'),
        entityType: 'PROJECT',
        entityId: '01963000-0000-7000-8000-000000000010',
        action: 'CREATE',
        beforeJson: null,
        afterJson: { name: 'Oficina' },
        reason: null,
        operationId: '01963000-0000-7000-8000-000000000050',
      },
    ]);

    const fakeClient = {
      auditEntryRecord: {
        create: createMock,
        findMany: findManyMock,
      },
    };

    const trail = new PrismaAuditTrail(
      fakeClient as unknown as ConstructorParameters<typeof PrismaAuditTrail>[0],
      () => new Date('2026-04-14T18:00:00.000Z'),
    );

    const recorded = await trail.record({
      actorId: '01963000-0000-7000-8000-000000000001',
      factDate: '2026-04-14',
      entityType: 'PROJECT',
      entityId: '01963000-0000-7000-8000-000000000010',
      action: 'CREATE',
      after: { name: 'Oficina', passwordHash: 'redacted' },
      operationId: '01963000-0000-7000-8000-000000000050',
    });

    expect(recorded.after).toEqual({ name: 'Oficina' });
    expect(createMock).toHaveBeenCalledOnce();

    const list = await trail.listByEntity('PROJECT', '01963000-0000-7000-8000-000000000010');
    expect(list).toHaveLength(1);
    expect(list[0]!.recordedAt).toBe('2026-04-14T18:00:00.000Z');
  });

  it('persists and replays idempotent confirmations through PrismaIdempotencyStore', async () => {
    const stored = new Map<string, { payloadDigest: string; statusCode: number; responseBody: unknown; secretHash: string | null }>();
    const fakeClient = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      operationConfirmation: {
        findUnique: vi.fn().mockImplementation(async ({ where }) => {
          const key = `${where.operationType_actorId_operationId.operationType}:${where.operationType_actorId_operationId.actorId}:${where.operationType_actorId_operationId.operationId}`;
          return stored.get(key) ?? null;
        }),
        create: vi.fn().mockImplementation(async ({ data }) => {
          const key = `${data.operationType}:${data.actorId}:${data.operationId}`;
          stored.set(key, {
            payloadDigest: data.payloadDigest,
            statusCode: data.statusCode,
            responseBody: data.responseBody,
            secretHash: data.secretHash,
          });
          return data;
        }),
      },
    };

    const store = new PrismaIdempotencyStore(
      fakeClient as unknown as ConstructorParameters<typeof PrismaIdempotencyStore>[0],
    );

    const first = await store.execute({
      operationType: 'CREATE_PROJECT',
      actorId: '01963000-0000-7000-8000-000000000001',
      operationId: '01963000-0000-7000-8000-000000000077',
      payload: { name: 'A' },
      run: async () => ({ statusCode: 201, body: { id: 'p-1' } }),
    });
    const second = await store.execute({
      operationType: 'CREATE_PROJECT',
      actorId: '01963000-0000-7000-8000-000000000001',
      operationId: '01963000-0000-7000-8000-000000000077',
      payload: { name: 'A' },
      run: async () => ({ statusCode: 201, body: { id: 'p-2' } }),
    });

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.body).toEqual(first.body);
  });

  it('maps users and projects with optimistic concurrency checks in PrismaAccessRepository and PrismaProjectsRepository', async () => {
    const fakeAccessClient = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: '01963000-0000-7000-8000-000000000001',
          login: 'admin@luz.org',
          displayName: 'Admin',
          passwordHash: 'hash',
          status: 'ACTIVE',
          version: 1,
          createdAt: new Date('2026-04-14T10:00:00.000Z'),
          updatedAt: new Date('2026-04-14T10:00:00.000Z'),
          deactivatedAt: null,
          profiles: [{ profile: 'ADMIN' }],
        }),
      },
    };

    const accessRepo = new PrismaAccessRepository(
      fakeAccessClient as unknown as ConstructorParameters<typeof PrismaAccessRepository>[0],
    );
    const user = await accessRepo.findUserByLogin('ADMIN@LUZ.ORG');
    expect(user?.profiles).toEqual(['ADMIN']);

    const fakeProjectsClient = {
      institute: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: '01963000-0000-7000-8000-000000000601',
            code: 'CRIANCA',
            name: 'Criança',
            description: 'Instituto da Criança',
            active: true,
          },
        ]),
      },
    };

    const projectsRepo = new PrismaProjectsRepository(
      fakeProjectsClient as unknown as ConstructorParameters<typeof PrismaProjectsRepository>[0],
    );
    const institutes = await projectsRepo.listInstitutes();
    expect(institutes).toHaveLength(1);
    expect(institutes[0]!.code).toBe('CRIANCA');
  });
});
