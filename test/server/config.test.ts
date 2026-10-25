import { expect, it } from 'vitest';
import { readConfig } from '../../src/server/config.ts';

const databaseUrl = 'postgresql://app:local-only@localhost:5432/erp';

it('reads local defaults and an explicitly configured address', () => {
  expect(readConfig({ DATABASE_URL: databaseUrl })).toMatchObject({ databaseUrl, host: '127.0.0.1', port: 3000 });
  expect(readConfig({ DATABASE_URL: databaseUrl, HOST: '0.0.0.0', PORT: '4000' }))
    .toMatchObject({ databaseUrl, host: '0.0.0.0', port: 4000 });
});

it.each([undefined, '', 'private-value', 'https://private-value', 'postgresql:///'])(
  'rejects missing or invalid database URLs without echoing their contents', (value) => {
    const environment: NodeJS.ProcessEnv = {};
    if (value !== undefined) environment.DATABASE_URL = value;
    expect(() => readConfig(environment)).toThrow('DATABASE_URL must be a PostgreSQL connection URL.');
  },
);

it.each(['', '0', '-1', '65536', '3.5', '3000oops'])('rejects invalid port %j', (port) => {
  expect(() => readConfig({ DATABASE_URL: databaseUrl, PORT: port }))
    .toThrow('PORT must be an integer between 1 and 65535.');
});

it('reads the documented authentication environment variables in seconds', () => {
  expect(readConfig({ DATABASE_URL: databaseUrl, AUTH_MAX_FAILED_ATTEMPTS: '2',
    AUTH_LOCKOUT_DURATION_SECONDS: '60', AUTH_SESSION_IDLE_TIMEOUT_SECONDS: '90', NODE_ENV: 'production' }))
    .toMatchObject({ securityConfig: { maxFailedLoginAttempts: 2, lockoutDurationSeconds: 60, sessionIdleTimeoutSeconds: 90 }, secureCookies: true });
});

it.each(['', 'yes', 'TRUE'])('rejects an invalid cookie security flag (%j)', (value) => {
  expect(() => readConfig({ DATABASE_URL: databaseUrl, AUTH_COOKIE_SECURE: value })).toThrow('AUTH_COOKIE_SECURE must be true or false.');
});
