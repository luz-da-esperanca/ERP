import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { SignJWT, decodeJwt } from 'jose';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
const fixture = setupIntegrationFixture();
describe('JWT authentication', () => {
  it('rejects wrong JWT algorithm, issuer, audience, signature and expiration', async () => {
    const { login, admin, config, runtime } = fixture;
    const signedIn = await login(admin.login);
    const valid = decodeJwt(signedIn.token);
    const candidates = [
      await new SignJWT(valid)
        .setProtectedHeader({ alg: 'HS384' })
        .sign(config.jwtSecret),
      await new SignJWT({ ...valid, iss: 'wrong' })
        .setProtectedHeader({ alg: 'HS256' })
        .sign(config.jwtSecret),
      await new SignJWT({ ...valid, aud: 'wrong' })
        .setProtectedHeader({ alg: 'HS256' })
        .sign(config.jwtSecret),
      await new SignJWT(valid)
        .setProtectedHeader({ alg: 'HS256' })
        .sign(randomBytes(32)),
      await new SignJWT({ ...valid, exp: 1 })
        .setProtectedHeader({ alg: 'HS256' })
        .sign(config.jwtSecret),
    ];
    for (const token of candidates)
      expect(
        (
          await runtime.app.inject({
            method: 'GET',
            url: '/api/v1/auth/session',
            headers: { cookie: `${config.cookieName}=${token}` },
          })
        ).statusCode,
      ).toBe(401);
  });
});
