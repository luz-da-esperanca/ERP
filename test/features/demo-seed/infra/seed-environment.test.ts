import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
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

  it('reads the configured Dario credential independently of the other demo accounts', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'erp-seed-'));
    directories.push(directory);
    const path = join(directory, '.env.demo');
    await writeFile(
      path,
      'DEMO_SEED_PASSWORD=synthetic-showcase-password\nDARIO_SEED_PASSWORD=admin123demo\n',
      { mode: 0o600 },
    );
    expect(await readSeedPassword(path, 'DARIO_SEED_PASSWORD')).toBe(
      'admin123demo',
    );
    expect(await readSeedPassword(path)).toBe('synthetic-showcase-password');
  });

  it('adds a missing Dario credential without replacing the existing demo credential', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'erp-seed-'));
    directories.push(directory);
    const path = join(directory, '.env.demo');
    await writeFile(path, 'DEMO_SEED_PASSWORD=synthetic-showcase-password', {
      mode: 0o600,
    });
    const darioPassword = await readSeedPassword(path, 'DARIO_SEED_PASSWORD');
    expect(passwordSchema.safeParse(darioPassword).success).toBe(true);
    expect(darioPassword).not.toBe('synthetic-showcase-password');
    expect(await readSeedPassword(path, 'DARIO_SEED_PASSWORD')).toBe(
      darioPassword,
    );
    expect(await readSeedPassword(path)).toBe('synthetic-showcase-password');
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it('rejects a configured Dario password below the existing minimum', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'erp-seed-'));
    directories.push(directory);
    const path = join(directory, '.env.demo');
    await writeFile(
      path,
      'DEMO_SEED_PASSWORD=synthetic-showcase-password\nDARIO_SEED_PASSWORD=admin123\n',
      { mode: 0o600 },
    );
    await expect(readSeedPassword(path, 'DARIO_SEED_PASSWORD')).rejects.toThrow(
      'Invalid DARIO_SEED_PASSWORD in the showcase credential file',
    );
    expect(await readSeedPassword(path)).toBe('synthetic-showcase-password');
  });
});
