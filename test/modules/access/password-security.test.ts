import { expect, it } from 'vitest';
import { accessSecurity } from '../../../src/modules/access/infrastructure/password-hasher.ts';

it('stores explicit scrypt work parameters and continues verifying existing credentials', () => {
  const password = 'SyntheticPassword!123';
  const hash = accessSecurity.hashPassword(password);
  expect(hash).toMatch(/^scrypt\$16384\$8\$5\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
  expect(accessSecurity.verifyPassword(password, hash)).toBe(true);
  expect(accessSecurity.verifyPassword('WrongSyntheticPassword!123', hash)).toBe(false);
  const legacyHash = 'scrypt$00112233445566778899aabbccddeeff$8a886e6bc370d427d00769135138e0f8b79829534d4a9a480ae2b093b14e21d20ed2b9e08d4d2bfc35ab57809ad983b14e4d5dcf06055addcc95e52062ab0344';
  expect(accessSecurity.verifyPassword('LegacySyntheticPassword!123', legacyHash)).toBe(true);
  expect(accessSecurity.verifyPassword('WrongSyntheticPassword!123', legacyHash)).toBe(false);
  expect(accessSecurity.verifyPassword(password, 'scrypt$bad$hash')).toBe(false);
});
