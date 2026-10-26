import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AccessSecurityPort } from '../application/access-security.ts';
import { hashPassword, verifyPassword } from '../../shared/infrastructure/secret-hasher.ts';
export { hashPassword, verifyPassword };

export function generateSessionToken(): { readonly rawToken: string; readonly tokenHash: string } {
  const rawToken = randomBytes(32).toString('base64url');
  return {
    rawToken,
    tokenHash: hashSessionToken(rawToken),
  };
}

export function hashSessionToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export function isCsrfTokenValid(token: string, expectedToken: string): boolean {
  const supplied = Buffer.from(token, 'utf8');
  const expected = Buffer.from(expectedToken, 'utf8');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export const accessSecurity: AccessSecurityPort = {
  hashPassword, verifyPassword, generateSessionToken, hashSessionToken, isCsrfTokenValid,
};
