import { AccessService } from '../modules/access/application/access-service.ts';
import { accessSecurity } from '../modules/access/infrastructure/password-hasher.ts';
import { readConfig } from './config.ts';
import { createDatabase } from './database.ts';
import { createPrismaPersistence } from './persistence.ts';

let database: ReturnType<typeof createDatabase> | undefined;
try {
  const input = {
    loginIdentifier: process.env.BOOTSTRAP_ADMIN_LOGIN,
    displayName: process.env.BOOTSTRAP_ADMIN_DISPLAY_NAME,
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
  };
  delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
  database = createDatabase(readConfig(process.env).databaseUrl);
  const persistence = createPrismaPersistence(database.client);
  const service = new AccessService({ repository: persistence.accessRepository,
    transactions: persistence.accessTransactions, security: accessSecurity });
  const user = await service.provisionInitialAdministrator(input);
  console.log(`Initial administrator provisioned: ${user.id}`);
} catch {
  console.error('Initial administrator provisioning failed. Verify the input and whether users already exist.');
  process.exitCode = 1;
} finally {
  await database?.close();
}
