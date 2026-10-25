import { describe, expect, it, onTestFinished } from 'vitest';
import { InMemoryAuditTrail } from '../../../src/modules/shared/infrastructure/in-memory-audit-and-idempotency.ts';
import { createApp } from '../../../src/server/app.ts';

const ADMIN_ID = '01963000-0000-7000-8000-000000000001';
const COORD_ID = '01963000-0000-7000-8000-000000000002';
const EDUCATOR_ID = '01963000-0000-7000-8000-000000000003';
const BAZAR_ID = '01963000-0000-7000-8000-000000000004';

describe('Institutes and Projects HTTP API (PB-12 / RF-ATV-01 / RF-ATV-02 / RF-ATV-08 / LAC-04 / AC-58)', () => {
  it.each(['status=UNKNOWN', 'instituteId=invalid', 'search=' + 'x'.repeat(151), 'unexpected=value', 'page=0', 'pageSize=101'])('rejects invalid list query parameters (%s)', async (query) => {
    const { app, coordToken } = await setupAuthenticatedClients();
    const response = await app.inject({ method: 'GET', url: `/api/v1/projects?${query}`, headers: { authorization: `Bearer ${coordToken}` } });
    expect(response.statusCode).toBe(400);
  });
  it.each([123, null, {}, ['2026-10-01']].map((factDate) => ({ factDate })))('rejects an invalid factDate type (%j)', async ({ factDate }) => {
    const { app, coordToken } = await setupAuthenticatedClients();
    const response = await app.inject({ method: 'POST', url: '/api/v1/projects',
      headers: { authorization: `Bearer ${coordToken}`, 'idempotency-key': '01963000-0000-7000-8000-000000000902' },
      payload: { name: 'Synthetic Project', startDate: '2026-10-01', factDate } });
    expect(response.statusCode).toBe(422);
  });
  it('rejects client identifiers and unknown fields instead of silently discarding them', async () => {
    const { app, coordToken } = await setupAuthenticatedClients();
    for (const additional of [{ id: COORD_ID }, { unexpectedField: 'unexpected' }]) {
      const response = await app.inject({ method: 'POST', url: '/api/v1/projects',
        headers: { authorization: `Bearer ${coordToken}`, 'idempotency-key': '01963000-0000-7000-8000-000000000901' },
        payload: { name: 'Synthetic Project', startDate: '2026-10-01', ...additional } });
      expect(response.statusCode).toBe(400);
    }
  });
  async function setupAuthenticatedClients() {
    const fixedClock = () => new Date('2026-04-14T15:00:00.000Z');
    const auditTrail = new InMemoryAuditTrail(fixedClock);
    const app = createApp({
      checkDatabase: async () => {},
      clock: fixedClock,
      auditTrail,
      seedUsers: [
        {
          id: ADMIN_ID,
          loginIdentifier: 'admin@luz.org',
          displayName: 'Admin',
          password: 'Password!123',
          profiles: ['ADMIN'],
        },
        {
          id: COORD_ID,
          loginIdentifier: 'coord@luz.org',
          displayName: 'Coordenadora',
          password: 'Password!123',
          profiles: ['COORDINATOR'],
        },
        {
          id: EDUCATOR_ID,
          loginIdentifier: 'educador@luz.org',
          displayName: 'Educador',
          password: 'Password!123',
          profiles: ['PERIODIC_ACTIVITY'],
        },
        {
          id: BAZAR_ID,
          loginIdentifier: 'bazar@luz.org',
          displayName: 'Operador Bazar',
          password: 'Password!123',
          profiles: ['BAZAR'],
        },
      ],
    });
    onTestFinished(() => app.close());

    const loginAs = async (login: string) => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { loginIdentifier: login, password: 'Password!123' },
      });
      return res.json().sessionToken as string;
    };

    return {
      app,
      auditTrail,
      adminToken: await loginAs('admin@luz.org'),
      coordToken: await loginAs('coord@luz.org'),
      educatorToken: await loginAs('educador@luz.org'),
      bazarToken: await loginAs('bazar@luz.org'),
    };
  }

  it('lists the 6 canonical Institutes and blocks unauthenticated, ADMIN-only, or BAZAR-only access (RF-ATV-01 / AC-52)', async () => {
    const { app, adminToken, coordToken, educatorToken, bazarToken } =
      await setupAuthenticatedClients();

    const unauthRes = await app.inject({ method: 'GET', url: '/api/v1/institutes' });
    expect(unauthRes.statusCode).toBe(401);

    const adminForbidden = await app.inject({
      method: 'GET',
      url: '/api/v1/institutes',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(adminForbidden.statusCode).toBe(403);

    const bazarForbidden = await app.inject({
      method: 'GET',
      url: '/api/v1/institutes',
      headers: { authorization: `Bearer ${bazarToken}` },
    });
    expect(bazarForbidden.statusCode).toBe(403);

    const educatorAllowed = await app.inject({
      method: 'GET',
      url: '/api/v1/institutes',
      headers: { authorization: `Bearer ${educatorToken}` },
    });
    expect(educatorAllowed.statusCode).toBe(200);

    const coordAllowed = await app.inject({
      method: 'GET',
      url: '/api/v1/institutes',
      headers: { authorization: `Bearer ${coordToken}` },
    });
    expect(coordAllowed.statusCode).toBe(200);
    const institutes = coordAllowed.json().items as Array<{ id: string; code: string; name: string }>;
    expect(institutes).toHaveLength(6);
    expect(institutes.map((i) => i.name)).toEqual([
      'Criança',
      'Jovem',
      'Esclarecimento e Família',
      'Caridade',
      'Divulgação',
      'Mediunidade',
    ]);
  });

  it('creates projects with 0, 1, or multiple Institutes while LAC-04 is pending, enforces period/reference validation, and replays idempotent requests (RF-ATV-02 / LAC-04 / AC-58)', async () => {
    const { app, coordToken, educatorToken } = await setupAuthenticatedClients();

    const instRes = await app.inject({
      method: 'GET',
      url: '/api/v1/institutes',
      headers: { authorization: `Bearer ${coordToken}` },
    });
    const institutes = instRes.json().items as Array<{ id: string; code: string; name: string }>;
    const criancaId = institutes[0]!.id;
    const jovemId = institutes[1]!.id;

    // Educator (PERIODIC_ACTIVITY) can read projects but cannot create (AC-52)
    const educatorCreate = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: {
        authorization: `Bearer ${educatorToken}`,
        'idempotency-key': '01963000-0000-7000-8000-000000000201',
      },
      payload: {
        name: 'Projeto Não Autorizado',
        startDate: '2026-03-01',
      },
    });
    expect(educatorCreate.statusCode).toBe(403);

    // Project with 0 institutes (unassigned / cross-institute while LAC-04 is pending)
    const zeroInstRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: {
        authorization: `Bearer ${coordToken}`,
        'idempotency-key': '01963000-0000-7000-8000-000000000202',
      },
      payload: {
        name: 'Mutirão Comunitário Geral',
        description: 'Projeto institucional sem vínculo exclusivo.',
        startDate: '2026-03-01',
        instituteIds: [],
      },
    });
    expect(zeroInstRes.statusCode).toBe(201);
    expect(zeroInstRes.json()).toMatchObject({
      name: 'Mutirão Comunitário Geral',
      status: 'ACTIVE',
      institutes: [],
      version: 1,
    });

    // Project with 1 institute
    const singleInstRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: {
        authorization: `Bearer ${coordToken}`,
        'idempotency-key': '01963000-0000-7000-8000-000000000203',
      },
      payload: {
        name: 'Reforço Escolar Infantil',
        startDate: '2026-03-01',
        endDate: '2026-12-15',
        instituteIds: [criancaId],
      },
    });
    expect(singleInstRes.statusCode).toBe(201);
    expect(singleInstRes.json().institutes).toHaveLength(1);
    expect(singleInstRes.json().institutes[0].name).toBe('Criança');

    // Project with multiple institutes (non-exclusive linkage, AC-58)
    const multiInstRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: {
        authorization: `Bearer ${coordToken}`,
        'idempotency-key': '01963000-0000-7000-8000-000000000204',
      },
      payload: {
        name: 'Orquestra Infantojuvenil',
        startDate: '2026-03-01',
        instituteIds: [criancaId, jovemId],
      },
    });
    expect(multiInstRes.statusCode).toBe(201);
    expect(multiInstRes.json().institutes.map((i: { name: string }) => i.name)).toEqual([
      'Criança',
      'Jovem',
    ]);

    // Idempotent replay returns identical project
    const multiReplay = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: {
        authorization: `Bearer ${coordToken}`,
        'idempotency-key': '01963000-0000-7000-8000-000000000204',
      },
      payload: {
        name: 'Orquestra Infantojuvenil',
        startDate: '2026-03-01',
        instituteIds: [criancaId, jovemId],
      },
    });
    expect(multiReplay.statusCode).toBe(201);
    expect(multiReplay.json().id).toBe(multiInstRes.json().id);

    // Rejects invalid period endDate <= startDate (VAL-04) and nonexistent instituteId (VAL-07)
    const invalidRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: {
        authorization: `Bearer ${coordToken}`,
        'idempotency-key': '01963000-0000-7000-8000-000000000205',
      },
      payload: {
        name: 'Projeto Inválido',
        startDate: '2026-06-10',
        endDate: '2026-06-01',
        instituteIds: ['01963000-0000-7000-8000-999999999999'],
      },
    });
    expect(invalidRes.statusCode).toBe(422);
    expect(invalidRes.json()).toMatchObject({
      code: 'VALIDATION_FAILED',
      errors: expect.arrayContaining([
        expect.objectContaining({ field: 'endDate', code: 'INVALID_PERIOD' }),
        expect.objectContaining({ field: 'instituteIds', code: 'REFERENCE_NOT_FOUND' }),
      ]),
    });
  });

  it('updates and closes projects with optimistic concurrency, mandatory justification, audit trail, and preserved history (RF-ATV-02 / RF-ATV-08 / OP-03 / VAL-10)', async () => {
    const { app, auditTrail, coordToken, educatorToken } = await setupAuthenticatedClients();

    const instRes = await app.inject({
      method: 'GET',
      url: '/api/v1/institutes',
      headers: { authorization: `Bearer ${coordToken}` },
    });
    const institutes = instRes.json().items as Array<{ id: string; code: string; name: string }>;
    const caridadeId = institutes[3]!.id;

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: {
        authorization: `Bearer ${coordToken}`,
        'idempotency-key': '01963000-0000-7000-8000-000000000301',
      },
      payload: {
        name: 'Oficina de Costura Solidária',
        startDate: '2026-02-01',
        factDate: '2026-02-01',
      },
    });
    const project = createRes.json();

    // Update without reason is rejected (VAL-10)
    const missingReasonRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${project.id as string}`,
      headers: {
        authorization: `Bearer ${coordToken}`,
        'idempotency-key': '01963000-0000-7000-8000-000000000302',
      },
      payload: {
        version: 1,
        instituteIds: [caridadeId],
        reason: '   ',
      },
    });
    expect(missingReasonRes.statusCode).toBe(422);

    // Valid update links institute and increments version
    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${project.id as string}`,
      headers: {
        authorization: `Bearer ${coordToken}`,
        'idempotency-key': '01963000-0000-7000-8000-000000000303',
      },
      payload: {
        version: 1,
        name: 'Oficina de Costura e Artesanato Solidário',
        instituteIds: [caridadeId],
        reason: 'Vinculação ao Instituto da Caridade e ampliação de escopo.',
        factDate: '2026-03-10',
      },
    });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json()).toMatchObject({
      id: project.id,
      name: 'Oficina de Costura e Artesanato Solidário',
      version: 2,
      institutes: [expect.objectContaining({ name: 'Caridade' })],
    });

    // Stale version rejected with 409 STALE_VERSION
    const stalePatch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${project.id as string}`,
      headers: {
        authorization: `Bearer ${coordToken}`,
        'idempotency-key': '01963000-0000-7000-8000-000000000304',
      },
      payload: {
        version: 1,
        name: 'Tentativa Concorrente',
        reason: 'Conflito de versão.',
      },
    });
    expect(stalePatch.statusCode).toBe(409);
    expect(stalePatch.json()).toMatchObject({ code: 'STALE_VERSION' });

    // Close project preserves record and sets status = CLOSED (RF-ATV-08)
    const closeRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id as string}/close`,
      headers: {
        authorization: `Bearer ${coordToken}`,
        'idempotency-key': '01963000-0000-7000-8000-000000000305',
      },
      payload: {
        version: 2,
        endDate: '2026-11-30',
        reason: 'Conclusão do ciclo anual da oficina.',
        factDate: '2026-11-30',
      },
    });
    expect(closeRes.statusCode).toBe(200);
    expect(closeRes.json()).toMatchObject({
      id: project.id,
      status: 'CLOSED',
      endDate: '2026-11-30',
      version: 3,
      closedAt: '2026-04-14T15:00:00.000Z',
    });

    // Closed project remains readable in GET /api/v1/projects/:id and GET /api/v1/projects?status=CLOSED
    const getClosedRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id as string}`,
      headers: { authorization: `Bearer ${educatorToken}` },
    });
    expect(getClosedRes.statusCode).toBe(200);
    expect(getClosedRes.json().status).toBe('CLOSED');

    const listClosedRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects?status=CLOSED&instituteId=${caridadeId}`,
      headers: { authorization: `Bearer ${educatorToken}` },
    });
    expect(listClosedRes.statusCode).toBe(200);
    expect(listClosedRes.json().items).toHaveLength(1);

    // Audit trail captured CREATE, UPDATE, and CLOSE with distinct factDate and recordedAt
    const projectAudits = await auditTrail.listByEntity('PROJECT', project.id as string);
    expect(projectAudits.map((entry) => entry.action)).toEqual(['CREATE', 'UPDATE', 'CLOSE']);
    expect(projectAudits[1]!.factDate).toBe('2026-03-10');
    expect(projectAudits[1]!.recordedAt).toBe('2026-04-14T15:00:00.000Z');
    expect(projectAudits[2]!.reason).toBe('Conclusão do ciclo anual da oficina.');
  });
});
