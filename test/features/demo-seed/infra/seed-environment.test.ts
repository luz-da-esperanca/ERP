import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { passwordSchema } from '@erp/contracts/access-api';
import {
  assertShowcaseEnvironment,
  readSeedPassword,
} from '../../../../src/features/demo-seed/infra/seed-environment.js';

describe('Showcase environment', () => {
  it('rejects production and real personal data', () => {
    expect(() =>
      assertShowcaseEnvironment({
        NODE_ENV: 'production',
        DATA_MODE: 'SYNTHETIC',
      }),
    ).toThrow('synthetic non-production');
    expect(() =>
      assertShowcaseEnvironment({ NODE_ENV: 'development', DATA_MODE: 'REAL' }),
    ).toThrow('synthetic non-production');
    expect(() =>
      assertShowcaseEnvironment({
        NODE_ENV: 'development',
        DATA_MODE: 'SYNTHETIC',
      }),
    ).not.toThrow();
  });

  const directories: string[] = [];
  afterEach(async () => {
    for (const directory of directories.splice(0))
      await rm(directory, { recursive: true, force: true });
  });
  it('generates a private valid credential once and reuses it', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'erp-seed-'));
    directories.push(directory);
    const path = join(directory, '.env.demo');
    const password = await readSeedPassword(path);
    expect(passwordSchema.safeParse(password).success).toBe(true);
    expect(await readSeedPassword(path)).toBe(password);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect(await readFile(path, 'utf8')).toContain(
      `DEMO_SEED_PASSWORD=${password}`,
    );
  });
});
