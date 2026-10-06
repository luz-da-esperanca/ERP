import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createSensitivePayloads } from '../../../../src/features/social-forms/infra/sensitive-payloads.js';

const context = {
  formId: 'form',
  version: 1,
  memberId: 'member',
  block: 'health' as const,
};
describe('Protected social payloads', () => {
  it('reads old publications after rotation only while their historical key remains available', () => {
    const v1 = randomBytes(32);
    const first = createSensitivePayloads('v1', { v1 }).seal(context, {
      physicalHealth: 'GOOD',
    });
    const rotated = createSensitivePayloads('v2', { v1, v2: randomBytes(32) });
    expect(rotated.open(context, first)).toEqual({ physicalHealth: 'GOOD' });
    expect(rotated.seal(context, { physicalHealth: 'REGULAR' }).keyId).toBe(
      'v2',
    );
  });
  it('authenticates the complete payload and its historical context with a fresh nonce', () => {
    const cipher = createSensitivePayloads('v1', { v1: randomBytes(32) });
    const first = cipher.seal(context, { physicalHealth: 'GOOD' });
    const second = cipher.seal(context, { physicalHealth: 'GOOD' });
    expect(cipher.open(context, first)).toEqual({ physicalHealth: 'GOOD' });
    expect(first.nonce).not.toBe(second.nonce);
    expect(JSON.stringify(first)).not.toContain('GOOD');
    expect(() =>
      cipher.open({ ...context, memberId: 'another' }, first),
    ).toThrow('Protected social data unavailable');
    expect(() =>
      cipher.open(context, {
        ...first,
        ciphertext: Buffer.from('changed').toString('base64'),
      }),
    ).toThrow('Protected social data unavailable');
    expect(() =>
      createSensitivePayloads('v2', { v2: randomBytes(32) }).open(
        context,
        first,
      ),
    ).toThrow('Protected social data unavailable');
    expect(
      createSensitivePayloads('v2', {
        v1: randomBytes(32),
        v2: randomBytes(32),
      }).available(),
    ).toBe(true);
    expect(createSensitivePayloads('', {}).available()).toBe(false);
  });
});
