import { describe, expect, it, vi } from 'vitest';
import { PrismaStockOriginsRepository } from '../../../src/modules/social-stock/infrastructure/prisma-stock-origins-repository.ts';

const KIND = 'CAMPAIGN';

interface FakeClientOptions {
  readonly findMany?: unknown;
  readonly count?: number;
  readonly findUnique?: unknown;
  readonly create?: unknown;
}

function setupClient(options: FakeClientOptions = {}) {
  const findMany = vi.fn().mockResolvedValue(options.findMany ?? []);
  const count = vi.fn().mockResolvedValue(options.count ?? 0);
  const findUnique = vi.fn().mockResolvedValue(options.findUnique ?? null);
  const create = vi.fn().mockImplementation(async ({ data }: { data: unknown }) => data);
  const fakeClient = {
    stockOrigin: {
      findMany,
      count,
      findUnique,
      create,
    },
  };
  const repository = new PrismaStockOriginsRepository(
    fakeClient as unknown as ConstructorParameters<typeof PrismaStockOriginsRepository>[0],
  );
  return { repository, findMany, count, findUnique, create };
}

describe('PrismaStockOriginsRepository (G-02 / RF-EST-02 / TG-01-04)', () => {
  it('builds the kind and case-insensitive search filter with pagination and name/id ordering', async () => {
    const { repository, findMany } = setupClient();

    await repository.listStockOrigins(
      { kind: KIND, search: '  campanha  ' },
      { page: 2, pageSize: 10 },
    );

    expect(findMany).toHaveBeenCalledOnce();
    expect(findMany).toHaveBeenCalledWith({
      where: {
        kind: KIND,
        name: { contains: 'campanha', mode: 'insensitive' },
      },
      skip: 10,
      take: 10,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  });

  it('counts with the same filter and lists with default pagination when none is informed', async () => {
    const { repository, findMany, count } = setupClient({ count: 7 });

    const total = await repository.countStockOrigins({ kind: KIND });
    await repository.listStockOrigins();

    expect(total).toBe(7);
    expect(count).toHaveBeenCalledWith({ where: { kind: KIND } });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 20, where: {} }));
  });

  it('maps rows to records, converting createdAt to ISO', async () => {
    const { repository } = setupClient({
      findMany: [
        {
          id: '01963000-0000-7000-8000-000000000701',
          kind: 'UNKNOWN',
          name: 'Origem desconhecida',
          createdAt: new Date('2026-10-25T12:00:00.000Z'),
        },
        {
          id: '01963000-0000-7000-8000-000000000702',
          kind: 'BAZAR_TRANSFER',
          name: 'Transferência do Bazar',
          createdAt: new Date('2026-10-25T12:00:00.000Z'),
        },
      ],
    });

    const records = await repository.listStockOrigins();

    expect(records).toEqual([
      {
        id: '01963000-0000-7000-8000-000000000701',
        kind: 'UNKNOWN',
        name: 'Origem desconhecida',
        createdAt: '2026-10-25T12:00:00.000Z',
      },
      {
        id: '01963000-0000-7000-8000-000000000702',
        kind: 'BAZAR_TRANSFER',
        name: 'Transferência do Bazar',
        createdAt: '2026-10-25T12:00:00.000Z',
      },
    ]);
  });

  it('finds one origin by id and returns null when it does not exist', async () => {
    const existing = {
      id: '01963000-0000-7000-8000-000000000701',
      kind: 'UNKNOWN',
      name: 'Origem desconhecida',
      createdAt: new Date('2026-10-25T12:00:00.000Z'),
    };

    const missing = setupClient({ findUnique: null });
    expect(await missing.repository.findStockOriginById(existing.id)).toBeNull();
    expect(missing.findUnique).toHaveBeenCalledWith({ where: { id: existing.id } });

    const found = setupClient({ findUnique: existing });
    const record = await found.repository.findStockOriginById(existing.id);
    expect(record).toEqual({
      id: existing.id,
      kind: 'UNKNOWN',
      name: 'Origem desconhecida',
      createdAt: '2026-10-25T12:00:00.000Z',
    });
  });

  it('creates a row with exactly the record fields', async () => {
    const { repository, create } = setupClient();

    await repository.createStockOrigin({
      id: '01963000-0000-7000-8000-000000000901',
      kind: 'INDIVIDUAL_DONOR',
      name: 'Sintética Pessoa Física',
      createdAt: '2026-10-25T12:00:00.000Z',
    });

    expect(create).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith({
      data: {
        id: '01963000-0000-7000-8000-000000000901',
        kind: 'INDIVIDUAL_DONOR',
        name: 'Sintética Pessoa Física',
        createdAt: new Date('2026-10-25T12:00:00.000Z'),
      },
    });
  });

  it('never requests or returns fields beyond id, kind, name and createdAt', async () => {
    const { repository, findMany, create } = setupClient({ findMany: [] });

    await repository.listStockOrigins();
    await repository.countStockOrigins();
    await repository.createStockOrigin({
      id: '01963000-0000-7000-8000-000000000902',
      kind: 'COMPANY_DONOR',
      name: 'Sintética Empresa',
      createdAt: '2026-10-25T12:00:00.000Z',
    });

    const findManyArgs = findMany.mock.calls[0]![0] as { select?: unknown };
    expect(findManyArgs.select).toBeUndefined();
    const createArgs = create.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(Object.keys(createArgs.data).sort()).toEqual(['createdAt', 'id', 'kind', 'name']);
  });
});
