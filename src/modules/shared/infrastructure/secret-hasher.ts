import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SALT_BYTES = 16;
const KEY_BYTES = 64;
// OWASP's memory/parallelism trade-off: 16 MiB with a parallelism factor of five.
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 5 } as const;

export function hashPassword(rawPassword: string): string {
  const salt = randomBytes(SALT_BYTES).toString('hex');
  const derived = scryptSync(rawPassword, salt, KEY_BYTES, SCRYPT_PARAMS).toString('hex');
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt}$${derived}`;
}

const DUMMY_PASSWORD_HASH = hashPassword('dummy-anti-enumeration-password-placeholder');

export function verifyPassword(rawPassword: string, storedHash: string | null | undefined): boolean {
  const target = storedHash ?? DUMMY_PASSWORD_HASH;
  const parts = target.split('$');
  if (parts[0] !== 'scrypt') return false;
  const isLegacy = parts.length === 3;
  if (!isLegacy && (parts.length !== 6 || parts[1] !== '16384' || parts[2] !== '8' || parts[3] !== '5')) return false;
  const salt = parts[isLegacy ? 1 : 4] ?? '';
  const expectedHex = parts[isLegacy ? 2 : 5] ?? '';
  if (!/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(expectedHex)) return false;
  const expectedBuffer = Buffer.from(expectedHex, 'hex');
  const parameters = isLegacy ? { N: 16384, r: 8, p: 1 } : SCRYPT_PARAMS;
  const derivedBuffer = scryptSync(rawPassword, salt, KEY_BYTES, parameters);

  if (derivedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  const matches = timingSafeEqual(derivedBuffer, expectedBuffer);
  return storedHash !== null && storedHash !== undefined && matches;
}

export function matchesSecret(hash: string | null | undefined, secret: string | undefined): boolean {
  if (hash === null || hash === undefined) return secret === undefined;
  return secret !== undefined && verifyPassword(secret, hash);
}
