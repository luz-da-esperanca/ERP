import { describe, expect, it } from 'vitest';
import { decodeJwt } from 'jose';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
const fixture = setupIntegrationFixture();
describe('Access HTTP routes', () => {
  it('returns explicit safe DTOs and a cookie with no roles or credentials in the JWT', async () => {
    const { login, admin } = fixture;
    const { response, token } = await login(admin.login);
    expect(response.headers['set-cookie']).toContain('HttpOnly');
    expect(response.headers['set-cookie']).toContain('SameSite=Lax');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(Object.keys(decodeJwt(token)).sort()).toEqual([
      'aud',
      'exp',
      'iat',
      'iss',
      'jti',
      'sub',
    ]);
    expect(response.body).not.toContain('passwordHash');
    expect(response.body).not.toContain('authVersion');
    expect(response.body).not.toContain(token);
    expect(response.json().data.capabilities).toEqual([
      'accounts.manage',
      'audit.read',
    ]);
  });
  it('requires password change before domain actions and revokes the initial session', async () => {
    const { createUser, login, initialPassword, runtime, changePassword } =
      fixture;
    const user = await createUser('synthetic.new');
    const signedIn = await login(user.login, initialPassword);
    const denied = await runtime.app.inject({
      method: 'GET',
      url: '/api/v1/users',
      headers: { cookie: signedIn.cookie },
    });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().error.details.rule).toBe('PASSWORD_CHANGE_REQUIRED');
    await changePassword(user, signedIn.cookie);
    expect(
      (
        await runtime.app.inject({
          method: 'GET',
          url: '/api/v1/auth/session',
          headers: { cookie: signedIn.cookie },
        })
      ).statusCode,
    ).toBe(401);
  });
  it('rejects unsafe request origins, missing headers and non-JSON writes without effects', async () => {
    const { initialPassword, headers, adminCookie, runtime } = fixture;
    const payload = {
      login: 'synthetic.csrf',
      displayName: 'Synthetic CSRF',
      initialPassword,
      roleCodes: ['ADMINISTRATOR'],
    };
    for (const overrides of [
      { origin: 'https://elsewhere.example' },
      { origin: undefined },
      { 'x-erp-request': undefined },
      { 'sec-fetch-site': 'cross-site' },
    ]) {
      const requestHeaders = Object.fromEntries(
        Object.entries({ ...headers(adminCookie), ...overrides }).filter(
          ([, value]) => value !== undefined,
        ),
      );
      expect(
        (
          await runtime.app.inject({
            method: 'POST',
            url: '/api/v1/users',
            headers: requestHeaders,
            payload,
          })
        ).statusCode,
      ).toBe(403);
    }
    expect(
      (
        await runtime.app.inject({
          method: 'POST',
          url: '/api/v1/users',
          headers: { ...headers(adminCookie), 'content-type': 'text/plain' },
          payload: '{}',
        })
      ).statusCode,
    ).toBe(415);
    expect(await runtime.database.userAccount.count()).toBe(1);
  });
  it('revokes logout and accepts an already absent session', async () => {
    const { runtime, headers, adminCookie } = fixture;
    const response = await runtime.app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: headers(adminCookie),
      payload: {},
    });
    expect(response.statusCode).toBe(204);
    expect(response.headers['set-cookie']).toContain('Max-Age=0');
    expect(
      (
        await runtime.app.inject({
          method: 'GET',
          url: '/api/v1/auth/session',
          headers: { cookie: adminCookie },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await runtime.app.inject({
          method: 'POST',
          url: '/api/v1/auth/logout',
          headers: headers(),
          payload: {},
        })
      ).statusCode,
    ).toBe(204);
  });
  it('rejects account page sizes above the HTTP limit', async () => {
    const { runtime, adminCookie } = fixture;
    expect(
      (
        await runtime.app.inject({
          method: 'GET',
          url: '/api/v1/users?pageSize=101',
          headers: { cookie: adminCookie },
        })
      ).statusCode,
    ).toBe(400);
  });
});
