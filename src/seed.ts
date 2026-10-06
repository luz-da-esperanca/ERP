import { resolve } from 'node:path';
import { readConfig } from './core/infra/config.js';
import { createRuntime } from './runtime.js';
import {
  assertShowcaseEnvironment,
  readSeedPassword,
  ShowcaseSeedError,
} from './features/demo-seed/infra/seed-environment.js';
import { seedShowcase } from './features/demo-seed/infra/showcase-seed.js';

let runtime: Awaited<ReturnType<typeof createRuntime>> | undefined;
try {
  const config = readConfig(process.env);
  assertShowcaseEnvironment(config);
  const credentialPath = resolve('.env.demo');
  const password = await readSeedPassword(credentialPath);
  const darioPassword = await readSeedPassword(
    credentialPath,
    'DARIO_SEED_PASSWORD',
  );
  runtime = await createRuntime(config);
  const result = await seedShowcase(runtime, config, password, darioPassword);
  console.log(
    `Showcase seed ready: ${result.familyIds.length} families, 8 people, 2 projects, ${result.activityIds.length} activities.`,
  );
  console.log(
    `Reference date: ${result.referenceDate}; period: [${result.periodStart}, ${result.periodEndExclusive}).`,
  );
  console.log(`Demo logins: ${result.logins.join(', ')}.`);
  console.log(`Private demo credential file: ${credentialPath}`);
} catch (error) {
  console.error(
    error instanceof ShowcaseSeedError
      ? error.message
      : 'Showcase seed failed; check configuration, migrations, PostgreSQL and Redis.',
  );
  process.exitCode = 1;
} finally {
  await runtime?.app.close();
}
