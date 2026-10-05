import type { ApiConfig } from './core/config.js';
import { createDatabase } from './core/database.js';
import { PrismaAccounts } from './features/access/infra/prisma-accounts.js';
import {
  createRedis,
  RedisSessions,
} from './features/access/infra/redis-sessions.js';
import { createPasswordHasher } from './features/access/infra/bcrypt-passwords.js';
import { createTokenSigner } from './features/access/infra/jwt-tokens.js';
import { AccessService } from './features/access/application/access-service.js';
import { assertDataMode, createApp } from './app.js';

export async function createRuntime(config: ApiConfig, logging = false) {
  const database = createDatabase(config.DATABASE_URL);
  const redis = createRedis(config.REDIS_URL);
  redis.on('error', () => {
    /* Requests fail closed; connection errors never include credentials in logs. */
  });
  try {
    await database.$connect();
    await assertDataMode(database, config);
    await redis.connect();
    const passwords = await createPasswordHasher(config.BCRYPT_COST);
    const accounts = new PrismaAccounts(database, config);
    const sessions = new RedisSessions(redis, config);
    const access = new AccessService(
      accounts,
      sessions,
      passwords,
      createTokenSigner(config),
    );
    const app = createApp(config, access, database, logging);
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
