import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import type { PasswordHasher } from '../application/ports.js';
export async function createPasswordHasher(
  cost: number,
): Promise<PasswordHasher> {
  const dummyHash = await bcrypt.hash(randomBytes(32).toString('base64'), cost);
  return {
    dummyHash,
    hash: (password) => bcrypt.hash(password, cost),
    compare: (password, hash) => bcrypt.compare(password, hash),
  };
}
