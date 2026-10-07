import { describe, expect, it } from 'vitest';
import {
  StartupFailure,
  startupFailureMessage,
} from '../../../src/core/infra/startup-failure.js';

describe('API startup diagnostics', () => {
  it('identifies the failing dependency without logging its connection string', () => {
    const cause = Object.assign(
      new Error(
        'Cannot connect to postgresql://operator:private-password@db/erp',
      ),
      { code: 'ECONNREFUSED' },
    );
    const failure = new StartupFailure('database', cause);
    expect(failure.cause).toBe(cause);
    expect(startupFailureMessage(failure, 'services')).toBe(
      'API startup failed (database; ECONNREFUSED); check PostgreSQL and DATABASE_URL; for local development run docker compose up -d --wait',
    );
  });

  it.each([
    ['configuration', 'check .env'],
    ['redis', 'check Redis and REDIS_URL'],
    ['data-mode', 'check database migrations with pnpm db:migrate'],
    ['services', 'check service initialization'],
    ['listen', 'check HOST, PORT'],
  ] as const)(
    'provides a safe next step for %s failures',
    (stage, instruction) => {
      const cause = Object.assign(new Error('private-token=private-value'), {
        code: 'private-value',
      });
      const message = startupFailureMessage(cause, stage);
      expect(message).toContain(`API startup failed (${stage});`);
      expect(message).toContain(instruction);
      expect(message).not.toContain('private');
    },
  );

  it('identifies an occupied HTTP port without exposing the original message', () => {
    const cause = Object.assign(new Error('private-token=private-value'), {
      code: 'EADDRINUSE',
    });
    expect(startupFailureMessage(cause, 'listen')).toBe(
      'API startup failed (listen; EADDRINUSE); check HOST, PORT and whether another API process is already running',
    );
  });
});
