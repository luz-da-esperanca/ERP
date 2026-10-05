import { readConfig } from './core/infra/config.js';
import { createRuntime } from './runtime.js';
try {
  const config = readConfig(process.env);
  const { app } = await createRuntime(config, true);
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.once(signal, () => {
      void app.close();
    });
  await app.listen({ host: config.HOST, port: config.PORT });
} catch {
  console.error(
    'API startup failed; check configuration, migrations and dependencies',
  );
  process.exitCode = 1;
}
