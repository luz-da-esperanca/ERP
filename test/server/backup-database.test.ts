import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parsePostgresToolMajor,
  postgresToolsMismatchError,
  runDatabaseBackup,
  toLibpqConnectionString,
} from '../../src/server/backup.ts';

const recorded: Array<{ command: string; args: readonly string[] }> = [];
let temporaryDirectories: string[] = [];

afterEach(async () => {
  recorded.length = 0;
  await Promise.all(temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
  temporaryDirectories = [];
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'erp-backup-unit-'));
  temporaryDirectories.push(directory);
  return directory;
}

describe('PostgreSQL client and server version matching', () => {
  it('parses tool major versions from --version output', () => {
    expect(parsePostgresToolMajor('pg_dump (PostgreSQL) 17.10')).toBe(17);
    expect(parsePostgresToolMajor('pg_restore (PostgreSQL) 16.4')).toBe(16);
    expect(parsePostgresToolMajor('pg_dump (PostgreSQL) 9.6.24')).toBe(9);
  });

  it('rejects unreadable version output as unknown', () => {
    expect(parsePostgresToolMajor('')).toBeNull();
    expect(parsePostgresToolMajor('pg_dump 17.10')).toBeNull();
  });

  it('reports a mismatch only when the client is older than the server', () => {
    expect(postgresToolsMismatchError(17, 17)).toBeNull();
    expect(postgresToolsMismatchError(18, 17)).toBeNull();
    expect(postgresToolsMismatchError(16, 17)).toContain('16');
    expect(postgresToolsMismatchError(16, 17)).toContain('17');
    expect(postgresToolsMismatchError(null, 17)).not.toBeNull();
    expect(postgresToolsMismatchError(17, null)).not.toBeNull();
  });
});

describe('Libpq connection string', () => {
  it('strips Prisma-only parameters while preserving libpq ones', () => {
    expect(toLibpqConnectionString(
      'postgresql://erp:secret@127.0.0.1:5432/erp?schema=public&connection_limit=5&pool_timeout=10&sslmode=require',
    )).toBe('postgresql://erp:secret@127.0.0.1:5432/erp?sslmode=require');
  });

  it('preserves percent-encoded values byte for byte while removing prisma params', () => {
    expect(toLibpqConnectionString(
      'postgresql://erp:secret@127.0.0.1:5432/erp?options=-c%20statement_timeout%3D5000&schema=public',
    )).toBe('postgresql://erp:secret@127.0.0.1:5432/erp?options=-c%20statement_timeout%3D5000');
  });

  it('removes encoded prisma parameter names', () => {
    expect(toLibpqConnectionString(
      'postgresql://erp:secret@127.0.0.1:5432/erp?%73chema=public&sslmode=require',
    )).toBe('postgresql://erp:secret@127.0.0.1:5432/erp?sslmode=require');
  });

  it('keeps undecodable pairs untouched', () => {
    expect(toLibpqConnectionString(
      'postgresql://erp:secret@127.0.0.1:5432/erp?%zz=top&schema=public',
    )).toBe('postgresql://erp:secret@127.0.0.1:5432/erp?%zz=top');
  });

  it('leaves parameterless URLs untouched', () => {
    expect(toLibpqConnectionString('postgresql://erp:secret@127.0.0.1:5432/erp'))
      .toBe('postgresql://erp:secret@127.0.0.1:5432/erp');
  });
});

describe('Partial backup cleanup', () => {
  it('removes the partial archive when pg_dump fails after starting to write', async () => {
    const parent = await createTemporaryDirectory();
    const directory = join(parent, 'backups');
    const failingRunner = async (_command: string, args: readonly string[]): Promise<void> => {
      const fileArgument = args.find((argument) => argument.startsWith('--file='));
      if (fileArgument === undefined) throw new Error('pg_dump file argument is missing.');
      await writeFile(fileArgument.slice('--file='.length), 'partial-dump');
      throw new Error('pg_dump exited with code 1.');
    };

    const failure = await runDatabaseBackup({
      databaseUrl,
      directory,
      now: fixedNow,
      runCommand: failingRunner,
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).not.toContain(databaseUrl);
    expect(await readdir(directory)).toHaveLength(0);
  });

  it('removes the partial file when publishing fails after a successful dump', async () => {
    const parent = await createTemporaryDirectory();
    const directory = join(parent, 'backups');
    await mkdir(directory, { recursive: true });
    const blockingDirectory = join(directory, 'erp-backup-2026-10-26T16-45-00-000Z.dump');
    await mkdir(blockingDirectory, { recursive: true });
    await writeFile(join(blockingDirectory, 'inner.txt'), 'unrelated');

    const failure = await runDatabaseBackup({
      databaseUrl,
      directory,
      now: fixedNow,
      runCommand: backingRunner(),
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).not.toContain(databaseUrl);
    const entries = await readdir(directory, { recursive: true, withFileTypes: true });
    const leftovers = entries.filter((entry) => entry.isFile()
      && (entry.name.endsWith('.dump') || entry.name.endsWith('.partial')));
    expect(leftovers).toHaveLength(0);
  });
});

function backingRunner() {
  return async (command: string, args: readonly string[]): Promise<void> => {
    recorded.push({ command, args });
    const fileArgument = args.find((argument) => argument.startsWith('--file='));
    if (fileArgument === undefined) throw new Error('pg_dump file argument is missing.');
    await writeFile(fileArgument.slice('--file='.length), 'synthetic-dump');
  };
}

const databaseUrl = 'postgresql://erp:synthetic-local-only@127.0.0.1:5432/erp';
const fixedNow = new Date('2026-10-26T16:45:00.000Z');

it('writes a timestamped custom-format dump with restricted permissions', async () => {
  const parent = await createTemporaryDirectory();
  const directory = join(parent, 'backups');

  const result = await runDatabaseBackup({
    databaseUrl,
    directory,
    now: fixedNow,
    runCommand: backingRunner(),
  });

  expect(result.file).toBe(join(directory, 'erp-backup-2026-10-26T16-45-00-000Z.dump'));
  expect(recorded).toEqual([{
    command: 'pg_dump',
    args: ['--format=custom', '--no-owner', '--no-privileges', `--file=${result.file}.partial`, databaseUrl],
  }]);
  // POSIX-only: Windows emulates file modes and ignores chmod bits.
  if (process.platform !== 'win32') {
    expect((await stat(directory)).mode & 0o777).toBe(0o700);
    expect((await stat(result.file)).mode & 0o777).toBe(0o600);
  }
});

it('rejects non-PostgreSQL connection URLs without echoing them', async () => {
  const directory = await createTemporaryDirectory();
  const invalidUrl = 'not-a-database-url';

  const failure = await runDatabaseBackup({
    databaseUrl: invalidUrl,
    directory,
    now: fixedNow,
    runCommand: backingRunner(),
  }).catch((error: unknown) => error);

  expect(failure).toBeInstanceOf(Error);
  expect((failure as Error).message).toBe('DATABASE_URL must be a PostgreSQL connection URL.');
  expect((failure as Error).message).not.toContain(invalidUrl);
  expect(recorded).toHaveLength(0);
});

it('reports runner failures without leaking the connection URL', async () => {
  const directory = await createTemporaryDirectory();
  const failingRunner = vi.fn(async (): Promise<void> => {
    throw new Error('pg_dump exited with code 1.');
  });

  const failure = await runDatabaseBackup({
    databaseUrl,
    directory,
    now: fixedNow,
    runCommand: failingRunner,
  }).catch((error: unknown) => error);

  expect(failure).toBeInstanceOf(Error);
  expect((failure as Error).message).toContain('Database backup failed');
  expect((failure as Error).message).not.toContain(databaseUrl);
  expect((await readdir(directory))).toHaveLength(0);
});

it('creates missing parent directories with restricted permissions', async () => {
  const parent = await createTemporaryDirectory();
  const nested = join(parent, 'nested', 'backups');

  const result = await runDatabaseBackup({
    databaseUrl,
    directory: nested,
    now: fixedNow,
    runCommand: backingRunner(),
  });

  expect(result.file.startsWith(nested)).toBe(true);
  // POSIX-only: Windows emulates directory modes.
  if (process.platform !== 'win32') {
    expect((await stat(nested)).mode & 0o777).toBe(0o700);
  }
});

it.skipIf(process.platform === 'win32')('keeps a restricted file mode even under a permissive umask', async () => {
  const parent = await createTemporaryDirectory();
  const previous = process.umask(0o000);
  try {
    const result = await runDatabaseBackup({
      databaseUrl,
      directory: join(parent, 'backups'),
      now: fixedNow,
      runCommand: backingRunner(),
    });
    expect((await stat(result.file)).mode & 0o777).toBe(0o600);
  } finally {
    process.umask(previous);
  }
});
