import type { ApiConfig } from './core/infra/config.js';
import { randomUUID } from 'node:crypto';
import { createDatabase, type Database } from './core/infra/database.js';
import { DataModeGuard } from './core/application/data-mode.js';
import { PrismaFeatureDecisions } from './core/infra/prisma-feature-decisions.js';
import { createOperationFingerprints } from './core/infra/operation-fingerprint.js';
import { AccountsService } from './features/access/application/accounts-service.js';
import {
  PrismaAccountAudit,
  PrismaAuditReader,
} from './features/audit/infra/audit-store.js';
import { AuditService } from './features/audit/application/audit-service.js';
import { PrismaAccounts } from './features/access/infra/prisma-accounts.js';
import {
  createRedis,
  RedisSessions,
} from './features/access/infra/redis-sessions.js';
import { createPasswordHasher } from './features/access/infra/bcrypt-passwords.js';
import { createTokenSigner } from './features/access/infra/jwt-tokens.js';
import { AccessService } from './features/access/application/access-service.js';
import { createApp } from './app.js';

export function createAccounts(database: Database, config: ApiConfig) {
  const persistence = new PrismaAccounts(
    database,
    (tx) => new PrismaAccountAudit(tx),
  );
  return new AccountsService(
    persistence,
    persistence,
    createOperationFingerprints(config),
    randomUUID,
  );
}

export async function createRuntime(config: ApiConfig, logging = false) {
  const database = createDatabase(config.DATABASE_URL);
  const redis = createRedis(config.REDIS_URL);
  redis.on('error', () => {
    /* Requests fail closed; connection errors never include credentials in logs. */
  });
  try {
    await database.$connect();
    const dataMode = new DataModeGuard(
      config.DATA_MODE,
      new PrismaFeatureDecisions(database),
    );
    await dataMode.assertEnabled();
    await redis.connect();
    const passwords = await createPasswordHasher(config.BCRYPT_COST);
    const accounts = createAccounts(database, config);
    const sessions = new RedisSessions(redis, config);
    const access = new AccessService(
      accounts,
      sessions,
      passwords,
      createTokenSigner(config),
    );
    const audit = new AuditService(new PrismaAuditReader(database));
    const app = createApp(
      config,
      { access, accounts, audit, dataMode },
      logging,
    );
    app.addHook('onClose', async () => {
      if (redis.isOpen) await redis.close();
      await database.$disconnect();
    });
    return { app, database, redis, accounts, access, sessions };
  } catch {
    if (redis.isOpen) redis.destroy();
    await database.$disconnect();
    throw new Error(
      'API initialization failed; check dependencies, migrations and data mode',
    );
  }
}
