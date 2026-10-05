import { describe, expect, it } from 'vitest';
import { decodeJwt } from 'jose';
import type { UserDto } from '@erp/contracts/access-api';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
const fixture = setupIntegrationFixture();
describe('Persistent session revocation', () => {
  it('revokes reset and deactivation in PostgreSQL without deleting Redis session keys', async () => {
    const {
      operator,
      runtime,
      headers,
      adminCookie,
      initialPassword,
      config,
      login,
    } = fixture;
    const user = await operator('synthetic.revocation', ['SOCIAL_ASSISTANCE']);
    const sessionId = String(decodeJwt(user.token).jti);
    const reset = await runtime.app.inject({
      method: 'PUT',
      url: `/api/v1/users/${user.user.id}/password`,
      headers: headers(adminCookie),
      payload: {
        expectedRevision: user.user.revision,
        temporaryPassword: initialPassword,
        reason: 'Synthetic reset',
      },
    });
    expect(reset.statusCode).toBe(200);
    expect(
      await runtime.redis.exists(
        `${config.REDIS_KEY_PREFIX}session:${sessionId}`,
      ),
    ).toBe(1);
    expect(
      (
        await runtime.app.inject({
          method: 'GET',
          url: '/api/v1/auth/session',
          headers: { cookie: user.cookie },
        })
      ).statusCode,
    ).toBe(401);
    const updated = reset.json<{ data: UserDto }>().data;
    const newSession = await login(user.user.login, initialPassword);
    const deactivate = await runtime.app.inject({
      method: 'POST',
      url: `/api/v1/users/${updated.id}/activation`,
      headers: headers(adminCookie),
      payload: {
        expectedRevision: updated.revision,
        active: false,
        reason: 'Synthetic deactivation',
      },
    });
    expect(deactivate.statusCode).toBe(200);
    expect(
      (
        await runtime.app.inject({
          method: 'POST',
          url: `/api/v1/users/${updated.id}/activation`,
          headers: headers(adminCookie),
          payload: {
            expectedRevision: deactivate.json().data.revision,
            active: true,
            reason: 'Synthetic reactivation',
          },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await runtime.app.inject({
          method: 'GET',
          url: '/api/v1/auth/session',
          headers: { cookie: newSession.cookie },
        })
      ).statusCode,
    ).toBe(401);
  });
});
