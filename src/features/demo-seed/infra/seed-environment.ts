import { randomBytes } from 'node:crypto';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { passwordSchema } from '@erp/contracts/access-api';
import type { ApiConfig } from '../../../core/infra/config.js';

export class ShowcaseSeedError extends Error {}

export function assertShowcaseEnvironment(
  config: Pick<ApiConfig, 'NODE_ENV' | 'DATA_MODE'>,
) {
  if (config.DATA_MODE !== 'SYNTHETIC' || config.NODE_ENV === 'production')
    throw new ShowcaseSeedError(
      'Showcase seed requires synthetic non-production data',
    );
}

export async function readSeedPassword(path: string) {
  const generated = randomBytes(24).toString('base64url');
  try {
    await writeFile(path, `DEMO_SEED_PASSWORD=${generated}\n`, {
      mode: 0o600,
      flag: 'wx',
    });
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST'))
      throw error;
  }
  await chmod(path, 0o600);
  const result = passwordSchema.safeParse(
    parseEnv(await readFile(path, 'utf8')).DEMO_SEED_PASSWORD,
  );
  if (!result.success)
    throw new ShowcaseSeedError(
      'Invalid DEMO_SEED_PASSWORD in the showcase credential file',
    );
  return result.data;
}
