import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { cp, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createDatabase } from '../../src/server/database.ts';

export async function deployIsolatedMigrations(connectionString: string, migrationsThrough?: string) {
  let temporaryDirectory: string | undefined;
  try {
    const args = ['node_modules/prisma/build/index.js', 'migrate', 'deploy'];
    if (migrationsThrough) {
      temporaryDirectory = await mkdtemp(join(tmpdir(), 'erp-migration-test-'));
      const migrations = join(temporaryDirectory, 'migrations');
      const entries = await readdir('prisma/migrations', { withFileTypes: true });
      if (!entries.some((entry) => entry.isDirectory() && entry.name === migrationsThrough)) {
        throw new Error('Unknown migration boundary.');
      }
      for (const entry of entries) {
        if (entry.name === 'migration_lock.toml' || (entry.isDirectory() && entry.name <= migrationsThrough)) {
          await cp(join('prisma/migrations', entry.name), join(migrations, entry.name), { recursive: true });
        }
      }
      const config = join(temporaryDirectory, 'prisma.config.ts');
      await writeFile(config, `export default { schema: ${JSON.stringify(resolve('prisma/schema.prisma'))}, migrations: { path: ${JSON.stringify(migrations)} }, datasource: { url: process.env.DATABASE_URL } };\n`);
      args.push('--config', config);
    }
    await promisify(execFile)(process.execPath, args, {
      env: { ...process.env, DATABASE_URL: connectionString }, windowsHide: true,
    });
  } finally {
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

export async function createIsolatedDatabase(controlUrl: string, options?: { readonly migrationsThrough: string }) {
  const name = `erp_test_${randomUUID().replaceAll('-', '')}`;
  if (!/^erp_test_[a-f0-9]{32}$/.test(name)) throw new Error('Invalid isolated database name.');
  const control = createDatabase(controlUrl);
  const url = new URL(controlUrl);
  url.pathname = `/${name}`;
  const connectionString = url.toString();
  await control.client.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  async function close() {
    try { await control.client.$executeRawUnsafe(`DROP DATABASE "${name}" WITH (FORCE)`); }
    finally { await control.close(); }
  }
  try {
    await deployIsolatedMigrations(connectionString, options?.migrationsThrough);
  } catch {
    await close();
    throw new Error('Failed to migrate the disposable integration database.');
  }
  return { connectionString, close };
}
