import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, onTestFinished } from 'vitest';
import { hashPassword } from '../../src/modules/access/infrastructure/password-hasher.ts';
import { StockOriginsService } from '../../src/modules/social-stock/application/stock-origins-service.ts';
import { createApp } from '../../src/server/app.ts';
import { createDatabase } from '../../src/server/database.ts';
import { createPrismaPersistence } from '../../src/server/persistence.ts';
import { createIsolatedDatabase } from '../helpers/isolated-database.ts';

const controlUrl = process.env.TEST_DATABASE_URL;
if (!controlUrl) {
  throw new Error('Set TEST_DATABASE_URL to an isolated PostgreSQL database before running integration tests.');
}
let connectionString: string;
let closeIsolatedDatabase: (() => Promise<void>) | undefined;
beforeAll(async () => {
  const isolated = await createIsolatedDatabase(controlUrl);
  connectionString = isolated.connectionString;
  closeIsolatedDatabase = isolated.close;
}, 30_000);
afterAll(async () => { await closeIsolatedDatabase?.(); });

const SYSTEM_ORIGIN_IDS = [
  '01963000-0000-7000-8000-000000000701',
  '01963000-0000-7000-8000-000000000702',
];
const PASSWORD = 'SyntheticStockOriginPassword!123';

type TestDatabase = ReturnType<typeof createDatabase>;

async function purgeSyntheticOrigins(database: TestDatabase): Promise<void> {
  await database.client.stockOrigin.deleteMany({ where: { id: { notIn: SYSTEM_ORIGIN_IDS } } });
}

async function provisionCoordinator(database: TestDatabase): Promise<{ id: string; login: string }> {
  const id = randomUUID();
  const login = `stock-origin-${randomUUID()}`;
  const now = new Date();
  await database.client.user.create({
    data: {
      id,
      login,
      displayName: 'Synthetic Stock Coordinator',
      passwordHash: hashPassword(PASSWORD),
      status: 'ACTIVE',
      version: 1,
      createdAt: now,
      updatedAt: now,
      profiles: { create: { profile: 'COORDINATOR', assignedAt: now } },
    },
  });
  return { id, login };
}

async function cleanup(database: TestDatabase, actorIds: readonly string[]): Promise<void> {
  const ids = [...actorIds];
  await purgeSyntheticOrigins(database);
  await database.client.auditEntryRecord.deleteMany({ where: { actorId: { in: ids } } });
  await database.client.operationConfirmation.deleteMany({ where: { actorId: { in: ids } } });
  await database.client.loginAttemptState.deleteMany({ where: { login: { startsWith: 'stock-origin-' } } });
  await database.client.user.deleteMany({ where: { id: { in: ids } } });
}

it('seeds exactly the two system origins with the agreed identity and no financial or CRM columns', async () => {
  const database = createDatabase(connectionString);
  onTestFinished(() => database.close());

  const rows = await database.client.stockOrigin.findMany({ orderBy: { id: 'asc' } });
  expect(rows.map((row) => ({ id: row.id, kind: row.kind, name: row.name }))).toEqual([
    { id: SYSTEM_ORIGIN_IDS[0], kind: 'UNKNOWN', name: 'Origem desconhecida' },
    { id: SYSTEM_ORIGIN_IDS[1], kind: 'BAZAR_TRANSFER', name: 'Transferência do Bazar' },
  ]);

  const columns = await database.client.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_origins' ORDER BY column_name`;
  expect(columns.map((column) => column.column_name)).toEqual(['created_at', 'id', 'kind', 'name']);
});

it('creates an origin over HTTP, persists the row with its audit and confirmation, and exposes it to another app on the same database', async () => {
  const database = createDatabase(connectionString);
  const otherDatabase = createDatabase(connectionString);
  const actor = await provisionCoordinator(database);
  await purgeSyntheticOrigins(database);
  const app = createApp({ checkDatabase: database.check, persistence: createPrismaPersistence(database.client) });
  const otherApp = createApp({ checkDatabase: otherDatabase.check, persistence: createPrismaPersistence(otherDatabase.client) });
  onTestFinished(async () => {
    await app.close();
    await otherApp.close();
    await cleanup(database, [actor.id]);
    await database.close();
    await otherDatabase.close();
  });

  const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { loginIdentifier: actor.login, password: PASSWORD } });
  expect(login.statusCode).toBe(200);
  const headers = { authorization: `Bearer ${login.json().sessionToken as string}` };
  const operationId = randomUUID();

  const created = await app.inject({
    method: 'POST',
    url: '/api/v1/stock-origins',
    headers: { ...headers, 'idempotency-key': operationId },
    payload: { kind: 'INDIVIDUAL_DONOR', name: '  Sintética Pessoa Física  ' },
  });
  expect(created.statusCode).toBe(201);
  expect(created.json()).toMatchObject({
    kind: 'INDIVIDUAL_DONOR',
    name: 'Sintética Pessoa Física',
    isExternalDonation: true,
    isSystemManaged: false,
  });
  const originId = created.json().id as string;

  const row = await database.client.stockOrigin.findUniqueOrThrow({ where: { id: originId } });
  expect(row).toMatchObject({ kind: 'INDIVIDUAL_DONOR', name: 'Sintética Pessoa Física' });
  expect(row.createdAt).toBeInstanceOf(Date);

  const audits = await database.client.auditEntryRecord.findMany({ where: { entityType: 'STOCK_ORIGIN', entityId: originId } });
  expect(audits).toHaveLength(1);
  expect(audits[0]).toMatchObject({ actorId: actor.id, action: 'CREATE', beforeJson: null, operationId });
  expect(audits[0]!.afterJson).toMatchObject({ id: originId, kind: 'INDIVIDUAL_DONOR' });

  const confirmation = await database.client.operationConfirmation.findUniqueOrThrow({
    where: { operationType_actorId_operationId: { operationType: 'CREATE_STOCK_ORIGIN', actorId: actor.id, operationId } },
  });
  expect(confirmation.statusCode).toBe(201);

  const fromOtherApp = await otherApp.inject({ method: 'GET', url: `/api/v1/stock-origins/${originId}`, headers });
  expect(fromOtherApp.statusCode).toBe(200);
  expect(fromOtherApp.json()).toMatchObject({ id: originId, name: 'Sintética Pessoa Física' });
});

it('replays an identical request and rejects a divergent payload for the same key without duplicating rows', async () => {
  const database = createDatabase(connectionString);
  const actor = await provisionCoordinator(database);
  await purgeSyntheticOrigins(database);
  const app = createApp({ checkDatabase: database.check, persistence: createPrismaPersistence(database.client) });
  onTestFinished(async () => {
    await app.close();
    await cleanup(database, [actor.id]);
    await database.close();
  });

  const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { loginIdentifier: actor.login, password: PASSWORD } });
  const headers = { authorization: `Bearer ${login.json().sessionToken as string}` };
  const operationId = randomUUID();
  const payload = { kind: 'CAMPAIGN', name: 'Campanha Arrecadação de Agasalhos' };

  const first = await app.inject({ method: 'POST', url: '/api/v1/stock-origins', headers: { ...headers, 'idempotency-key': operationId }, payload });
  const replay = await app.inject({ method: 'POST', url: '/api/v1/stock-origins', headers: { ...headers, 'idempotency-key': operationId }, payload });
  expect(first.statusCode).toBe(201);
  expect(replay.json()).toEqual(first.json());

  const conflict = await app.inject({
    method: 'POST',
    url: '/api/v1/stock-origins',
    headers: { ...headers, 'idempotency-key': operationId },
    payload: { kind: 'CAMPAIGN', name: 'Outra Campanha' },
  });
  expect(conflict.statusCode).toBe(409);

  expect(await database.client.stockOrigin.count({ where: { name: { contains: 'Campanha' } } })).toBe(1);
  expect(await database.client.auditEntryRecord.count({ where: { entityType: 'STOCK_ORIGIN', actorId: actor.id } })).toBe(1);
  expect(await database.client.operationConfirmation.count({ where: { actorId: actor.id } })).toBe(1);
});

it('returns one record, one audit and one confirmation for eight concurrent identical creations', async () => {
  const database = createDatabase(connectionString);
  const actor = await provisionCoordinator(database);
  await purgeSyntheticOrigins(database);
  const persistence = createPrismaPersistence(database.client);
  onTestFinished(async () => {
    await cleanup(database, [actor.id]);
    await database.close();
  });
  const service = new StockOriginsService({
    repository: persistence.stockOriginsRepository,
    transactions: persistence.stockOriginTransactions,
  });
  const operationId = randomUUID();

  const outcomes = await Promise.allSettled(Array.from({ length: 8 }, () => service.createStockOrigin({
    actorId: actor.id,
    operationId,
    kind: 'COMPANY_DONOR',
    name: 'Empresa Sintética Concorrente',
  })));

  expect(outcomes.every((outcome) => outcome.status === 'fulfilled')).toBe(true);
  const ids = outcomes.flatMap((outcome) => outcome.status === 'fulfilled' ? [outcome.value.body.id] : []);
  expect(new Set(ids).size).toBe(1);
  expect(await database.client.stockOrigin.count({ where: { name: 'Empresa Sintética Concorrente' } })).toBe(1);
  expect(await database.client.auditEntryRecord.count({ where: { entityType: 'STOCK_ORIGIN', actorId: actor.id } })).toBe(1);
  expect(await database.client.operationConfirmation.count({ where: { actorId: actor.id } })).toBe(1);
});

it('rolls back the row and the confirmation when the audit write fails', async () => {
  const database = createDatabase(connectionString);
  const actor = await provisionCoordinator(database);
  await purgeSyntheticOrigins(database);
  const persistence = createPrismaPersistence(database.client);
  onTestFinished(async () => {
    await cleanup(database, [actor.id]);
    await database.close();
  });
  const service = new StockOriginsService({
    repository: persistence.stockOriginsRepository,
    transactions: (work) => createPrismaPersistence(database.client).stockOriginTransactions((context) => work({
      ...context,
      auditTrail: {
        record: async () => { throw new Error('Simulated audit write failure.'); },
        listByEntity: async () => [],
      },
    })),
  });

  await expect(service.createStockOrigin({
    actorId: actor.id,
    operationId: randomUUID(),
    kind: 'CAMPAIGN',
    name: 'Campanha com Falha',
  })).rejects.toThrow('Simulated audit write failure.');

  expect(await database.client.stockOrigin.count({ where: { name: 'Campanha com Falha' } })).toBe(0);
  expect(await database.client.operationConfirmation.count({ where: { actorId: actor.id } })).toBe(0);
  expect(await database.client.auditEntryRecord.count({ where: { actorId: actor.id } })).toBe(0);
});

it('lists the system origins together with created ones, with correct flags and no financial or CRM data', async () => {
  const database = createDatabase(connectionString);
  const actor = await provisionCoordinator(database);
  await purgeSyntheticOrigins(database);
  const app = createApp({ checkDatabase: database.check, persistence: createPrismaPersistence(database.client) });
  onTestFinished(async () => {
    await app.close();
    await cleanup(database, [actor.id]);
    await database.close();
  });

  const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { loginIdentifier: actor.login, password: PASSWORD } });
  const headers = { authorization: `Bearer ${login.json().sessionToken as string}` };
  const created = await app.inject({
    method: 'POST',
    url: '/api/v1/stock-origins',
    headers: { ...headers, 'idempotency-key': randomUUID() },
    payload: { kind: 'INDIVIDUAL_DONOR', name: 'Doador Sintético da Listagem' },
  });
  expect(created.statusCode).toBe(201);

  const list = await app.inject({ method: 'GET', url: '/api/v1/stock-origins', headers });
  expect(list.statusCode).toBe(200);
  const page = list.json() as { items: Array<Record<string, unknown>>; totalItems: number };
  expect(page.totalItems).toBe(3);

  const unknown = page.items.find((item) => item.kind === 'UNKNOWN');
  const bazar = page.items.find((item) => item.kind === 'BAZAR_TRANSFER');
  expect(unknown).toMatchObject({ isExternalDonation: true, isSystemManaged: true });
  expect(bazar).toMatchObject({ isExternalDonation: false, isSystemManaged: true });

  const forbiddenKeys = ['value', 'estimatedValue', 'amount', 'currency', 'cpf', 'cnpj', 'email', 'phone', 'address', 'campaignGoal'];
  for (const item of page.items) {
    expect(Object.keys(item).sort()).toEqual(['createdAt', 'id', 'isExternalDonation', 'isSystemManaged', 'kind', 'name']);
    for (const forbidden of forbiddenKeys) {
      expect(Object.keys(item)).not.toContain(forbidden);
    }
  }

  const forbiddenCreate = await app.inject({
    method: 'POST',
    url: '/api/v1/stock-origins',
    headers: { ...headers, 'idempotency-key': randomUUID() },
    payload: { kind: 'CAMPAIGN', name: 'Campanha com Valor', estimatedValue: 100 },
  });
  expect(forbiddenCreate.statusCode).toBe(400);
  expect(await database.client.stockOrigin.count({ where: { name: 'Campanha com Valor' } })).toBe(0);
});
