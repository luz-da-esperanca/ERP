import { readConfig } from './core/infra/config.js';
import { createDatabase } from './core/infra/database.js';
import { DataModeGuard } from './core/application/data-mode.js';
import { PrismaFeatureDecisions } from './core/infra/prisma-feature-decisions.js';
import { createPasswordHasher } from './features/access/infra/bcrypt-passwords.js';
import { runBootstrap } from './features/access/presentation/bootstrap-command.js';
import { createAccounts } from './runtime.js';

const config = readConfig(process.env);
const database = createDatabase(config.DATABASE_URL);
try {
  await new DataModeGuard(
    config.DATA_MODE,
    new PrismaFeatureDecisions(database),
  ).assertEnabled();
  await runBootstrap(
    createAccounts(database, config),
    await createPasswordHasher(config.BCRYPT_COST),
  );
} catch {
  console.error(
    'Bootstrap failed; check input, configuration and existing accounts',
  );
  process.exitCode = 1;
} finally {
  await database.$disconnect();
}
