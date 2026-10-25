import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { createDatabase } from '../../src/server/database.ts';

export async function createIsolatedDatabase(controlUrl: string) {
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
    await promisify(execFile)(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
      env: { ...process.env, DATABASE_URL: connectionString }, windowsHide: true,
    });
  } catch {
    await close();
    throw new Error('Failed to migrate the disposable integration database.');
  }
  return { connectionString, close };
}
