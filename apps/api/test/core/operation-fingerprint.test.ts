import { describe, expect, it } from 'vitest';
import { readConfig } from '../../src/core/config.js';
import {
  fingerprint,
  sameFingerprint,
} from '../../src/core/operation-fingerprint.js';

const config = readConfig({
  APP_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://localhost/erp_test',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET_BASE64: Buffer.alloc(32, 1).toString('base64'),
  OPERATION_HMAC_CURRENT_KEY_ID: 'v2',
  OPERATION_HMAC_KEYS_JSON: JSON.stringify({
    v1: Buffer.alloc(32, 2).toString('base64'),
    v2: Buffer.alloc(32, 3).toString('base64'),
  }),
  COOKIE_SECURE: 'false',
});

describe('Operation fingerprint equivalence', () => {
  it.each([null, 'v2'])(
    'ignores object key order and absent optional properties (key: %s)',
    (keyId) => {
      const first = {
        type: 'USER_UPDATE',
        target: 'user-1',
        body: {
          displayName: 'Synthetic Operator',
          optional: undefined,
          nested: { active: true, revision: 3 },
        },
      };
      const second = {
        body: {
          nested: { revision: 3, active: true },
          displayName: 'Synthetic Operator',
        },
        target: 'user-1',
        type: 'USER_UPDATE',
      };

      expect(fingerprint(config, first, keyId)).toBe(
        fingerprint(config, second, keyId),
      );
    },
  );

  it('preserves array order unless the input contract has already normalized a set', () => {
    expect(fingerprint(config, { values: ['first', 'second'] }, null)).not.toBe(
      fingerprint(config, { values: ['second', 'first'] }, null),
    );
  });

  it('distinguishes null from an absent property', () => {
    expect(fingerprint(config, { value: null }, null)).not.toBe(
      fingerprint(config, {}, null),
    );
  });

  it('distinguishes different operation types', () => {
    expect(
      fingerprint(config, { type: 'USER_UPDATE', target: 'user-1' }, null),
    ).not.toBe(
      fingerprint(config, { type: 'USER_ACTIVATE', target: 'user-1' }, null),
    );
  });

  it.each([
    {
      name: 'password',
      changed: {
        target: 'user-1',
        temporaryPassword: 'different-synthetic-password',
      },
    },
    {
      name: 'target',
      changed: { target: 'user-2', temporaryPassword: 'synthetic-password' },
    },
  ])(
    'distinguishes a different $name in password command content',
    ({ changed }) => {
      const original = {
        target: 'user-1',
        temporaryPassword: 'synthetic-password',
      };

      expect(fingerprint(config, original, 'v2')).not.toBe(
        fingerprint(config, changed, 'v2'),
      );
    },
  );

  it('uses the stored key identifier after rotation instead of the current key', () => {
    const originalConfig = { ...config, OPERATION_HMAC_CURRENT_KEY_ID: 'v1' };
    const content = { target: 'user-1', initialPassword: 'synthetic-password' };
    const stored = fingerprint(originalConfig, content, 'v1');

    expect(fingerprint(config, content, 'v1')).toBe(stored);
    expect(fingerprint(config, content, 'v2')).not.toBe(stored);
    expect(fingerprint(config, content, null)).not.toBe(stored);
  });

  it('rejects a missing historical key instead of silently using another key', () => {
    expect(() =>
      fingerprint(config, { initialPassword: 'synthetic-password' }, 'missing'),
    ).toThrow('Required operation HMAC key is unavailable');
  });

  it('accepts matching digests and rejects different content or digest lengths', () => {
    const stored = fingerprint(config, { target: 'user-1' }, 'v2');
    const different = fingerprint(config, { target: 'user-2' }, 'v2');

    expect(sameFingerprint(stored, stored)).toBe(true);
    expect(sameFingerprint(stored, different)).toBe(false);
    expect(sameFingerprint(stored, stored.slice(2))).toBe(false);
  });
});
