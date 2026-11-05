import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createIsolatedDatabase } from '../helpers/isolated-database.ts';

const controlUrl = process.env.TEST_DATABASE_URL;
if (!controlUrl) {
  throw new Error('Set TEST_DATABASE_URL to an isolated PostgreSQL database before running integration tests.');
}

async function requirePostgresTool(command: string): Promise<void> {
  try {
    await promisify(execFile)(command, ['--version'], { windowsHide: true });
  } catch {
    throw new Error(`The ${command} PostgreSQL client tool must be on PATH before running backup integration tests.`);
  }
}

let connectionString: string;
let closeIsolatedDatabase: (() => Promise<void>) | undefined;
let backupDirectory: string;

beforeAll(async () => {
  await requirePostgresTool('pg_dump');
  await requirePostgresTool('pg_restore');
  const isolated = await createIsolatedDatabase(controlUrl);
  connectionString = isolated.connectionString;
  closeIsolatedDatabase = isolated.close;
  backupDirectory = await mkdtemp(join(tmpdir(), 'erp-backup-integration-'));
}, 60_000);

afterAll(async () => {
  await rm(backupDirectory, { recursive: true, force: true });
  await closeIsolatedDatabase?.();
});

it('backs up a real database through the published CLI without leaking credentials', async () => {
  const password = new URL(connectionString).password;
  const child = await promisify(execFile)(process.execPath, ['src/server/backup-database.ts'], {
    windowsHide: true,
    timeout: 60_000,
    env: { ...process.env, DATABASE_URL: connectionString, BACKUP_DIRECTORY: backupDirectory },
  });

  expect(child.stdout).toContain('Database backup written to');
  expect(child.stdout + child.stderr).not.toContain(password);

  const entries = await readdir(backupDirectory);
  expect(entries).toHaveLength(1);
  const dump = join(backupDirectory, entries[0] ?? '');
  expect(entries[0]).toMatch(/^erp-backup-.*\.dump$/);

  const listing = await promisify(execFile)('pg_restore', ['--list', dump], { windowsHide: true });
  expect(listing.stdout).toContain('TABLE');
}, 60_000);
