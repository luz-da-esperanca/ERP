import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { chmod, link, mkdir, rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';

export interface BackupCommandRunner {
  (command: string, args: readonly string[]): Promise<void>;
}

export interface DatabaseBackupOptions {
  readonly databaseUrl: string;
  readonly directory: string;
  readonly now?: Date;
  readonly runCommand?: BackupCommandRunner;
}

export interface DatabaseBackupResult {
  readonly file: string;
}

const DIRECTORY_MODE = 0o700;
const FILE_MODE = 0o600;

const execFileAsync = promisify(execFile);

async function defaultRunner(command: string, args: readonly string[]): Promise<void> {
  await execFileAsync(command, [...args], { windowsHide: true });
}

function assertPostgresUrl(databaseUrl: string): void {
  try {
    const url = new URL(databaseUrl);
    const hasPostgresProtocol = url.protocol === 'postgres:' || url.protocol === 'postgresql:';
    if (hasPostgresProtocol && url.hostname.length > 0 && url.pathname.length > 1) return;
  } catch {
    // Fall through to the safe error below, which never echoes the value.
  }
  throw new Error('DATABASE_URL must be a PostgreSQL connection URL.');
}

/**
 * Reads the major version from PostgreSQL client `--version` output such as
 * `pg_dump (PostgreSQL) 17.10`. Returns null when the output is unreadable so
 * callers fail with an actionable prerequisite message instead of guessing.
 */
export function parsePostgresToolMajor(versionOutput: string): number | null {
  const match = /\(PostgreSQL\)\s(\d+)/.exec(versionOutput);
  if (match === null || match[1] === undefined) return null;
  const major = Number(match[1]);
  return Number.isSafeInteger(major) ? major : null;
}

/**
 * An older pg_dump cannot back up a newer server and aborts immediately, so a
 * client older than the server is a hard prerequisite failure. Newer clients
 * remain compatible with older servers.
 */
export function postgresToolsMismatchError(
  clientMajor: number | null,
  serverMajor: number | null,
): string | null {
  if (clientMajor === null || serverMajor === null) {
    return 'Could not determine the PostgreSQL client and server major versions.';
  }
  if (clientMajor < serverMajor) {
    return `pg_dump ${clientMajor}.x cannot back up PostgreSQL ${serverMajor}.x: client tools must match the server major version.`;
  }
  return null;
}

const PRISMA_ONLY_QUERY_PARAMETERS: readonly string[] = [
  'schema',
  'connection_limit',
  'pool_timeout',
  'socket_timeout',
  'pgbouncer',
  'statement_cache_size',
];

function isPrismaOnlyParameter(rawKey: string): boolean {
  if (PRISMA_ONLY_QUERY_PARAMETERS.includes(rawKey)) return true;
  try {
    return PRISMA_ONLY_QUERY_PARAMETERS.includes(decodeURIComponent(rawKey.replaceAll('+', ' ')));
  } catch {
    return false;
  }
}

/**
 * Removes Prisma-only query parameters so libpq accepts the connection URL.
 * The query string is filtered pair by pair instead of being re-serialized:
 * percent-encoded values keep their exact original bytes, which libpq
 * requires (`%20` must not become `+`). Undecodable pairs are preserved.
 */
export function toLibpqConnectionString(databaseUrl: string): string {
  const queryIndex = databaseUrl.indexOf('?');
  if (queryIndex === -1) return databaseUrl;
  const base = databaseUrl.slice(0, queryIndex);
  const afterQuery = databaseUrl.slice(queryIndex + 1);
  const fragmentIndex = afterQuery.indexOf('#');
  const fragment = fragmentIndex === -1 ? '' : afterQuery.slice(fragmentIndex);
  const query = fragmentIndex === -1 ? afterQuery : afterQuery.slice(0, fragmentIndex);
  const kept = query.split('&').filter((pair) => {
    if (pair === '') return false;
    const equalsIndex = pair.indexOf('=');
    const rawKey = equalsIndex === -1 ? pair : pair.slice(0, equalsIndex);
    return !isPrismaOnlyParameter(rawKey);
  });
  if (kept.length === 0) return `${base}${fragment}`;
  return `${base}?${kept.join('&')}${fragment}`;
}

function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  const code: unknown = error.code;
  return typeof code === 'string' ? code : null;
}

async function removeQuietly(path: string): Promise<void> {
  try {
    await rm(path, { force: true });
  } catch {
    // Best effort: the primary failure below carries the safe diagnostic.
  }
}

/**
 * Writes a timestamped custom-format logical backup with pg_dump. The
 * connection URL is passed to pg_dump but never logged; failures report the
 * target directory only. Restoring a backup remains a separate approved
 * procedure and is not performed here.
 */
export async function runDatabaseBackup(options: DatabaseBackupOptions): Promise<DatabaseBackupResult> {
  const { databaseUrl, directory } = options;
  assertPostgresUrl(databaseUrl);
  const targetDirectory = resolve(directory);
  await mkdir(targetDirectory, { recursive: true, mode: DIRECTORY_MODE });
  await chmod(targetDirectory, DIRECTORY_MODE);
  const timestamp = (options.now ?? new Date()).toISOString().replace(/[:.]/g, '-');
  const file = join(targetDirectory, `erp-backup-${timestamp}.dump`);
  // Unique per execution so concurrent runs never share a temporary file.
  const partialFile = `${file}.partial-${process.pid}-${randomUUID().slice(0, 8)}`;
  const runCommand = options.runCommand ?? defaultRunner;
  const libpqUrl = toLibpqConnectionString(databaseUrl);
  try {
    await runCommand('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', `--file=${partialFile}`, libpqUrl]);
  } catch {
    await removeQuietly(partialFile);
    throw new Error(`Database backup failed for ${targetDirectory}. Verify pg_dump and the database connection.`);
  }
  try {
    await chmod(partialFile, FILE_MODE);
    // Atomically claim the final name: link() fails with EEXIST when another
    // completed backup already owns it, so a finished backup is never replaced.
    await link(partialFile, file);
  } catch (error) {
    await removeQuietly(partialFile);
    if (errorCode(error) === 'EEXIST') {
      // Deliberately no `cause`: child-process errors embed the full command
      // line, which carries the database URL and must never enter the chain.
      // eslint-disable-next-line preserve-caught-error
      throw new Error(`Database backup already exists for ${targetDirectory}. Refusing to overwrite.`);
    }
    // eslint-disable-next-line preserve-caught-error
    throw new Error(`Database backup failed for ${targetDirectory}. Verify pg_dump and the database connection.`);
  }
  await removeQuietly(partialFile);
  return { file };
}
