import { describe, expect, it } from 'vitest';
import {
  assessmentCommandSchema,
  publishPolicySchema,
} from '../src/eligibility-api';

const id = '00000000-0000-4000-8000-000000000001';
const publication = {
  definition: {
    schemaVersion: 1,
    period: { type: 'CALENDAR_MONTHS', length: 3 },
    minimum: { type: 'ATTENDANCE_RATE', basisPoints: 7500 },
    activityIds: [id],
    activityCombination: 'ANY_ACTIVITY',
    membershipScope: 'CURRENT_ON_REFERENCE',
    opportunityRule: 'ENROLLMENT_OR_RECORDED',
    justificationRule: 'NOT_SUPPORTED',
    recessRule: 'RECORDED_SESSIONS_ONLY',
    newParticipantRule: 'OPPORTUNITY_RULE',
    toleranceRule: 'NONE',
    incompleteEvidenceRule: 'THREE_VALUED',
  },
  effectiveFrom: '2026-01-01',
  expectedLatestPolicyId: null,
  decisionReference: 'Synthetic decision reference',
  reason: 'Synthetic publication',
  retroactive: false,
};

describe('Eligibility HTTP inputs', () => {
  it('accepts a complete publication without filling any selection by default', () => {
    expect(publishPolicySchema.parse(publication)).toEqual(publication);
    for (const key of Object.keys(publication.definition)) {
      const definition: Record<string, unknown> = { ...publication.definition };
      delete definition[key];
      expect(
        publishPolicySchema.safeParse({ ...publication, definition }).success,
        key,
      ).toBe(false);
    }
    for (const key of Object.keys(publication)) {
      const incomplete: Record<string, unknown> = { ...publication };
      delete incomplete[key];
      expect(publishPolicySchema.safeParse(incomplete).success, key).toBe(
        false,
      );
    }
  });
  it('rejects unknown keys, malformed periods and non-integer thresholds', () => {
    const withDefinition = (changes: object) => ({
      ...publication,
      definition: { ...publication.definition, ...changes },
    });
    for (const input of [
      { ...publication, recordedBy: id },
      withDefinition({ defaultDays: 30 }),
      withDefinition({ period: { type: 'ROLLING_DAYS', length: 1.5 } }),
      withDefinition({ period: { type: 'FIXED_PERIOD', start: '2026-01-01' } }),
      withDefinition({
        minimum: { type: 'ATTENDANCE_RATE', basisPoints: 75.5 },
      }),
      withDefinition({ minimum: { type: 'PRESENCE_COUNT', basisPoints: 1 } }),
      withDefinition({ activityIds: ['not-a-uuid'] }),
    ])
      expect(publishPolicySchema.safeParse(input).success).toBe(false);
  });
  it('leaves the support of a named modality to the publication rule', () => {
    expect(
      publishPolicySchema.safeParse({
        ...publication,
        definition: {
          ...publication.definition,
          toleranceRule: 'ONE_ABSENCE',
        },
      }).success,
    ).toBe(true);
  });
  it('requires a civil reference date for an assessment', () => {
    expect(
      assessmentCommandSchema.parse({ referenceDate: '2026-03-31' }),
    ).toEqual({ referenceDate: '2026-03-31' });
    for (const input of [
      {},
      { referenceDate: '2026-03-31T00:00:00Z' },
      { referenceDate: '2026-03-31', familyId: id },
    ])
      expect(assessmentCommandSchema.safeParse(input).success).toBe(false);
  });
});
