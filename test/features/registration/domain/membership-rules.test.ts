import { describe, expect, it } from 'vitest';
import { assertMembershipPlan } from '../../../../src/features/registration/domain/membership-rules.js';

describe('Historical family membership', () => {
  it('allows consecutive membership intervals and rejects overlapping families or references', () => {
    const first = {
      id: 'first',
      personId: 'person',
      familyId: 'family-a',
      isReference: true,
      validFrom: '2026-01-01T00:00:00Z',
      validUntil: '2026-02-01T00:00:00Z',
    };
    const next = {
      ...first,
      id: 'next',
      familyId: 'family-b',
      validFrom: '2026-02-01T00:00:00Z',
      validUntil: null,
    };
    const now = '2026-10-05T12:00:00Z';
    expect(() => assertMembershipPlan([first, next], now)).not.toThrow();
    expect(() =>
      assertMembershipPlan(
        [first, { ...next, validFrom: '2026-01-31T23:59:59Z' }],
        now,
      ),
    ).toThrow(expect.objectContaining({ rule: 'MEMBERSHIP_OVERLAP' }));
    expect(() =>
      assertMembershipPlan(
        [first, { ...first, id: 'other', personId: 'other-person' }],
        now,
      ),
    ).toThrow(expect.objectContaining({ rule: 'REFERENCE_OVERLAP' }));
    expect(() =>
      assertMembershipPlan(
        [{ ...next, validFrom: '2026-10-06T00:00:00Z' }],
        now,
      ),
    ).toThrow(expect.objectContaining({ rule: 'FUTURE_MEMBERSHIP' }));
  });
});
