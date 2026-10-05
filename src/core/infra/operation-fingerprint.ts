import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { ApiConfig } from './config.js';
import type { OperationFingerprints } from '../../features/access/application/account-transactions.js';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  return value;
}
export function fingerprint(
  config: ApiConfig,
  content: unknown,
  keyId: string | null,
) {
  const serialized = JSON.stringify(canonicalize(content));
  if (!keyId) return createHash('sha256').update(serialized).digest('hex');
  const key = config.hmacKeys[keyId];
  if (!key) throw new Error('Required operation HMAC key is unavailable');
  return createHmac('sha256', key).update(serialized).digest('hex');
}
export function sameFingerprint(first: string, second: string) {
  const firstBytes = Buffer.from(first, 'hex');
  const secondBytes = Buffer.from(second, 'hex');
  return (
    firstBytes.length === secondBytes.length &&
    timingSafeEqual(firstBytes, secondBytes)
  );
}

export function createOperationFingerprints(
  config: ApiConfig,
): OperationFingerprints {
  return {
    currentKeyId: config.OPERATION_HMAC_CURRENT_KEY_ID,
    calculate: (content, keyId) => fingerprint(config, content, keyId),
    matches: sameFingerprint,
  };
}
