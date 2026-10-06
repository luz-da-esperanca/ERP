import { z } from 'zod';
import { isIP } from 'node:net';

const positiveInteger = (value: number) =>
  z.coerce.number().int().positive().default(value);
const environmentSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  HOST: z.string().default('127.0.0.1'),
  TRUST_PROXY_ADDRESSES: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((address) => address.trim())
        .filter(Boolean),
    )
    .refine((addresses) => addresses.every((address) => isIP(address) !== 0)),
  PORT: positiveInteger(3001),
  APP_ORIGIN: z.url().refine((value) => new URL(value).origin === value),
  APP_TIMEZONE: z
    .string()
    .default('America/Fortaleza')
    .refine((value) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }),
  DATA_MODE: z.enum(['SYNTHETIC', 'REAL']).default('SYNTHETIC'),
  DATABASE_URL: z
    .url()
    .refine((value) =>
      ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
    ),
  REDIS_URL: z
    .url()
    .refine((value) => ['redis:', 'rediss:'].includes(new URL(value).protocol)),
  REDIS_KEY_PREFIX: z.string().min(1).default('erp:'),
  JWT_SECRET_BASE64: z.string(),
  JWT_ISSUER: z.string().min(1).default('erp-social'),
  JWT_AUDIENCE: z.string().min(1).default('erp-web'),
  OPERATION_HMAC_CURRENT_KEY_ID: z.string().min(1),
  OPERATION_HMAC_KEYS_JSON: z.string(),
  SOCIAL_FORM_CURRENT_KEY_ID: z.string().default(''),
  SOCIAL_FORM_KEYS_JSON: z.string().default('{}'),
  BCRYPT_COST: z.coerce.number().int().min(10).max(16).default(12),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  SESSION_IDLE_SECONDS: positiveInteger(1800),
  SESSION_MAX_SECONDS: positiveInteger(28800),
  LOGIN_MAX_FAILURES: positiveInteger(5),
  LOGIN_BLOCK_SECONDS: positiveInteger(900),
  LOGIN_IP_MAX_ATTEMPTS: positiveInteger(50),
  LOGIN_IP_WINDOW_SECONDS: positiveInteger(900),
});
function decodeKey(value: string): Uint8Array {
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length < 32 || bytes.toString('base64') !== value)
    throw new Error(
      'Secret keys must be canonical base64 with at least 32 bytes',
    );
  return bytes;
}
export function readConfig(environment: NodeJS.ProcessEnv) {
  const result = environmentSchema.safeParse(environment);
  if (!result.success)
    throw new Error(
      `Invalid configuration fields: ${[...new Set(result.error.issues.map((issue) => issue.path.join('.')))].join(', ')}`,
    );
  const config = result.data;
  const origin = new URL(config.APP_ORIGIN);
  if (
    config.NODE_ENV === 'production' &&
    (!config.COOKIE_SECURE || origin.protocol !== 'https:')
  )
    throw new Error('Production requires HTTPS and secure cookies');
  if (
    !config.COOKIE_SECURE &&
    !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)
  )
    throw new Error('Insecure cookies are restricted to local development');
  if (config.SESSION_IDLE_SECONDS > config.SESSION_MAX_SECONDS)
    throw new Error('Session idle lifetime must not exceed absolute lifetime');
  const jwtSecret = decodeKey(config.JWT_SECRET_BASE64);
  let hmacKeys: Record<string, Uint8Array>;
  try {
    const encoded = z
      .record(z.string().min(1), z.string())
      .parse(JSON.parse(config.OPERATION_HMAC_KEYS_JSON));
    hmacKeys = Object.fromEntries(
      Object.entries(encoded).map(([id, key]) => [id, decodeKey(key)]),
    );
  } catch {
    throw new Error('Invalid operation HMAC key configuration');
  }
  if (!hmacKeys[config.OPERATION_HMAC_CURRENT_KEY_ID])
    throw new Error('Current operation HMAC key is missing');
  if (
    Object.values(hmacKeys).some((key) =>
      Buffer.from(key).equals(Buffer.from(jwtSecret)),
    )
  )
    throw new Error('Authentication and operation keys must be independent');
  let socialFormKeys: Record<string, Uint8Array>;
  try {
    const encoded = z
      .record(z.string().min(1), z.string())
      .parse(JSON.parse(config.SOCIAL_FORM_KEYS_JSON));
    socialFormKeys = Object.fromEntries(
      Object.entries(encoded).map(([id, value]) => {
        const key = decodeKey(value);
        if (key.length !== 32) throw new Error('Invalid key length');
        return [id, key];
      }),
    );
  } catch {
    throw new Error('Invalid social encryption key configuration');
  }
  if (
    config.SOCIAL_FORM_CURRENT_KEY_ID &&
    !socialFormKeys[config.SOCIAL_FORM_CURRENT_KEY_ID]
  )
    throw new Error('Current social encryption key is missing');
  if (
    Object.values(socialFormKeys).some((key) =>
      [jwtSecret, ...Object.values(hmacKeys)].some((other) =>
        Buffer.from(key).equals(Buffer.from(other)),
      ),
    )
  )
    throw new Error(
      'Social encryption, authentication and operation keys must be independent',
    );
  return {
    ...config,
    jwtSecret,
    hmacKeys,
    socialFormKeys,
    cookieName: config.COOKIE_SECURE ? '__Host-erp_session' : 'erp_session',
  };
}
export type ApiConfig = ReturnType<typeof readConfig>;
