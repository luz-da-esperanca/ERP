import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:net';
import { afterAll, beforeAll, expect, it, onTestFinished } from 'vitest';
import { AccessService } from '../../src/modules/access/application/access-service.ts';
import { accessSecurity, hashPassword } from '../../src/modules/access/infrastructure/password-hasher.ts';
import { createIsolatedDatabase } from '../helpers/isolated-database.ts';
import { ProjectsService } from '../../src/modules/activities/application/projects-service.ts';
import { PrismaProjectsRepository } from '../../src/modules/activities/infrastructure/prisma-projects-repository.ts';
import { createApp } from '../../src/server/app.ts';
import { createPrismaPersistence } from '../../src/server/persistence.ts';
import { createDatabase } from '../../src/server/database.ts';

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

it('provisions exactly one initial administrator with an audit trail and a usable login', async () => {
  const database = createDatabase(connectionString);
  const persistence = createPrismaPersistence(database.client);
  const service = new AccessService({ repository: persistence.accessRepository, transactions: persistence.accessTransactions, security: accessSecurity });
  const loginIdentifier = `bootstrap-${randomUUID()}`;
  const password = 'SyntheticBootstrapPassword!123';
  onTestFinished(async () => {
    const users = await database.client.user.findMany({ where: { login: loginIdentifier } });
    await database.client.auditEntryRecord.deleteMany({ where: { actorId: { in: users.map((user) => user.id) } } });
    await database.client.user.deleteMany({ where: { login: loginIdentifier } });
    await database.close();
  });
  const input = { loginIdentifier, displayName: 'Synthetic Initial Admin', password };
  const outcomes = await Promise.allSettled([
    service.provisionInitialAdministrator(input), service.provisionInitialAdministrator(input),
  ]);
  expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
  expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
  const user = await database.client.user.findUniqueOrThrow({ where: { login: loginIdentifier }, include: { profiles: true } });
  expect(user.profiles.map((profile) => profile.profile)).toEqual(['ADMIN']);
  expect(user.passwordHash).not.toBe(password);
  expect(await database.client.auditEntryRecord.count({ where: { actorId: user.id, action: 'CREATE' } })).toBe(1);
  const login = await service.login({ login: loginIdentifier, password });
  expect(login.user.id).toBe(user.id);
});

it('reports readiness through a real Prisma connection to PostgreSQL', async () => {
  const database = createDatabase(connectionString);
  const app = createApp({
    checkDatabase: database.check,
    persistence: createPrismaPersistence(database.client),
  });
  onTestFinished(async () => {
    await app.close();
    await database.close();
  });

  const response = await app.inject({ method: 'GET', url: '/api/v1/ready' });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ status: 'ok' });
});

it('integrates CLI provisioning, the published HTTP contracts, authorization, project history, and user revocation', async () => {
  const database = createDatabase(connectionString);
  const suffix = randomUUID();
  const adminLogin = `admin-${suffix}`;
  const coordinatorLogin = `coord-${suffix}`;
  const password = 'SyntheticIntegrationPassword!123';
  const projectName = `Integration ${suffix}`;
  const app = createApp({ checkDatabase: database.check, persistence: createPrismaPersistence(database.client), secureCookies: true });
  onTestFinished(async () => {
    await app.close();
    const users = await database.client.user.findMany({ where: { login: { in: [adminLogin, coordinatorLogin] } } });
    const actorIds = users.map((user) => user.id);
    await database.client.project.deleteMany({ where: { name: projectName } });
    await database.client.auditEntryRecord.deleteMany({ where: { actorId: { in: actorIds } } });
    await database.client.operationConfirmation.deleteMany({ where: { actorId: { in: actorIds } } });
    await database.client.loginAttemptState.deleteMany({ where: { login: { in: [adminLogin, coordinatorLogin] } } });
    await database.client.user.deleteMany({ where: { id: { in: actorIds } } });
    await database.close();
  });
  const provisioned = await promisify(execFile)(process.execPath, ['src/server/provision-initial-admin.ts'], {
    windowsHide: true,
    env: { ...process.env, DATABASE_URL: connectionString, BOOTSTRAP_ADMIN_LOGIN: adminLogin,
      BOOTSTRAP_ADMIN_DISPLAY_NAME: 'Synthetic Admin', BOOTSTRAP_ADMIN_PASSWORD: password },
  });
  expect(provisioned.stdout).toContain('Initial administrator provisioned:');
  expect(provisioned.stdout + provisioned.stderr).not.toContain(password);
  const admin = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { loginIdentifier: adminLogin, password } });
  expect(admin.statusCode).toBe(200);
  expect(String(admin.headers['set-cookie'])).toContain('Secure');
  const adminHeaders = { authorization: `Bearer ${admin.json().sessionToken as string}` };
  expect((await app.inject({ method: 'GET', url: '/api/v1/projects', headers: adminHeaders })).statusCode).toBe(403);
  const userKey = randomUUID();
  const createUser = { method: 'POST' as const, url: '/api/v1/users',
    headers: { ...adminHeaders, 'idempotency-key': userKey },
    payload: { loginIdentifier: coordinatorLogin, displayName: 'Synthetic Coordinator', password, profiles: ['COORDINATOR'] },
  };
  const userResponse = await app.inject(createUser);
  expect(userResponse.statusCode).toBe(201);
  expect((await app.inject(createUser)).json()).toEqual(userResponse.json());
  const passwordConflict = await app.inject({ ...createUser, payload: { ...createUser.payload, password: 'ChangedSyntheticPassword!123' } });
  expect(passwordConflict.statusCode).toBe(409);
  const confirmation = await database.client.operationConfirmation.findFirstOrThrow({ where: { operationId: userKey } });
  expect(confirmation.secretHash).toMatch(/^scrypt\$/);
  expect(JSON.stringify(confirmation)).not.toContain(password);
  const coordinator = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { loginIdentifier: coordinatorLogin, password } });
  expect(coordinator.statusCode).toBe(200);
  const coordinatorHeaders = { authorization: `Bearer ${coordinator.json().sessionToken as string}` };
  const createProject = { method: 'POST' as const, url: '/api/v1/projects',
    headers: { ...coordinatorHeaders, 'idempotency-key': randomUUID() },
    payload: { name: projectName, startDate: '2026-10-01', instituteIds: [], factDate: '2026-10-01' },
  };
  const project = await app.inject(createProject);
  expect(project.statusCode).toBe(201);
  expect((await app.inject(createProject)).json()).toEqual(project.json());
  const institutes = await app.inject({ method: 'GET', url: '/api/v1/institutes', headers: coordinatorHeaders });
  const instituteIds = institutes.json().items.slice(0, 2).map((institute: { id: string }) => institute.id);
  const update = await app.inject({ method: 'PATCH', url: `/api/v1/projects/${project.json().id as string}`,
    headers: { ...coordinatorHeaders, 'idempotency-key': randomUUID() },
    payload: { version: 1, instituteIds, reason: 'Associate approved existing institutes.', factDate: '2026-10-02' } });
  expect(update.statusCode).toBe(200);
  expect(update.json().institutes).toHaveLength(2);
  const closed = await app.inject({ method: 'POST', url: `/api/v1/projects/${project.json().id as string}/close`,
    headers: { ...coordinatorHeaders, 'idempotency-key': randomUUID() },
    payload: { version: 2, endDate: '2026-12-01', reason: 'Close the synthetic project.', factDate: '2026-10-03' } });
  expect(closed.statusCode).toBe(200);
  expect(closed.json()).toMatchObject({ status: 'CLOSED', version: 3 });
  const projectAudit = await database.client.auditEntryRecord.findMany({ where: { entityId: project.json().id as string }, orderBy: { recordedAt: 'asc' } });
  expect(projectAudit.map((entry) => entry.action)).toEqual(['CREATE', 'UPDATE', 'CLOSE']);
  expect(projectAudit.map((entry) => entry.factDate)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
  const revokedProfile = await app.inject({ method: 'PUT', url: `/api/v1/users/${userResponse.json().id as string}/profiles`,
    headers: { ...adminHeaders, 'idempotency-key': randomUUID() },
    payload: { version: 1, profiles: ['SOCIAL_ASSISTANCE'], reason: 'Remove project write access.' } });
  expect(revokedProfile.statusCode).toBe(200);
  expect((await app.inject({ ...createProject, headers: { ...coordinatorHeaders, 'idempotency-key': randomUUID() } })).statusCode).toBe(403);
  const deactivated = await app.inject({ method: 'POST', url: `/api/v1/users/${userResponse.json().id as string}/deactivate`,
    headers: { ...adminHeaders, 'idempotency-key': randomUUID() },
    payload: { version: 2, reason: 'Deactivate the synthetic operator.' } });
  expect(deactivated.statusCode).toBe(200);
  expect((await app.inject({ method: 'GET', url: '/api/v1/auth/session', headers: coordinatorHeaders })).statusCode).toBe(401);
  expect(await database.client.auditEntryRecord.count({ where: { actorId: coordinator.json().user.id as string } })).toBe(3);
});

it('rejects invalid fact dates without persisting a project, audit, or replay result', async () => {
  const database = createDatabase(connectionString);
  const actorId = randomUUID();
  const projectName = `Rollback ${actorId}`;
  const operationId = randomUUID();
  const now = new Date();
  const login = `review-${actorId}`;
  const password = 'SyntheticPassword!123';
  await database.client.user.create({ data: {
    id: actorId, login, displayName: 'Synthetic Coordinator', passwordHash: hashPassword(password),
    status: 'ACTIVE', version: 1, createdAt: now, updatedAt: now,
    profiles: { create: { profile: 'COORDINATOR', assignedAt: now } },
  } });
  const app = createApp({
    checkDatabase: database.check,
    persistence: createPrismaPersistence(database.client),
  });
  onTestFinished(async () => {
    await app.close();
    await database.client.project.deleteMany({ where: { name: projectName } });
    await database.client.auditEntryRecord.deleteMany({ where: { actorId } });
    await database.client.operationConfirmation.deleteMany({ where: { actorId } });
    await database.client.user.delete({ where: { id: actorId } });
    await database.close();
  });
  const loginResponse = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { loginIdentifier: login, password } });
  const authorization = `Bearer ${loginResponse.json().sessionToken as string}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await app.inject({ method: 'POST', url: '/api/v1/projects',
      headers: { authorization, 'idempotency-key': operationId },
      payload: { name: projectName, startDate: '2026-10-01', factDate: '2026-02-30' },
    });
    expect(response.statusCode).toBe(422);
  }
  expect(await database.client.project.count({ where: { name: projectName } })).toBe(0);
  expect(await database.client.auditEntryRecord.count({ where: { actorId } })).toBe(0);
  expect(await database.client.operationConfirmation.count({ where: { actorId } })).toBe(0);
});

it('rolls back a project when its audit write fails', async () => {
  const database = createDatabase(connectionString);
  const actorId = randomUUID();
  const projectName = `Failed audit ${actorId}`;
  onTestFinished(async () => {
    await database.client.project.deleteMany({ where: { name: projectName } });
    await database.client.operationConfirmation.deleteMany({ where: { actorId } });
    await database.close();
  });
  const service = new ProjectsService({
    repository: new PrismaProjectsRepository(database.client),
    transactions: (work) => createPrismaPersistence(database.client).projectTransactions((context) => work({
      ...context, auditTrail: { record: async () => { throw new Error('Simulated audit write failure.'); }, listByEntity: async () => [] },
    })),
  });
  await expect(service.createProject({ actorId, operationId: randomUUID(), name: projectName, startDate: '2026-10-01' }))
    .rejects.toThrow('Simulated audit write failure.');
  expect(await database.client.project.count({ where: { name: projectName } })).toBe(0);
});

it('returns one project and one audited confirmation for concurrent identical operations', async () => {
  const database = createDatabase(connectionString);
  const actorId = randomUUID();
  const projectName = `Concurrent ${actorId}`;
  const operationId = randomUUID();
  const persistence = createPrismaPersistence(database.client);
  onTestFinished(async () => {
    await database.client.project.deleteMany({ where: { name: projectName } });
    await database.client.auditEntryRecord.deleteMany({ where: { actorId } });
    await database.client.operationConfirmation.deleteMany({ where: { actorId } });
    await database.close();
  });
  const service = new ProjectsService({ repository: persistence.projectsRepository, transactions: persistence.projectTransactions });
  const outcomes = await Promise.allSettled(Array.from({ length: 8 }, () => service.createProject({
    actorId, operationId, name: projectName, startDate: '2026-10-01',
  })));
  expect(outcomes.every((outcome) => outcome.status === 'fulfilled')).toBe(true);
  const ids = outcomes.flatMap((outcome) => outcome.status === 'fulfilled' ? [outcome.value.body.id] : []);
  expect(new Set(ids).size).toBe(1);
  expect(await database.client.project.count({ where: { name: projectName } })).toBe(1);
  expect(await database.client.auditEntryRecord.count({ where: { actorId } })).toBe(1);
  expect(await database.client.operationConfirmation.count({ where: { actorId } })).toBe(1);
});

it('enforces login lockout under concurrent invalid attempts', async () => {
  const database = createDatabase(connectionString);
  const login = `invalid-${randomUUID()}`;
  const app = createApp({ checkDatabase: database.check, persistence: createPrismaPersistence(database.client) });
  onTestFinished(async () => {
    await app.close();
    await database.client.loginAttemptState.deleteMany({ where: { login } });
    await database.close();
  });
  await Promise.all(Array.from({ length: 12 }, () => app.inject({
    method: 'POST', url: '/api/v1/auth/login', payload: { loginIdentifier: login, password: 'WrongSyntheticPassword!123' },
  })));
  const blocked = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { loginIdentifier: login, password: 'WrongSyntheticPassword!123' } });
  expect(blocked.statusCode).toBe(429);
  expect(blocked.headers['retry-after']).toBeDefined();
  const state = await database.client.loginAttemptState.findUniqueOrThrow({ where: { login } });
  expect(state.failedAttempts).toBe(5);
  expect(state.lockedUntil).not.toBeNull();
});

it('returns a duplicate-resource conflict when different operation keys race for the same login', async () => {
  const database = createDatabase(connectionString);
  const persistence = createPrismaPersistence(database.client);
  const service = new AccessService({ repository: persistence.accessRepository, transactions: persistence.accessTransactions, security: accessSecurity });
  const actorId = randomUUID();
  const login = `duplicate-${randomUUID()}`;
  onTestFinished(async () => {
    await database.client.auditEntryRecord.deleteMany({ where: { actorId } });
    await database.client.operationConfirmation.deleteMany({ where: { actorId } });
    await database.client.user.deleteMany({ where: { login } });
    await database.close();
  });
  const outcomes = await Promise.allSettled(Array.from({ length: 4 }, () => service.createUser({
    actorId, operationId: randomUUID(), login, displayName: 'Synthetic User', password: 'SyntheticPassword!123', profiles: ['ADMIN'],
  })));
  expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
  const errors: unknown[] = outcomes.flatMap((outcome) => outcome.status === 'rejected' ? [outcome.reason] : []);
  expect(errors).toHaveLength(3);
  for (const error of errors) expect(error).toMatchObject({ status: 409, code: 'DUPLICATE_RESOURCE' });
});

it('returns safe service-unavailable details when the protected login dependency is unreachable', async () => {
  const listener = createServer();
  await new Promise<void>((resolve) => listener.listen(0, '127.0.0.1', resolve));
  const address = listener.address();
  if (!address || typeof address === 'string') throw new Error('Failed to reserve a test port.');
  const url = new URL(connectionString);
  url.port = String(address.port);
  await new Promise<void>((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  const database = createDatabase(url.toString());
  const app = createApp({ checkDatabase: database.check, persistence: createPrismaPersistence(database.client) });
  onTestFinished(async () => { await app.close(); await database.close(); });
  const response = await app.inject({ method: 'POST', url: '/api/v1/auth/login',
    payload: { loginIdentifier: 'synthetic@example.invalid', password: 'SyntheticPassword!123' } });
  expect(response.statusCode).toBe(503);
  expect(response.json()).toMatchObject({ code: 'SERVICE_UNAVAILABLE', traceId: expect.any(String) });
  expect(response.body).not.toContain('Prisma');
  expect(response.body).not.toContain('P1001');
});

it('recovers an expired browser cookie and preserves CSRF, audited retries, and logout with PostgreSQL', async () => {
  const database = createDatabase(connectionString);
  const actorId = randomUUID();
  const loginIdentifier = `browser-${actorId}`;
  const createdLogin = `created-${actorId}`;
  const password = 'SyntheticBrowserPassword!123';
  let now = new Date('2026-10-25T12:00:00.000Z');
  const app = createApp({ checkDatabase: database.check, persistence: createPrismaPersistence(database.client), clock: () => now });
  onTestFinished(async () => {
    await app.close();
    await database.client.auditEntryRecord.deleteMany({ where: { actorId } });
    await database.client.operationConfirmation.deleteMany({ where: { actorId } });
    await database.client.loginAttemptState.deleteMany({ where: { login: { in: [loginIdentifier, createdLogin] } } });
    await database.client.user.deleteMany({ where: { login: { in: [loginIdentifier, createdLogin] } } });
    await database.close();
  });
  await database.client.user.create({ data: { id: actorId, login: loginIdentifier,
    displayName: 'Synthetic Browser Administrator', passwordHash: hashPassword(password), status: 'ACTIVE',
    version: 1, createdAt: now, updatedAt: now, profiles: { create: { profile: 'ADMIN', assignedAt: now } } } });
  const originHeaders = { host: '127.0.0.1:5173', origin: 'http://127.0.0.1:5173' };
  const credentials = { loginIdentifier, password };
  const initial = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: originHeaders, payload: credentials });
  expect(initial.statusCode).toBe(200);
  const expiredCookie = String(initial.headers['set-cookie']).split(';')[0] ?? '';
  now = new Date('2026-10-25T12:31:00.000Z');
  expect((await app.inject({ method: 'GET', url: '/api/v1/auth/session', headers: { cookie: expiredCookie } })).statusCode).toBe(401);

  const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login',
    headers: { ...originHeaders, cookie: expiredCookie }, payload: credentials });
  expect(login.statusCode).toBe(200);
  const cookie = String(login.headers['set-cookie']).split(';')[0] ?? '';
  const session = await app.inject({ method: 'GET', url: '/api/v1/auth/session', headers: { cookie } });
  expect(session.statusCode).toBe(200);
  const csrfToken = String(session.json().csrfToken);
  const operationId = randomUUID();
  const create = { method: 'POST' as const, url: '/api/v1/users', headers: { ...originHeaders, cookie, 'idempotency-key': operationId },
    payload: { loginIdentifier: createdLogin, displayName: 'Synthetic Operator', password, profiles: ['PERIODIC_ACTIVITY'] } };
  expect((await app.inject(create)).statusCode).toBe(403);
  expect(await database.client.user.count({ where: { login: createdLogin } })).toBe(0);
  expect(await database.client.auditEntryRecord.count({ where: { actorId } })).toBe(0);
  expect(await database.client.operationConfirmation.count({ where: { actorId } })).toBe(0);

  const authorizedCreate = { ...create, headers: { ...create.headers, 'x-csrf-token': csrfToken } };
  const first = await app.inject(authorizedCreate);
  expect(first.statusCode).toBe(201);
  expect((await app.inject(authorizedCreate)).json()).toEqual(first.json());
  expect(await database.client.user.count({ where: { login: createdLogin } })).toBe(1);
  expect(await database.client.auditEntryRecord.count({ where: { actorId } })).toBe(1);
  expect(await database.client.operationConfirmation.count({ where: { actorId } })).toBe(1);
  expect((await app.inject({ method: 'POST', url: '/api/v1/auth/logout',
    headers: { ...originHeaders, cookie, 'x-csrf-token': csrfToken } })).statusCode).toBe(204);
  expect((await app.inject({ method: 'GET', url: '/api/v1/auth/session', headers: { cookie } })).statusCode).toBe(401);
});
