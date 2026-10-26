import { randomUUID } from 'node:crypto';
import { expect, it, onTestFinished } from 'vitest';
import { createIsolatedDatabase, deployIsolatedMigrations } from '../helpers/isolated-database.ts';
import { createDatabase } from '../../src/server/database.ts';
import { createApp } from '../../src/server/app.ts';
import { createPrismaPersistence } from '../../src/server/persistence.ts';
import { hashPassword } from '../../src/modules/access/infrastructure/password-hasher.ts';
import { computePayloadDigest } from '../../src/modules/shared/audit-and-idempotency.ts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const controlUrl = process.env.TEST_DATABASE_URL;
if (!controlUrl) throw new Error('Set TEST_DATABASE_URL to an isolated PostgreSQL database before running integration tests.');

it('upgrades populated legacy catalogs deterministically without changing identities or revisions and preserves codes on redeploy', async () => {
  const isolated = await createIsolatedDatabase(controlUrl, { migrationsThrough: '20261025162509_add_stock_item_catalog' });
  const database = createDatabase(isolated.connectionString);
  onTestFinished(async () => { await database.close(); await isolated.close(); });
  const categoryId = '01963000-0000-7000-8000-000000000001';
  const laterCategoryId = '01963000-0000-7000-8000-000000000002';
  const olderCategoryId = '01963000-0000-7000-8000-000000000003';
  const unitId = '01963000-0000-7000-8000-000000000101';
  const nextUnitId = '01963000-0000-7000-8000-000000000102';
  const sizeId = randomUUID();
  const itemId = randomUUID();
  const revisionId = randomUUID();
  const instant = new Date('2026-10-01T12:00:00.000Z');
  const previousInstant = new Date('2026-09-01T12:00:00.000Z');
  // Insert the larger ID first: deterministic backfill must use the documented ordering, not insertion order.
  for (const id of [laterCategoryId, categoryId]) {
    await database.client.$executeRaw`INSERT INTO stock_categories (id, name, is_active, version, created_at, updated_at)
      VALUES (${id}::uuid, 'Legacy category', false, 3, ${instant}, ${instant})`;
  }
  await database.client.$executeRaw`INSERT INTO stock_categories (id, name, is_active, version, created_at, updated_at)
    VALUES (${olderCategoryId}::uuid, 'Older category', true, 1, ${previousInstant}, ${previousInstant})`;
  await database.client.$executeRaw`INSERT INTO stock_units (id, name, precision, is_active, version, created_at, updated_at)
    VALUES (${unitId}::uuid, 'Legacy kilo', 3, true, 1, ${instant}, ${instant})`;
  await database.client.$executeRaw`INSERT INTO stock_units (id, name, precision, is_active, version, created_at, updated_at)
    VALUES (${nextUnitId}::uuid, 'Legacy piece', 0, true, 1, ${instant}, ${instant})`;
  await database.client.$executeRaw`INSERT INTO stock_sizes (id, name, is_active, version, created_at, updated_at)
    VALUES (${sizeId}::uuid, 'Legacy size', true, 1, ${instant}, ${instant})`;
  await database.client.$executeRaw`INSERT INTO stock_items (id, version, created_at, updated_at)
    VALUES (${itemId}::uuid, 1, ${instant}, ${instant})`;
  await database.client.$executeRaw`INSERT INTO stock_item_revisions
    (id, item_id, version, name, category_id, category_name, unit_id, unit_name, unit_precision, size_id, size_name, is_active, recorded_at)
    VALUES (${revisionId}::uuid, ${itemId}::uuid, 1, 'Legacy item', ${categoryId}::uuid, 'Historical category',
      ${unitId}::uuid, 'Historical kilo', 3, ${sizeId}::uuid, 'Historical size', true, ${instant})`;
  await database.client.$executeRaw`INSERT INTO stock_item_revisions
    (id, item_id, version, name, category_id, category_name, unit_id, unit_name, unit_precision, is_active, recorded_at)
    VALUES (${randomUUID()}::uuid, ${itemId}::uuid, 2, 'Corrected item', ${laterCategoryId}::uuid, 'Later category',
      ${nextUnitId}::uuid, 'Historical piece', 0, true, ${instant})`;
  await database.client.$executeRaw`UPDATE stock_items SET version = 2 WHERE id = ${itemId}::uuid`;
  const before = await database.client.$queryRaw`SELECT * FROM stock_item_revisions ORDER BY version`;
  const identitiesBefore = await database.client.$queryRaw`SELECT id, version, created_at, updated_at FROM stock_items`;
  const actorId = randomUUID();
  const operationId = randomUUID();
  const password = 'SyntheticLegacyPassword!123';
  await database.client.user.create({ data: { id: actorId, login: actorId, displayName: 'Legacy operator',
    passwordHash: hashPassword(password), status: 'ACTIVE', version: 1, createdAt: instant, updatedAt: instant,
    profiles: { create: { profile: 'STOCK_DISTRIBUTION', assignedAt: instant } } } });
  const payload = { name: 'Legacy item', categoryId, unitId, sizeId };
  const legacyBody = { id: itemId, revisionId, version: 1, name: 'Legacy item',
    category: { id: categoryId, name: 'Historical category' }, unit: { id: unitId, name: 'Historical kilo', precision: 3 },
    size: { id: sizeId, name: 'Historical size' }, isActive: true, createdAt: instant.toISOString(), updatedAt: instant.toISOString() };
  await database.client.operationConfirmation.create({ data: { actorId, operationType: 'CREATE_STOCK_ITEM', operationId,
    payloadDigest: computePayloadDigest(payload), statusCode: 201, responseBody: legacyBody, createdAt: instant } });
  await database.client.auditEntryRecord.create({ data: { id: randomUUID(), actorId, entityType: 'STOCK_ITEM', entityId: itemId,
    action: 'CREATE', factDate: '2026-10-01', recordedAt: instant, afterJson: legacyBody, operationId } });
  const auditBefore = await database.client.auditEntryRecord.findMany();
  const confirmationsBefore = await database.client.operationConfirmation.findMany();
  await deployIsolatedMigrations(isolated.connectionString);
  const columns = await database.client.$queryRaw<{ column_name: string }[]>`SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_items' AND column_name = 'code'`;
  expect(columns).toHaveLength(1);
  const categories = await database.client.$queryRaw<{ id: string; code: string }[]>`SELECT id, code FROM stock_categories ORDER BY id`;
  expect(categories).toEqual([{ id: categoryId, code: 'CAT-000002' }, { id: laterCategoryId, code: 'CAT-000003' }, { id: olderCategoryId, code: 'CAT-000001' }]);
  expect(await database.client.$queryRaw`SELECT * FROM stock_item_revisions ORDER BY version`).toEqual(before);
  expect(await database.client.$queryRaw`SELECT id, version, created_at, updated_at FROM stock_items`).toEqual(identitiesBefore);
  expect(await database.client.$queryRaw`SELECT code FROM stock_units ORDER BY id`).toEqual([{ code: 'UNIT-000001' }, { code: 'UNIT-000002' }]);
  expect(await database.client.$queryRaw`SELECT code FROM stock_sizes`).toEqual([{ code: 'SIZE-000001' }]);
  expect(await database.client.$queryRaw`SELECT code FROM stock_items`).toEqual([{ code: 'ITEM-000001' }]);
  // An older application omitting code must still receive a generated value from the database default.
  const nextId = randomUUID();
  await database.client.$executeRaw`INSERT INTO stock_categories (id, name, is_active, version, created_at, updated_at)
    VALUES (${nextId}::uuid, 'Old binary insert', true, 1, ${instant}, ${instant})`;
  expect(await database.client.$queryRaw`SELECT code FROM stock_categories WHERE id = ${nextId}::uuid`).toEqual([{ code: 'CAT-000004' }]);
  await deployIsolatedMigrations(isolated.connectionString);
  expect(await database.client.$queryRaw`SELECT id, code FROM stock_categories WHERE id IN (${categoryId}::uuid, ${laterCategoryId}::uuid, ${olderCategoryId}::uuid) ORDER BY id`).toEqual(categories);
  const afterId = randomUUID();
  await database.client.$executeRaw`INSERT INTO stock_categories (id, name, is_active, version, created_at, updated_at)
    VALUES (${afterId}::uuid, 'After redeploy', true, 1, ${instant}, ${instant})`;
  expect(await database.client.$queryRaw`SELECT code FROM stock_categories WHERE id = ${afterId}::uuid`).toEqual([{ code: 'CAT-000005' }]);
  const app = createApp({ checkDatabase: database.check, persistence: createPrismaPersistence(database.client) });
  onTestFinished(() => app.close());
  const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { loginIdentifier: actorId, password } });
  expect(login.statusCode).toBe(200);
  const headers = { authorization: `Bearer ${login.json<{ sessionToken: string }>().sessionToken}` };
  const replay = await app.inject({ method: 'POST', url: '/api/v1/stock-items',
    headers: { ...headers, 'idempotency-key': operationId }, payload });
  expect(replay.statusCode).toBe(201);
  expect(replay.json()).toEqual(legacyBody);
  const historical = await app.inject({ method: 'GET', url: `/api/v1/stock-items/${itemId}/revisions/1`, headers });
  expect(historical.statusCode).toBe(200);
  expect(historical.json()).toEqual({ ...legacyBody, code: 'ITEM-000001',
    category: { ...legacyBody.category, code: 'CAT-000002' }, unit: { ...legacyBody.unit, code: 'UNIT-000001' },
    size: { ...legacyBody.size, code: 'SIZE-000001' } });
  const current = await app.inject({ method: 'GET', url: `/api/v1/stock-items/${itemId}`, headers });
  expect(current.json()).toMatchObject({ code: 'ITEM-000001', version: 2, category: { code: 'CAT-000003', name: 'Later category' },
    unit: { code: 'UNIT-000002', precision: 0, name: 'Historical piece' }, size: null });
  expect(await database.client.$queryRaw`SELECT last_value::text FROM stock_item_code_seq`).toEqual([{ last_value: '1' }]);
  expect(await database.client.auditEntryRecord.findMany()).toEqual(auditBefore);
  expect(await database.client.operationConfirmation.findMany()).toEqual(confirmationsBefore);
}, 30_000);

it('rolls back a failed migration after partial backfill and supports controlled recovery and reapplication', async () => {
  const isolated = await createIsolatedDatabase(controlUrl, { migrationsThrough: '20261025162509_add_stock_item_catalog' });
  const database = createDatabase(isolated.connectionString);
  onTestFinished(async () => { await database.close(); await isolated.close(); });
  const id = randomUUID();
  const now = new Date();
  await database.client.$executeRaw`INSERT INTO stock_categories (id, name, is_active, version, created_at, updated_at)
    VALUES (${id}::uuid, 'Recovery category', true, 1, ${now}, ${now})`;
  // A conflicting object makes the final resource fail after the earlier resources have been processed.
  await database.client.$executeRaw`CREATE SEQUENCE stock_unit_code_seq`;
  await expect(deployIsolatedMigrations(isolated.connectionString)).rejects.toThrow();
  expect(await database.client.$queryRaw`SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name IN ('stock_categories', 'stock_items', 'stock_sizes', 'stock_units') AND column_name = 'code'`).toEqual([]);
  expect(await database.client.$queryRaw`SELECT id, name FROM stock_categories`).toEqual([{ id, name: 'Recovery category' }]);
  await database.client.$executeRaw`DROP SEQUENCE stock_unit_code_seq`;
  await promisify(execFile)(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'resolve',
    '--rolled-back', '20261026191500_add_stock_catalog_codes'], { env: { ...process.env, DATABASE_URL: isolated.connectionString }, windowsHide: true });
  await deployIsolatedMigrations(isolated.connectionString);
  expect(await database.client.$queryRaw`SELECT id, code FROM stock_categories`).toEqual([{ id, code: 'CAT-000001' }]);
  expect(await database.client.$queryRaw`SELECT next_stock_catalog_code('CAT', 'stock_category_code_seq') AS code`).toEqual([{ code: 'CAT-000002' }]);
}, 30_000);
