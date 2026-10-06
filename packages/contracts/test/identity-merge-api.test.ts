import { describe, expect, it } from 'vitest';
import {
  mergeCommandSchema,
  mergeIdentitiesSchema,
} from '../src/identity-merge-api';

const id = (value: number) =>
  `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const identities = { entityType: 'PERSON', sourceId: id(1), targetId: id(2) };
const command = {
  ...identities,
  expectedSourceRevision: 1,
  expectedTargetRevision: 2,
  expectedSourceFingerprint: 'a'.repeat(64),
  fieldSelections: { name: 'SOURCE' },
  reason: 'Synthetic duplicate registration',
};

describe('Identity merge HTTP inputs', () => {
  it('accepts only the two identities for a preview', () => {
    expect(mergeIdentitiesSchema.parse(identities)).toEqual(identities);
    for (const input of [
      { ...identities, entityType: 'ACTIVITY' },
      { ...identities, reason: 'not part of a preview' },
      { entityType: 'FAMILY', sourceId: id(1) },
    ])
      expect(mergeIdentitiesSchema.safeParse(input).success).toBe(false);
  });
  it('requires reason, revisions, fingerprint and explicit field choices', () => {
    expect(mergeCommandSchema.parse(command)).toEqual({
      ...command,
      membershipResolutions: [],
      enrollmentResolutions: [],
      attendanceResolutions: [],
      sizeProfileResolution: null,
    });
    for (const key of Object.keys(command)) {
      const incomplete: Record<string, unknown> = { ...command };
      delete incomplete[key];
      expect(mergeCommandSchema.safeParse(incomplete).success, key).toBe(false);
    }
    expect(
      mergeCommandSchema.safeParse({
        ...command,
        fieldSelections: { name: 'BOTH' },
      }).success,
    ).toBe(false);
  });
  it('normalizes interval instants and rejects ambiguous resolutions', () => {
    const parsed = mergeCommandSchema.parse({
      ...command,
      membershipResolutions: [
        {
          id: id(3),
          action: 'KEEP',
          validFrom: '2026-01-01T00:00:00-03:00',
          validUntil: null,
        },
        { id: id(4), action: 'SUPERSEDE', supersededById: id(3) },
      ],
      attendanceResolutions: [
        { sessionId: id(5), effectiveAttendanceId: id(6) },
      ],
      sizeProfileResolution: { keep: 'TARGET' },
    });
    expect(parsed.membershipResolutions[0]).toMatchObject({
      validFrom: '2026-01-01T03:00:00.000Z',
    });
    for (const resolution of [
      { id: id(4), action: 'SUPERSEDE' },
      { id: id(4), action: 'SUPERSEDE', supersededById: id(4) },
      { id: id(4), action: 'KEEP', validFrom: '2026-01-01' },
      { id: id(4), action: 'DELETE' },
    ])
      expect(
        mergeCommandSchema.safeParse({
          ...command,
          enrollmentResolutions: [resolution],
        }).success,
      ).toBe(false);
  });
});
