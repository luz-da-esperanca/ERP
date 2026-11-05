import { execFile } from 'node:child_process';
import { chmod, mkdir } from 'node:fs/promises';
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
  const runCommand = options.runCommand ?? defaultRunner;
  try {
    await runCommand('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', `--file=${file}`, databaseUrl]);
  } catch {
    throw new Error(`Database backup failed for ${targetDirectory}. Verify pg_dump and the database connection.`);
  }
  await chmod(file, FILE_MODE);
  return { file };
}
