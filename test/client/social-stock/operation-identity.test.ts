import { describe, expect, it, vi } from 'vitest';
import { identifyOperation, type OperationIdentity } from '../../../src/client/social-stock/operation-identity.ts';

describe('identifyOperation', () => {
  it('creates an identity for the first submission', () => {
    const generateKey = vi.fn(() => 'key-1');

    const identity = identifyOperation(null, '{"name":"Roupas"}', generateKey);

    expect(identity).toEqual({ key: 'key-1', payload: '{"name":"Roupas"}' });
    expect(generateKey).toHaveBeenCalledTimes(1);
  });

  it('reuses the identity when retrying the identical payload', () => {
    const previous: OperationIdentity = { key: 'key-1', payload: '{"name":"Roupas"}' };
    const generateKey = vi.fn(() => 'key-2');

    expect(identifyOperation(previous, '{"name":"Roupas"}', generateKey)).toBe(previous);
    expect(generateKey).not.toHaveBeenCalled();
  });

  it('starts a new identity when the payload changes', () => {
    const previous: OperationIdentity = { key: 'key-1', payload: '{"name":"Roupas"}' };
    const generateKey = vi.fn(() => 'key-2');

    expect(identifyOperation(previous, '{"name":"Calçados"}', generateKey))
      .toEqual({ key: 'key-2', payload: '{"name":"Calçados"}' });
  });
});
