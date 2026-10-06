import { randomBytes } from 'node:crypto';
import { appendFile, chmod, readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { passwordSchema } from '@erp/contracts/access-api';
import type { ApiConfig } from '../../../core/infra/config.js';

export class ShowcaseSeedError extends Error {}
type SeedPasswordKey = 'DEMO_SEED_PASSWORD' | 'DARIO_SEED_PASSWORD';

export function assertShowcaseEnvironment(
  config: Pick<ApiConfig, 'NODE_ENV' | 'DATA_MODE'>,
) {
  if (config.DATA_MODE !== 'SYNTHETIC' || config.NODE_ENV === 'production')
    throw new ShowcaseSeedError(
      'Showcase seed requires synthetic non-production data',
    );
}

export async function readSeedPassword(
  path: string,
  key: SeedPasswordKey = 'DEMO_SEED_PASSWORD',
) {
  const generated = randomBytes(24).toString('base64url');
  try {
    await writeFile(path, `${key}=${generated}\n`, {
      mode: 0o600,
      flag: 'wx',
    });
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST'))
      throw error;
  }
  await chmod(path, 0o600);
  const contents = await readFile(path, 'utf8');
  const environment = parseEnv(contents);
  if (key === 'DARIO_SEED_PASSWORD' && environment[key] === undefined) {
    await appendFile(
      path,
      `${contents.endsWith('\n') ? '' : '\n'}${key}=${generated}\n`,
    );
    environment[key] = generated;
  }
  const result = passwordSchema.safeParse(environment[key]);
  if (!result.success)
    throw new ShowcaseSeedError(
      `Invalid ${key} in the showcase credential file`,
    );
  return result.data;
}
