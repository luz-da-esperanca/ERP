import { describe, expect, it } from 'vitest';
import { decodeJwt } from 'jose';
import { RedisSessions } from '../../../../src/features/access/infra/redis-sessions.js';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
const fixture = setupIntegrationFixture();
describe('Redis sessions and login limits', () => {
  it('uses generic login failures and atomically blocks repeated attempts', async () => {
    const { runtime, headers, initialPassword } = fixture;
    for (let index = 0; index < 5; index++) {
      const response = await runtime.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: headers(),
        payload: { login: 'synthetic.unknown', password: initialPassword },
      });
      expect(response.statusCode).toBe(401);
      expect(response.json().error.message).toBe('Authentication required');
    }
    const blocked = await runtime.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: headers(),
      payload: { login: 'synthetic.unknown', password: initialPassword },
    });
    expect(blocked.statusCode).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });
  it('clears failures after success and permits retry after the Redis lock expires', async () => {
    const { runtime, admin, login, config } = fixture;
    await runtime.sessions.recordLoginFailure(admin.login);
    await login(admin.login);
    await runtime.sessions.checkLogin(admin.login, 'synthetic-ip');
    for (let index = 0; index < 5; index++)
      await runtime.sessions.recordLoginFailure(admin.login);
    await expect(
      runtime.sessions.checkLogin(admin.login, 'synthetic-ip'),
    ).rejects.toMatchObject({ status: 429 });
    const keys: string[] = [];
    for await (const batch of runtime.redis.scanIterator({
      MATCH: `${config.REDIS_KEY_PREFIX}login:*`,
    }))
      keys.push(...batch);
    for (const key of keys) await runtime.redis.pExpire(key, 1);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await expect(
      runtime.sessions.checkLogin(admin.login, 'synthetic-ip'),
    ).resolves.toBeUndefined();
  });
  it('expires idle and absolute sessions even when Redis still contains them', async () => {
    const { login, admin, runtime, config } = fixture;
    for (const expiration of ['idle', 'absolute']) {
      const signedIn = await login(admin.login);
      const id = String(decodeJwt(signedIn.token).jti);
      const session = await runtime.sessions.read(id, false);
      if (!session) throw new Error('Expected session');
      if (expiration === 'idle')
        session.lastActivityAt =
          Date.now() - config.SESSION_IDLE_SECONDS * 1000;
      else session.absoluteExpiresAt = Date.now() - 1;
      await runtime.redis.set(
        `${config.REDIS_KEY_PREFIX}session:${id}`,
        JSON.stringify(session),
        { EX: 60 },
      );
      expect(
        (
          await runtime.app.inject({
            method: 'GET',
            url: '/api/v1/auth/session',
            headers: { cookie: signedIn.cookie },
          })
        ).statusCode,
      ).toBe(401);
    }
  });
  it('limits IP attempts independently of login counters', async () => {
    const { runtime, config } = fixture;
    const sessions = new RedisSessions(runtime.redis, {
      ...config,
      REDIS_KEY_PREFIX: `${config.REDIS_KEY_PREFIX}ip-test:`,
      LOGIN_IP_MAX_ATTEMPTS: 1,
    });
    await sessions.checkLogin('synthetic.one', '127.0.0.10');
    await expect(
      sessions.checkLogin('synthetic.two', '127.0.0.10'),
    ).rejects.toMatchObject({ status: 429 });
    await expect(
      sessions.checkLogin('synthetic.two', '127.0.0.11'),
    ).resolves.toBeUndefined();
  });
});
