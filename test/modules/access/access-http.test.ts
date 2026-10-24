import { describe, expect, it, onTestFinished } from 'vitest';
import { createApp } from '../../../src/server/app.ts';

const ADMIN_ID = '01963000-0000-7000-8000-000000000001';
const COORD_ID = '01963000-0000-7000-8000-000000000002';

describe('Server authentication, session lifecycle, RBAC, and user administration (C-02 / AC-52 / AC-53)', () => {
  it('treats a malformed session cookie as an invalid session', async () => {
    const app = createApp({ checkDatabase: async () => {} });
    onTestFinished(() => app.close());
    const response = await app.inject({ method: 'GET', url: '/api/v1/auth/session', headers: { cookie: 'erp_session=%invalid' } });
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe('AUTH_REQUIRED');
  });
  it.each([
    { loginIdentifier: 'x'.repeat(121), password: 'SyntheticPassword!123' },
    { loginIdentifier: {}, password: 'SyntheticPassword!123' },
    { loginIdentifier: 'valid@example.invalid', password: 'x'.repeat(129) },
    { loginIdentifier: 'valid@example.invalid', password: {} },
  ])('validates login types and bounds before accessing credentials (%j)', async (payload) => {
    const app = createApp({ checkDatabase: async () => {} });
    onTestFinished(() => app.close());
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload });
    expect(response.statusCode).toBe(422);
    expect(response.json().code).toBe('VALIDATION_FAILED');
  });
  it('returns the requested user page with consistent totals', async () => {
    const app = createApp({ checkDatabase: async () => {}, seedUsers: [
      { id: ADMIN_ID, loginIdentifier: 'page-admin@example.invalid', displayName: 'Alpha Admin', password: 'SyntheticPassword!123', profiles: ['ADMIN'] },
      { id: COORD_ID, loginIdentifier: 'page-coord@example.invalid', displayName: 'Beta Coordinator', password: 'SyntheticPassword!123', profiles: ['COORDINATOR'] },
    ] });
    onTestFinished(() => app.close());
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { loginIdentifier: 'page-admin@example.invalid', password: 'SyntheticPassword!123' } });
    const response = await app.inject({ method: 'GET', url: '/api/v1/users?page=2&pageSize=1', headers: { authorization: `Bearer ${login.json().sessionToken as string}` } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ page: 2, pageSize: 1, totalItems: 2, totalPages: 2, items: [{ id: COORD_ID }] });
    expect(response.json().items).toHaveLength(1);
  });
  it('rejects a user creation replay with a changed password without exposing either password', async () => {
    const app = createApp({ checkDatabase: async () => {}, seedUsers: [{
      id: ADMIN_ID, loginIdentifier: 'secret-admin@example.invalid', displayName: 'Synthetic Admin',
      password: 'SyntheticPassword!123', profiles: ['ADMIN'],
    }] });
    onTestFinished(() => app.close());
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login',
      payload: { loginIdentifier: 'secret-admin@example.invalid', password: 'SyntheticPassword!123' } });
    const request = { method: 'POST' as const, url: '/api/v1/users',
      headers: { authorization: `Bearer ${login.json().sessionToken as string}`, 'idempotency-key': '01963000-0000-7000-8000-000000000900' },
      payload: { loginIdentifier: 'new@example.invalid', displayName: 'Synthetic User', password: 'OriginalPassword!123', profiles: ['ADMIN'] },
    };
    const first = await app.inject(request);
    expect(first.statusCode).toBe(201);
    const replay = await app.inject(request);
    expect(replay.json()).toEqual(first.json());
    const conflict = await app.inject({ ...request, payload: { ...request.payload, password: 'DifferentPassword!123' } });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().code).toBe('IDEMPOTENCY_CONFLICT');
    expect(first.body + replay.body + conflict.body).not.toContain('OriginalPassword');
    expect(first.body + replay.body + conflict.body).not.toContain('DifferentPassword');
  });
  it.each([true, false])('uses deployment cookie security consistently for login and logout (%j)', async (secureCookies) => {
    const app = createApp({ checkDatabase: async () => {}, secureCookies, seedUsers: [{
      id: ADMIN_ID, loginIdentifier: 'cookie@example.invalid', displayName: 'Synthetic Admin',
      password: 'SyntheticPassword!123', profiles: ['ADMIN'],
    }] });
    onTestFinished(() => app.close());
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login',
      payload: { loginIdentifier: 'cookie@example.invalid', password: 'SyntheticPassword!123' } });
    const logout = await app.inject({ method: 'POST', url: '/api/v1/auth/logout',
      headers: { authorization: `Bearer ${login.json().sessionToken as string}` } });
    expect(logout.statusCode).toBe(204);
    for (const response of [login, logout]) {
      expect(/;\s*Secure(?:;|$)/.test(String(response.headers['set-cookie']))).toBe(secureCookies);
      expect(String(response.headers['set-cookie'])).toContain('HttpOnly');
      expect(String(response.headers['set-cookie'])).toContain('SameSite=Lax');
    }
  });
  it('accepts the published loginIdentifier contract and returns sessionToken and expiresAt', async () => {
    const app = createApp({ checkDatabase: async () => {}, seedUsers: [{
      id: ADMIN_ID, loginIdentifier: 'contract@example.invalid', displayName: 'Synthetic Admin',
      password: 'SyntheticPassword!123', profiles: ['ADMIN'],
    }] });
    onTestFinished(() => app.close());
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/login',
      payload: { loginIdentifier: 'contract@example.invalid', password: 'SyntheticPassword!123' },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({ sessionToken: expect.any(String), expiresAt: expect.any(String),
      user: { loginIdentifier: 'contract@example.invalid' } });
    expect(body).not.toHaveProperty('session');
    const session = await app.inject({ method: 'GET', url: '/api/v1/auth/session',
      headers: { authorization: `Bearer ${body.sessionToken as string}` } });
    expect(session.json()).toMatchObject({ expiresAt: expect.any(String), user: { id: ADMIN_ID } });
  });
  it('authenticates with normalized login, issues HttpOnly cookie and bearer session, and rejects unknown/wrong/deactivated credentials without enumeration (RF-ACS-01 / VAL-11)', async () => {
    let currentNow = new Date('2026-04-14T12:00:00.000Z');
    const app = createApp({
      checkDatabase: async () => {},
      clock: () => currentNow,
      seedUsers: [
        {
          id: ADMIN_ID,
          loginIdentifier: 'admin@luz.org',
          displayName: 'Administrador Geral',
          password: 'AdminPassword!123',
          profiles: ['ADMIN'],
          status: 'ACTIVE',
        },
      ],
    });
    onTestFinished(() => app.close());

    const wrongUser = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginIdentifier: 'inexistente@luz.org', password: 'AdminPassword!123' },
    });
    const wrongPass = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginIdentifier: 'admin@luz.org', password: 'WrongPassword!123' },
    });

    expect(wrongUser.statusCode).toBe(401);
    expect(wrongPass.statusCode).toBe(401);
    expect(wrongUser.json()).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      detail: wrongPass.json().detail,
    });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginIdentifier: '  ADMIN@LUZ.ORG  ', password: 'AdminPassword!123' },
    });

    expect(loginRes.statusCode).toBe(200);
    const setCookieHeader = loginRes.headers['set-cookie'];
    expect(setCookieHeader).toBeDefined();
    expect(String(setCookieHeader)).toContain('erp_session=');
    expect(String(setCookieHeader)).toContain('HttpOnly');

    const body = loginRes.json();
    expect(body).toMatchObject({
      user: {
        id: ADMIN_ID,
        loginIdentifier: 'admin@luz.org',
        displayName: 'Administrador Geral',
        status: 'ACTIVE',
        profiles: ['ADMIN'],
      },
      sessionToken: expect.any(String),
      expiresAt: expect.any(String),
    });

    const sessionRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/session',
      headers: { authorization: `Bearer ${body.sessionToken as string}` },
    });
    expect(sessionRes.statusCode).toBe(200);
    expect(sessionRes.json().user.id).toBe(ADMIN_ID);

    // Advance clock past 30-minute inactivity window (RNF-SEG-03)
    currentNow = new Date('2026-04-14T12:31:00.000Z');
    const expiredRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/session',
      headers: { authorization: `Bearer ${body.sessionToken as string}` },
    });
    expect(expiredRes.statusCode).toBe(401);
    expect(expiredRes.json()).toMatchObject({ code: 'AUTH_REQUIRED' });
  });

  it('locks out repeated failed login attempts with 429 RATE_LIMITED and Retry-After header (RNF-SEG-02)', async () => {
    const currentNow = new Date('2026-04-14T12:00:00.000Z');
    const app = createApp({
      checkDatabase: async () => {},
      clock: () => currentNow,
      securityConfig: {
        maxFailedLoginAttempts: 3,
        lockoutDurationSeconds: 600,
        sessionIdleTimeoutSeconds: 1800,
      },
      seedUsers: [
        {
          id: ADMIN_ID,
          loginIdentifier: 'admin@luz.org',
          displayName: 'Administrador Geral',
          password: 'AdminPassword!123',
          profiles: ['ADMIN'],
          status: 'ACTIVE',
        },
      ],
    });
    onTestFinished(() => app.close());

    for (let i = 0; i < 3; i += 1) {
      const attempt = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { loginIdentifier: 'admin@luz.org', password: 'WrongPassword!' },
      });
      expect(attempt.statusCode).toBe(401);
    }

    const lockedAttempt = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginIdentifier: 'admin@luz.org', password: 'AdminPassword!123' },
    });
    expect(lockedAttempt.statusCode).toBe(429);
    expect(lockedAttempt.headers['retry-after']).toBe('600');
    expect(lockedAttempt.json()).toMatchObject({ code: 'RATE_LIMITED', status: 429 });
  });

  it('enforces explicit profile RBAC without implicit ADMIN access, applies profile updates immediately, and revokes sessions upon deactivation (RF-ACS-02 / RF-ACS-06 / AC-52 / AC-53)', async () => {
    const app = createApp({
      checkDatabase: async () => {},
      seedUsers: [
        {
          id: ADMIN_ID,
          loginIdentifier: 'admin@luz.org',
          displayName: 'Administrador Geral',
          password: 'AdminPassword!123',
          profiles: ['ADMIN'],
          status: 'ACTIVE',
        },
        {
          id: COORD_ID,
          loginIdentifier: 'coord@luz.org',
          displayName: 'Coordenadora Ana',
          password: 'CoordPassword!123',
          profiles: ['COORDINATOR'],
          status: 'ACTIVE',
        },
      ],
    });
    onTestFinished(() => app.close());

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginIdentifier: 'admin@luz.org', password: 'AdminPassword!123' },
    });
    const adminToken = adminLogin.json().sessionToken as string;

    // Non-ADMIN user cannot access /api/v1/users (AC-52)
    const coordLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginIdentifier: 'coord@luz.org', password: 'CoordPassword!123' },
    });
    const coordToken = coordLogin.json().sessionToken as string;

    const forbiddenUsersList = await app.inject({
      method: 'GET',
      url: '/api/v1/users',
      headers: { authorization: `Bearer ${coordToken}` },
    });
    expect(forbiddenUsersList.statusCode).toBe(403);
    expect(forbiddenUsersList.json()).toMatchObject({ code: 'FORBIDDEN' });

    // ADMIN creates a new user with PERIODIC_ACTIVITY profile
    const createUserRes = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'idempotency-key': '01963000-0000-7000-8000-000000000101',
      },
      payload: {
        loginIdentifier: '  Educador.Joao@Luz.org ',
        displayName: 'João Educador',
        password: 'JoaoPassword!123',
        profiles: ['PERIODIC_ACTIVITY'],
        factDate: '2026-04-14',
      },
    });
    expect(createUserRes.statusCode).toBe(201);
    const createdUser = createUserRes.json();
    expect(createdUser).toMatchObject({
      loginIdentifier: 'educador.joao@luz.org',
      displayName: 'João Educador',
      status: 'ACTIVE',
      profiles: ['PERIODIC_ACTIVITY'],
      version: 1,
    });

    // Duplicate login rejected with 409 DUPLICATE_RESOURCE
    const duplicateUserRes = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'idempotency-key': '01963000-0000-7000-8000-000000000102',
      },
      payload: {
        loginIdentifier: 'educador.joao@luz.org',
        displayName: 'Outro João',
        password: 'JoaoPassword!123',
        profiles: ['BAZAR'],
      },
    });
    expect(duplicateUserRes.statusCode).toBe(409);
    expect(duplicateUserRes.json()).toMatchObject({ code: 'DUPLICATE_RESOURCE' });

    // New user logs in
    const joaoLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginIdentifier: 'educador.joao@luz.org', password: 'JoaoPassword!123' },
    });
    const joaoToken = joaoLogin.json().sessionToken as string;

    // ADMIN updates João's profiles to include COORDINATOR + ADMIN
    const updateProfilesRes = await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${createdUser.id as string}/profiles`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        'idempotency-key': '01963000-0000-7000-8000-000000000103',
      },
      payload: {
        version: 1,
        profiles: ['COORDINATOR', 'ADMIN'],
        reason: 'Promovido para apoiar administração de acessos.',
      },
    });
    expect(updateProfilesRes.statusCode).toBe(200);
    expect(updateProfilesRes.json()).toMatchObject({
      version: 2,
      profiles: ['COORDINATOR', 'ADMIN'],
    });

    // Profile change takes effect immediately on João's existing session (AC-53)
    const joaoUsersList = await app.inject({
      method: 'GET',
      url: '/api/v1/users',
      headers: { authorization: `Bearer ${joaoToken}` },
    });
    expect(joaoUsersList.statusCode).toBe(200);

    // Stale version on profile update returns 409 STALE_VERSION
    const staleUpdate = await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${createdUser.id as string}/profiles`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        'idempotency-key': '01963000-0000-7000-8000-000000000104',
      },
      payload: {
        version: 1,
        profiles: ['BAZAR'],
        reason: 'Tentativa com versão antiga.',
      },
    });
    expect(staleUpdate.statusCode).toBe(409);
    expect(staleUpdate.json()).toMatchObject({ code: 'STALE_VERSION' });

    // ADMIN deactivates João -> revokes active session immediately and blocks future login (RF-ACS-06 / AC-53)
    const deactivateRes = await app.inject({
      method: 'POST',
      url: `/api/v1/users/${createdUser.id as string}/deactivate`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        'idempotency-key': '01963000-0000-7000-8000-000000000105',
      },
      payload: {
        version: 2,
        reason: 'Encerramento do vínculo voluntário.',
      },
    });
    expect(deactivateRes.statusCode).toBe(200);
    expect(deactivateRes.json()).toMatchObject({
      status: 'DEACTIVATED',
      version: 3,
    });

    const joaoAfterDeactivate = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/session',
      headers: { authorization: `Bearer ${joaoToken}` },
    });
    expect(joaoAfterDeactivate.statusCode).toBe(401);
    expect(joaoAfterDeactivate.json()).toMatchObject({ code: 'AUTH_REQUIRED' });

    const joaoLoginAfterDeactivate = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginIdentifier: 'educador.joao@luz.org', password: 'JoaoPassword!123' },
    });
    expect(joaoLoginAfterDeactivate.statusCode).toBe(401);
    expect(joaoLoginAfterDeactivate.json()).toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });
});
