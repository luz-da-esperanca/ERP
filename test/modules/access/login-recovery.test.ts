import { describe, expect, it, onTestFinished } from 'vitest';
import { createApp } from '../../../src/server/app.ts';

const credentials = { loginIdentifier: 'recovery@example.invalid', password: 'SyntheticPassword!123' };
const browserHeaders = { host: '127.0.0.1:5173', origin: 'http://127.0.0.1:5173' };

describe('Browser login recovery', () => {
  it.each(['active', 'expired', 'revoked', 'unknown'] as const)(
    'accepts valid credentials without a previous CSRF verifier when the cookie is %s', async (cookieState) => {
      let now = new Date('2026-10-25T12:00:00.000Z');
      const app = createApp({ checkDatabase: async () => {}, clock: () => now, seedUsers: [{
        id: '01963000-0000-7000-8000-000000000001', ...credentials,
        displayName: 'Synthetic Administrator', profiles: ['ADMIN'],
      }] });
      onTestFinished(() => app.close());
      const original = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: credentials });
      expect(original.statusCode).toBe(200);
      const cookie = cookieState === 'unknown' ? 'erp_session=unknown-synthetic-session'
        : String(original.headers['set-cookie']).split(';')[0] ?? '';
      if (cookieState === 'expired') now = new Date('2026-10-25T12:31:00.000Z');
      if (cookieState === 'revoked') {
        const logout = await app.inject({ method: 'POST', url: '/api/v1/auth/logout',
          headers: { authorization: `Bearer ${String(original.json().sessionToken)}` } });
        expect(logout.statusCode).toBe(204);
      }
      if (cookieState !== 'active') {
        expect((await app.inject({ method: 'GET', url: '/api/v1/auth/session', headers: { cookie } })).statusCode).toBe(401);
      }

      const recovered = await app.inject({ method: 'POST', url: '/api/v1/auth/login',
        headers: { ...browserHeaders, cookie }, payload: credentials });

      expect(recovered.statusCode).toBe(200);
      expect(recovered.json()).toMatchObject({ user: { profiles: ['ADMIN'] }, csrfToken: expect.any(String) });
      expect(recovered.headers['set-cookie']).toBeDefined();
      const nextCookie = String(recovered.headers['set-cookie']).split(';')[0] ?? '';
      expect((await app.inject({ method: 'GET', url: '/api/v1/auth/session', headers: { cookie: nextCookie } })).statusCode).toBe(200);
      const protectedMutation = await app.inject({ method: 'POST', url: '/api/v1/auth/logout',
        headers: { ...browserHeaders, cookie: nextCookie } });
      expect(protectedMutation.statusCode).toBe(403);
      expect(protectedMutation.json().code).toBe('CSRF_REJECTED');
    },
  );

  it('still rejects cross-origin login with an existing cookie before issuing a session', async () => {
    const app = createApp({ checkDatabase: async () => {}, seedUsers: [{
      id: '01963000-0000-7000-8000-000000000001', ...credentials,
      displayName: 'Synthetic Administrator', profiles: ['ADMIN'],
    }] });
    onTestFinished(() => app.close());
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: credentials });
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/login',
      headers: { ...browserHeaders, origin: 'https://attacker.example', cookie: String(login.headers['set-cookie']).split(';')[0] ?? '' },
      payload: credentials });
    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe('CSRF_REJECTED');
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it.each([
    { origin: 'https://erp.example', expectedStatus: 200 },
    { origin: 'http://erp.example', expectedStatus: 403 },
    { origin: 'https://erp.example/path', expectedStatus: 403 },
  ])('validates the complete public origin behind HTTPS termination ($origin)', async ({ origin, expectedStatus }) => {
    const app = createApp({ checkDatabase: async () => {}, secureCookies: true, seedUsers: [{
      id: '01963000-0000-7000-8000-000000000001', ...credentials,
      displayName: 'Synthetic Administrator', profiles: ['ADMIN'],
    }] });
    onTestFinished(() => app.close());
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/login',
      headers: { host: 'erp.example', origin }, payload: credentials });
    expect(response.statusCode).toBe(expectedStatus);
    if (expectedStatus === 403) expect(response.headers['set-cookie']).toBeUndefined();
  });
});
