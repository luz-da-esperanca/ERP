import { describe, expect, it, onTestFinished } from 'vitest';
import { createApp } from '../../../src/server/app.ts';

const ADMIN_ID = '01963000-0000-7000-8000-000000000001';
const COORD_ID = '01963000-0000-7000-8000-000000000002';

describe('Server authentication, session lifecycle, RBAC, and user administration (C-02 / AC-52 / AC-53)', () => {
  it('authenticates with normalized login, issues HttpOnly cookie and bearer session, and rejects unknown/wrong/deactivated credentials without enumeration (RF-ACS-01 / VAL-11)', async () => {
    let currentNow = new Date('2026-04-14T12:00:00.000Z');
    const app = createApp({
      checkDatabase: async () => {},
      clock: () => currentNow,
      seedUsers: [
        {
          id: ADMIN_ID,
          login: 'admin@luz.org',
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
      payload: { login: 'inexistente@luz.org', password: 'AdminPassword!123' },
    });
    const wrongPass = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { login: 'admin@luz.org', password: 'WrongPassword!123' },
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
      payload: { login: '  ADMIN@LUZ.ORG  ', password: 'AdminPassword!123' },
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
        login: 'admin@luz.org',
        displayName: 'Administrador Geral',
        status: 'ACTIVE',
        profiles: ['ADMIN'],
      },
      session: {
        id: expect.any(String),
        token: expect.any(String),
      },
    });

    const sessionRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/session',
      headers: { authorization: `Bearer ${body.session.token as string}` },
    });
    expect(sessionRes.statusCode).toBe(200);
    expect(sessionRes.json().user.id).toBe(ADMIN_ID);

    // Advance clock past 30-minute inactivity window (RNF-SEG-03)
    currentNow = new Date('2026-04-14T12:31:00.000Z');
    const expiredRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/session',
      headers: { authorization: `Bearer ${body.session.token as string}` },
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
        lockoutDurationMinutes: 10,
        sessionInactivityMinutes: 30,
      },
      seedUsers: [
        {
          id: ADMIN_ID,
          login: 'admin@luz.org',
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
        payload: { login: 'admin@luz.org', password: 'WrongPassword!' },
      });
      expect(attempt.statusCode).toBe(401);
    }

    const lockedAttempt = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { login: 'admin@luz.org', password: 'AdminPassword!123' },
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
          login: 'admin@luz.org',
          displayName: 'Administrador Geral',
          password: 'AdminPassword!123',
          profiles: ['ADMIN'],
          status: 'ACTIVE',
        },
        {
          id: COORD_ID,
          login: 'coord@luz.org',
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
      payload: { login: 'admin@luz.org', password: 'AdminPassword!123' },
    });
    const adminToken = adminLogin.json().session.token as string;

    // Non-ADMIN user cannot access /api/v1/users (AC-52)
    const coordLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { login: 'coord@luz.org', password: 'CoordPassword!123' },
    });
    const coordToken = coordLogin.json().session.token as string;

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
        login: '  Educador.Joao@Luz.org ',
        displayName: 'João Educador',
        password: 'JoaoPassword!123',
        profiles: ['PERIODIC_ACTIVITY'],
        factDate: '2026-04-14',
      },
    });
    expect(createUserRes.statusCode).toBe(201);
    const createdUser = createUserRes.json();
    expect(createdUser).toMatchObject({
      login: 'educador.joao@luz.org',
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
        login: 'educador.joao@luz.org',
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
      payload: { login: 'educador.joao@luz.org', password: 'JoaoPassword!123' },
    });
    const joaoToken = joaoLogin.json().session.token as string;

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
      payload: { login: 'educador.joao@luz.org', password: 'JoaoPassword!123' },
    });
    expect(joaoLoginAfterDeactivate.statusCode).toBe(401);
    expect(joaoLoginAfterDeactivate.json()).toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });
});

