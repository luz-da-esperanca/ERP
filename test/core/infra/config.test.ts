import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { readConfig } from '../../../src/core/infra/config.js';
const environment = {
  APP_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://localhost/erp_test',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET_BASE64: randomBytes(32).toString('base64'),
  OPERATION_HMAC_CURRENT_KEY_ID: 'v1',
  OPERATION_HMAC_KEYS_JSON: JSON.stringify({
    v1: randomBytes(32).toString('base64'),
  }),
  COOKIE_SECURE: 'false',
};
describe('Runtime configuration', () => {
  it('keeps social encryption optional until enabled and validates independent 32-byte rotation keys', () => {
    expect(readConfig(environment).socialFormKeys).toEqual({});
    const key = randomBytes(32).toString('base64');
    expect(
      readConfig({
        ...environment,
        SOCIAL_FORM_CURRENT_KEY_ID: 'v1',
        SOCIAL_FORM_KEYS_JSON: JSON.stringify({ v1: key }),
      }).socialFormKeys.v1?.length,
    ).toBe(32);
    expect(() =>
      readConfig({
        ...environment,
        SOCIAL_FORM_CURRENT_KEY_ID: 'v1',
        SOCIAL_FORM_KEYS_JSON: JSON.stringify({
          v1: environment.JWT_SECRET_BASE64,
        }),
      }),
    ).toThrow('must be independent');
    expect(() =>
      readConfig({
        ...environment,
        SOCIAL_FORM_CURRENT_KEY_ID: 'v1',
        SOCIAL_FORM_KEYS_JSON: JSON.stringify({
          v1: randomBytes(48).toString('base64'),
        }),
      }),
    ).toThrow('Invalid social encryption key configuration');
    expect(() =>
      readConfig({
        ...environment,
        SOCIAL_FORM_CURRENT_KEY_ID: 'missing',
        SOCIAL_FORM_KEYS_JSON: JSON.stringify({ v1: key }),
      }),
    ).toThrow('Current social encryption key is missing');
  });
  it('defaults to synthetic data and local cookies only when explicitly configured', () => {
    expect(readConfig(environment)).toMatchObject({
      DATA_MODE: 'SYNTHETIC',
      cookieName: 'erp_session',
    });
  });
  it('requires independent strong keys without exposing supplied values in errors', () => {
    expect(() =>
      readConfig({ ...environment, JWT_SECRET_BASE64: 'secret-value' }),
    ).toThrow('Secret keys must be canonical base64');
    expect(() =>
      readConfig({
        ...environment,
        OPERATION_HMAC_KEYS_JSON: JSON.stringify({
          v1: environment.JWT_SECRET_BASE64,
        }),
      }),
    ).toThrow('must be independent');
    expect(() =>
      readConfig({ ...environment, OPERATION_HMAC_CURRENT_KEY_ID: 'missing' }),
    ).toThrow('Current operation HMAC key is missing');
  });
  it('requires HTTPS and secure host-prefixed cookies in production', () => {
    expect(() =>
      readConfig({ ...environment, NODE_ENV: 'production' }),
    ).toThrow();
    expect(
      readConfig({
        ...environment,
        NODE_ENV: 'production',
        APP_ORIGIN: 'https://erp.example',
        COOKIE_SECURE: 'true',
      }).cookieName,
    ).toBe('__Host-erp_session');
    expect(() =>
      readConfig({ ...environment, APP_ORIGIN: 'http://erp.example' }),
    ).toThrow();
  });
  it('rejects invalid origin, timezone and contradictory session limits', () => {
    expect(() =>
      readConfig({ ...environment, APP_ORIGIN: 'http://localhost:5173/path' }),
    ).toThrow();
    expect(() =>
      readConfig({ ...environment, APP_TIMEZONE: 'invalid-zone' }),
    ).toThrow();
    expect(() =>
      readConfig({
        ...environment,
        SESSION_IDLE_SECONDS: '100',
        SESSION_MAX_SECONDS: '50',
      }),
    ).toThrow();
  });
});
