import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { integrationEnvironment } from './integration-environment.js';

export default function setup() {
  const { databaseUrl } = integrationEnvironment();
  execFileSync('pnpm', ['db:migrate'], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}
