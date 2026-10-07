const startupInstructions = {
  configuration: 'check .env and the configuration requirements in README.md',
  database:
    'check PostgreSQL and DATABASE_URL; for local development run docker compose up -d --wait',
  'data-mode':
    'check database migrations with pnpm db:migrate and the configured data mode',
  redis:
    'check Redis and REDIS_URL; for local development run docker compose up -d --wait',
  services: 'check service initialization and generated Prisma client',
  listen: 'check HOST, PORT and whether another API process is already running',
} as const;

export type StartupStage = keyof typeof startupInstructions;

export class StartupFailure extends Error {
  constructor(
    readonly stage: StartupStage,
    cause: unknown,
  ) {
    super(startupInstructions[stage], { cause });
  }
}

const diagnosticCodes = new Set([
  'EADDRINUSE',
  'EACCES',
  'EPERM',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'P1000',
  'P1001',
  'P1002',
  'P1017',
  'P2021',
  'P2022',
]);

export function startupFailureMessage(error: unknown, stage: StartupStage) {
  const failure =
    error instanceof StartupFailure ? error : new StartupFailure(stage, error);
  const cause = failure.cause;
  const code =
    cause instanceof Error &&
    'code' in cause &&
    typeof cause.code === 'string' &&
    diagnosticCodes.has(cause.code)
      ? `; ${cause.code}`
      : '';
  return `API startup failed (${failure.stage}${code}); ${failure.message}`;
}
