import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import type { ApiConfig } from '../../../core/infra/config.js';
import { AuthenticationRequiredError } from '../application/access-errors.js';
import type { TokenSigner } from '../application/ports.js';
const uuid = z.uuid();
export function createTokenSigner(config: ApiConfig): TokenSigner {
  return {
    sign: (session) =>
      new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(session.userId)
        .setJti(session.id)
        .setIssuer(config.JWT_ISSUER)
        .setAudience(config.JWT_AUDIENCE)
        .setIssuedAt(Math.floor(session.createdAt / 1000))
        .setExpirationTime(Math.floor(session.absoluteExpiresAt / 1000))
        .sign(config.jwtSecret),
    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, config.jwtSecret, {
          algorithms: ['HS256'],
          issuer: config.JWT_ISSUER,
          audience: config.JWT_AUDIENCE,
          requiredClaims: ['sub', 'jti', 'iat', 'exp'],
        });
        return {
          userId: uuid.parse(payload.sub),
          sessionId: uuid.parse(payload.jti),
        };
      } catch {
        throw new AuthenticationRequiredError();
      }
    },
  };
}
