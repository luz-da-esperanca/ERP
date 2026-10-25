import { describe, expect, it, onTestFinished } from 'vitest';
import { InMemoryAuditTrail } from '../../../src/modules/shared/infrastructure/in-memory-audit-and-idempotency.ts';
import { createApp } from '../../../src/server/app.ts';

const COORD_ID = '01963000-0000-7000-8000-000000000101';
const STOCK_ID = '01963000-0000-7000-8000-000000000102';
const SOCIAL_ID = '01963000-0000-7000-8000-000000000103';
const ADMIN_ID = '01963000-0000-7000-8000-000000000104';
const BAZAR_ID = '01963000-0000-7000-8000-000000000105';
const PERIODIC_ID = '01963000-0000-7000-8000-000000000106';
const POINT_ID = '01963000-0000-7000-8000-000000000107';

const FIXED_NOW = () => new Date('2026-10-25T12:00:00.000Z');

interface Client {
  readonly app: ReturnType<typeof createApp>;
  readonly auditTrail: InMemoryAuditTrail;
  readonly tokens: Readonly<Record<string, string>>;
}

async function setupAuthenticatedClients(): Promise<Client> {
  const auditTrail = new InMemoryAuditTrail(FIXED_NOW);
  const app = createApp({
    checkDatabase: async () => {},
    clock: FIXED_NOW,
    auditTrail,
    seedUsers: [
      { id: COORD_ID, loginIdentifier: 'coord@luz.org', displayName: 'Coordenadora', password: 'Password!123', profiles: ['COORDINATOR'] },
      { id: STOCK_ID, loginIdentifier: 'estoque@luz.org', displayName: 'Estoque', password: 'Password!123', profiles: ['STOCK_DISTRIBUTION'] },
      { id: SOCIAL_ID, loginIdentifier: 'social@luz.org', displayName: 'Assistente Social', password: 'Password!123', profiles: ['SOCIAL_ASSISTANCE'] },
      { id: ADMIN_ID, loginIdentifier: 'admin@luz.org', displayName: 'Admin', password: 'Password!123', profiles: ['ADMIN'] },
      { id: BAZAR_ID, loginIdentifier: 'bazar@luz.org', displayName: 'Operador Bazar', password: 'Password!123', profiles: ['BAZAR'] },
      { id: PERIODIC_ID, loginIdentifier: 'periodico@luz.org', displayName: 'Educador', password: 'Password!123', profiles: ['PERIODIC_ACTIVITY'] },
      { id: POINT_ID, loginIdentifier: 'pontual@luz.org', displayName: 'Atendente', password: 'Password!123', profiles: ['POINT_IN_TIME_SERVICE'] },
    ],
  });
  onTestFinished(() => app.close());

  const tokens: Record<string, string> = {};
  for (const login of ['coord@luz.org', 'estoque@luz.org', 'social@luz.org', 'admin@luz.org', 'bazar@luz.org', 'periodico@luz.org', 'pontual@luz.org']) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginIdentifier: login, password: 'Password!123' },
    });
    tokens[login] = res.json().sessionToken as string;
  }

  return { app, auditTrail, tokens };
}

function key(seed: number): string {
  return `01963000-0000-7000-8000-00000000${String(seed).padStart(4, '0')}`;
}

describe('Stock Origins HTTP API (G-02 / RF-EST-02 / RF-EST-03 / RF-BAZ-04 / RF-ACS-03)', () => {
  it('allows creation for COORDINATOR and STOCK_DISTRIBUTION and read-only access for SOCIAL_ASSISTANCE', async () => {
    const { app, tokens } = await setupAuthenticatedClients();

    const coordCreate = await app.inject({
      method: 'POST',
      url: '/api/v1/stock-origins',
      headers: { authorization: `Bearer ${tokens['coord@luz.org']}`, 'idempotency-key': key(1001) },
      payload: { kind: 'INDIVIDUAL_DONOR', name: '  Doador Pessoa Física 001  ' },
    });
    expect(coordCreate.statusCode).toBe(201);
    expect(coordCreate.json()).toMatchObject({
      kind: 'INDIVIDUAL_DONOR',
      name: 'Doador Pessoa Física 001',
      isExternalDonation: true,
      isSystemManaged: false,
      createdAt: '2026-10-25T12:00:00.000Z',
    });

    const stockCreate = await app.inject({
      method: 'POST',
      url: '/api/v1/stock-origins',
      headers: { authorization: `Bearer ${tokens['estoque@luz.org']}`, 'idempotency-key': key(1002) },
      payload: { kind: 'COMPANY_DONOR', name: 'Empresa Sintética Ltda' },
    });
    expect(stockCreate.statusCode).toBe(201);

    const socialRead = await app.inject({
      method: 'GET',
      url: '/api/v1/stock-origins',
      headers: { authorization: `Bearer ${tokens['social@luz.org']}` },
    });
    expect(socialRead.statusCode).toBe(200);

    const socialCreate = await app.inject({
      method: 'POST',
      url: '/api/v1/stock-origins',
      headers: { authorization: `Bearer ${tokens['social@luz.org']}`, 'idempotency-key': key(1003) },
      payload: { kind: 'CAMPAIGN', name: 'Campanha Não Autorizada' },
    });
    expect(socialCreate.statusCode).toBe(403);
  });

  it('gives no implicit access to ADMIN, BAZAR, PERIODIC_ACTIVITY or POINT_IN_TIME_SERVICE', async () => {
    const { app, tokens } = await setupAuthenticatedClients();

    const forbiddenLogins = ['admin@luz.org', 'bazar@luz.org', 'periodico@luz.org', 'pontual@luz.org'];
    for (const login of forbiddenLogins) {
      const list = await app.inject({
        method: 'GET',
        url: '/api/v1/stock-origins',
        headers: { authorization: `Bearer ${tokens[login]}` },
      });
      expect(list.statusCode).toBe(403);

      const create = await app.inject({
        method: 'POST',
        url: '/api/v1/stock-origins',
        headers: { authorization: `Bearer ${tokens[login]}`, 'idempotency-key': key(1010) },
        payload: { kind: 'CAMPAIGN', name: 'Campanha Sem Permissão' },
      });
      expect(create.statusCode).toBe(403);
    }

    const anonymous = await app.inject({ method: 'GET', url: '/api/v1/stock-origins' });
    expect(anonymous.statusCode).toBe(401);
  });

  it('lists the system origins with the correct flags and never exposes financial or CRM fields', async () => {
    const { app, tokens } = await setupAuthenticatedClients();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/stock-origins',
      headers: { authorization: `Bearer ${tokens['coord@luz.org']}` },
    });
    expect(response.statusCode).toBe(200);
    const page = response.json() as { items: Array<Record<string, unknown>>; totalItems: number };
    expect(page.totalItems).toBe(2);

    const unknown = page.items.find((item) => item.kind === 'UNKNOWN');
    const bazar = page.items.find((item) => item.kind === 'BAZAR_TRANSFER');
    expect(unknown).toMatchObject({
      id: '01963000-0000-7000-8000-000000000701',
      name: 'Origem desconhecida',
      isExternalDonation: true,
      isSystemManaged: true,
    });
    expect(bazar).toMatchObject({
      id: '01963000-0000-7000-8000-000000000702',
      name: 'Transferência do Bazar',
      isExternalDonation: false,
      isSystemManaged: true,
    });

    const forbiddenKeys = ['value', 'estimatedValue', 'amount', 'currency', 'cpf', 'cnpj', 'email', 'phone', 'address', 'campaignGoal'];
    for (const item of page.items) {
      for (const forbidden of forbiddenKeys) {
        expect(Object.keys(item)).not.toContain(forbidden);
      }
    }
  });

  it('rejects creation of the system-managed kinds with 422', async () => {
    const { app, tokens } = await setupAuthenticatedClients();

    for (const [index, kind] of ['UNKNOWN', 'BAZAR_TRANSFER'].entries()) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/stock-origins',
        headers: { authorization: `Bearer ${tokens['coord@luz.org']}`, 'idempotency-key': key(1020 + index) },
        payload: { kind, name: 'Origem Inválida' },
      });
      expect(response.statusCode).toBe(422);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
    }

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/stock-origins',
      headers: { authorization: `Bearer ${tokens['coord@luz.org']}` },
    });
    expect((list.json() as { totalItems: number }).totalItems).toBe(2);
  });

  it('filters by kind, searches by name and paginates with the shared page shape', async () => {
    const { app, tokens } = await setupAuthenticatedClients();
    const created = [
      { kind: 'CAMPAIGN', name: 'Campanha Natal Solidário' },
      { kind: 'COMPANY_DONOR', name: 'Empresa Sintética Ltda' },
      { kind: 'INDIVIDUAL_DONOR', name: 'Doador Pessoa Física 001' },
    ];
    for (const [index, payload] of created.entries()) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/stock-origins',
        headers: { authorization: `Bearer ${tokens['coord@luz.org']}`, 'idempotency-key': key(1030 + index) },
        payload,
      });
      expect(response.statusCode).toBe(201);
    }

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/stock-origins',
      headers: { authorization: `Bearer ${tokens['coord@luz.org']}` },
    });
    const page = list.json() as { items: Array<{ name: string }>; page: number; pageSize: number; totalItems: number; totalPages: number };
    expect(page).toMatchObject({ page: 1, pageSize: 20, totalItems: 5, totalPages: 1 });
    expect(page.items.map((item) => item.name)).toEqual([
      'Campanha Natal Solidário',
      'Doador Pessoa Física 001',
      'Empresa Sintética Ltda',
      'Origem desconhecida',
      'Transferência do Bazar',
    ]);

    const filtered = await app.inject({
      method: 'GET',
      url: '/api/v1/stock-origins?kind=COMPANY_DONOR',
      headers: { authorization: `Bearer ${tokens['coord@luz.org']}` },
    });
    expect(filtered.json()).toMatchObject({ totalItems: 1, totalPages: 1 });
    expect((filtered.json() as { items: Array<{ name: string }> }).items[0]!.name).toBe('Empresa Sintética Ltda');

    const searched = await app.inject({
      method: 'GET',
      url: '/api/v1/stock-origins?search=CAMPANHA',
      headers: { authorization: `Bearer ${tokens['coord@luz.org']}` },
    });
    expect((searched.json() as { totalItems: number }).totalItems).toBe(1);

    const firstPage = await app.inject({
      method: 'GET',
      url: '/api/v1/stock-origins?page=1&pageSize=2',
      headers: { authorization: `Bearer ${tokens['coord@luz.org']}` },
    });
    const lastPage = await app.inject({
      method: 'GET',
      url: '/api/v1/stock-origins?page=3&pageSize=2',
      headers: { authorization: `Bearer ${tokens['coord@luz.org']}` },
    });
    expect(firstPage.json()).toMatchObject({ page: 1, pageSize: 2, totalItems: 5, totalPages: 3 });
    expect(lastPage.json()).toMatchObject({ page: 3, pageSize: 2, totalItems: 5, totalPages: 3 });
    expect((lastPage.json() as { items: Array<{ name: string }> }).items.map((item) => item.name)).toEqual([
      'Transferência do Bazar',
    ]);
  });

  it('rejects malformed or unknown query parameters with 400', async () => {
    const { app, tokens } = await setupAuthenticatedClients();
    for (const query of ['kind=DONOR', 'search=' + 'x'.repeat(151), 'unexpected=value', 'page=0', 'pageSize=101']) {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/stock-origins?${query}`,
        headers: { authorization: `Bearer ${tokens['coord@luz.org']}` },
      });
      expect(response.statusCode).toBe(400);
    }
  });

  it('returns 404 for unknown or malformed origin identifiers', async () => {
    const { app, tokens } = await setupAuthenticatedClients();

    const missing = await app.inject({
      method: 'GET',
      url: '/api/v1/stock-origins/01963000-0000-7000-8000-0000000007ff',
      headers: { authorization: `Bearer ${tokens['coord@luz.org']}` },
    });
    expect(missing.statusCode).toBe(404);

    const malformed = await app.inject({
      method: 'GET',
      url: '/api/v1/stock-origins/not-a-uuid',
      headers: { authorization: `Bearer ${tokens['coord@luz.org']}` },
    });
    expect(malformed.statusCode).toBe(404);

    const existing = await app.inject({
      method: 'GET',
      url: '/api/v1/stock-origins/01963000-0000-7000-8000-000000000702',
      headers: { authorization: `Bearer ${tokens['coord@luz.org']}` },
    });
    expect(existing.statusCode).toBe(200);
    expect(existing.json()).toMatchObject({ kind: 'BAZAR_TRANSFER', isExternalDonation: false });
  });

  it('requires a valid Idempotency-Key and rejects unknown body fields with 400', async () => {
    const { app, tokens } = await setupAuthenticatedClients();
    const headers = { authorization: `Bearer ${tokens['coord@luz.org']}` };

    const missingKey = await app.inject({
      method: 'POST',
      url: '/api/v1/stock-origins',
      headers,
      payload: { kind: 'CAMPAIGN', name: 'Campanha Sintética' },
    });
    expect(missingKey.statusCode).toBe(400);

    const invalidKey = await app.inject({
      method: 'POST',
      url: '/api/v1/stock-origins',
      headers: { ...headers, 'idempotency-key': 'not-a-uuid' },
      payload: { kind: 'CAMPAIGN', name: 'Campanha Sintética' },
    });
    expect(invalidKey.statusCode).toBe(400);

    const unknownField = await app.inject({
      method: 'POST',
      url: '/api/v1/stock-origins',
      headers: { ...headers, 'idempotency-key': key(1041) },
      payload: { kind: 'CAMPAIGN', name: 'Campanha Sintética', estimatedValue: 10 },
    });
    expect(unknownField.statusCode).toBe(400);

    const clientIdentifier = await app.inject({
      method: 'POST',
      url: '/api/v1/stock-origins',
      headers: { ...headers, 'idempotency-key': key(1042) },
      payload: { id: COORD_ID, kind: 'CAMPAIGN', name: 'Campanha Sintética' },
    });
    expect(clientIdentifier.statusCode).toBe(400);
  });

  it('replays an identical request and conflicts on a divergent payload for the same key', async () => {
    const { app, tokens, auditTrail } = await setupAuthenticatedClients();
    const headers = {
      authorization: `Bearer ${tokens['coord@luz.org']}`,
      'idempotency-key': key(1050),
    };
    const payload = { kind: 'CAMPAIGN', name: 'Campanha Arrecadação de Agasalhos' };

    const first = await app.inject({ method: 'POST', url: '/api/v1/stock-origins', headers, payload });
    const replay = await app.inject({ method: 'POST', url: '/api/v1/stock-origins', headers, payload });
    expect(first.statusCode).toBe(201);
    expect(replay.statusCode).toBe(201);
    expect(replay.json().id).toBe(first.json().id);

    const conflict = await app.inject({
      method: 'POST',
      url: '/api/v1/stock-origins',
      headers,
      payload: { kind: 'CAMPAIGN', name: 'Outra Campanha' },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/stock-origins?kind=CAMPAIGN',
      headers,
    });
    expect((list.json() as { totalItems: number }).totalItems).toBe(1);

    const audits = await auditTrail.listByEntity('STOCK_ORIGIN', first.json().id as string);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorId: COORD_ID,
      entityType: 'STOCK_ORIGIN',
      action: 'CREATE',
      operationId: key(1050),
      before: null,
    });
    expect(audits[0]!.after).toMatchObject({ kind: 'CAMPAIGN', name: 'Campanha Arrecadação de Agasalhos' });
  });
});
