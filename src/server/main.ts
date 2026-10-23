import { resolve } from 'node:path';
import { createApp } from './app.ts';
import { readConfig } from './config.ts';
import { createDatabase } from './database.ts';

const config = readConfig(process.env);
const database = createDatabase(config.databaseUrl);
const app = createApp({
  checkDatabase: database.check,
  logger: true,
  ...(process.argv.includes('--serve-client')
    ? { clientDirectory: resolve(import.meta.dirname, '../client') }
    : {}),
});

// Register business-module HTTP adapters here and inject their infrastructure dependencies.
app.addHook('onClose', () => database.close());

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.close().catch(() => { process.exitCode = 1; });
  });
}

try {
  await app.listen({ host: config.host, port: config.port });
} catch {
  app.log.fatal('Server startup failed. Check HOST, PORT, and local service availability.');
  await app.close();
  process.exitCode = 1;
}
