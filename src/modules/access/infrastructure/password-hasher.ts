import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SALT_BYTES = 16;
const KEY_BYTES = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;

export function hashPassword(rawPassword: string): string {
  const salt = randomBytes(SALT_BYTES).toString('hex');
  const derived = scryptSync(rawPassword, salt, KEY_BYTES, SCRYPT_PARAMS).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

const DUMMY_PASSWORD_HASH = hashPassword('dummy-anti-enumeration-password-placeholder');

export function verifyPassword(rawPassword: string, storedHash: string | null | undefined): boolean {
  const target = storedHash ?? DUMMY_PASSWORD_HASH;
  const parts = target.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const salt = parts[1] ?? '';
  const expectedHex = parts[2] ?? '';
  const expectedBuffer = Buffer.from(expectedHex, 'hex');
  const derivedBuffer = scryptSync(rawPassword, salt, expectedBuffer.length, SCRYPT_PARAMS);

  if (derivedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  const matches = timingSafeEqual(derivedBuffer, expectedBuffer);
  return storedHash !== null && storedHash !== undefined && matches;
}

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

