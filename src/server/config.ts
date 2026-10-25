import { DEFAULT_SECURITY_POLICY_CONFIG } from '../modules/access/domain/access-types.ts';

export function readConfig(environment: NodeJS.ProcessEnv) {
  const databaseUrl = environment.DATABASE_URL ?? '';
  if (!isPostgreSqlUrl(databaseUrl)) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL.');
  }
  const portText = environment.PORT ?? '3000';
  const port = Number(portText);
  if (!/^\d+$/.test(portText) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  const cookieSecure = environment.AUTH_COOKIE_SECURE ?? 'false';
  if (cookieSecure !== 'true' && cookieSecure !== 'false') throw new Error('AUTH_COOKIE_SECURE must be true or false.');
  return {
    databaseUrl,
    host: environment.HOST ?? '127.0.0.1',
    port,
    securityConfig: {
      maxFailedLoginAttempts: readPositiveInteger(environment, 'AUTH_MAX_FAILED_ATTEMPTS', DEFAULT_SECURITY_POLICY_CONFIG.maxFailedLoginAttempts),
      lockoutDurationSeconds: readPositiveInteger(environment, 'AUTH_LOCKOUT_DURATION_SECONDS', DEFAULT_SECURITY_POLICY_CONFIG.lockoutDurationSeconds),
      sessionIdleTimeoutSeconds: readPositiveInteger(environment, 'AUTH_SESSION_IDLE_TIMEOUT_SECONDS', DEFAULT_SECURITY_POLICY_CONFIG.sessionIdleTimeoutSeconds),
    },
    secureCookies: environment.NODE_ENV === 'production' || cookieSecure === 'true',
  };
}

function readPositiveInteger(environment: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const text = environment[name];
  if (text === undefined) return fallback;
  const value = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(value) || value < 1 || value > Number.MAX_SAFE_INTEGER / 1000) {
    throw new Error(`${name} must be a positive safe integer.`);
  }
  return value;
}

function isPostgreSqlUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ['postgres:', 'postgresql:'].includes(url.protocol)
      && url.hostname.length > 0 && url.pathname.length > 1;
  } catch {
    return false;
  }
}
