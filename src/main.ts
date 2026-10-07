import { readConfig } from './core/infra/config.js';
import { createRuntime } from './runtime.js';
import { startupFailureMessage } from './core/infra/startup-failure.js';
import type { StartupStage } from './core/infra/startup-failure.js';
let startupStage: StartupStage = 'configuration';
try {
  const config = readConfig(process.env);
  startupStage = 'services';
  const { app } = await createRuntime(config, true);
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.once(signal, () => {
      void app.close();
    });
  startupStage = 'listen';
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (error) {
  console.error(startupFailureMessage(error, startupStage));
  process.exitCode = 1;
}
