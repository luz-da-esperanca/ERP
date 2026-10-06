import { describe, expect, it } from 'vitest';
import {
  assertPolicyDefinition,
  policyInEffect,
  policyPeriod,
  policyVersions,
} from '../../../../src/features/eligibility/domain/policy-rules.js';
import type {
  EligibilityPolicy,
  PolicyDraft,
} from '../../../../src/features/eligibility/domain/eligibility.js';

const activityId = '00000000-0000-4000-8000-0000000000a1';
const draft = (changes: Partial<PolicyDraft> = {}): PolicyDraft => ({
  schemaVersion: 1,
  period: { type: 'ROLLING_DAYS', length: 30 },
  minimum: { type: 'PRESENCE_COUNT', value: 2 },
  activityIds: [activityId],
  activityCombination: 'ANY_ACTIVITY',
  membershipScope: 'CURRENT_ON_REFERENCE',
  opportunityRule: 'ENROLLMENT_OR_RECORDED',
  justificationRule: 'NOT_SUPPORTED',
  recessRule: 'RECORDED_SESSIONS_ONLY',
  newParticipantRule: 'OPPORTUNITY_RULE',
  toleranceRule: 'NONE',
  incompleteEvidenceRule: 'THREE_VALUED',
  ...changes,
});
const policy = (id: string, effectiveFrom: string): EligibilityPolicy => ({
  id,
  effectiveFrom,
  definition: assertPolicyDefinition(draft()),
  decisionReference: 'Synthetic decision',
  reason: 'Synthetic reason',
  recordedAt: '2026-01-01T12:00:00.000Z',
  recordedBy: '00000000-0000-4000-8000-0000000000b1',
});

describe('Eligibility policy period', () => {
  it('counts rolling days backwards including the reference day', () => {
    expect(
      policyPeriod({ type: 'ROLLING_DAYS', length: 30 }, '2026-03-01'),
    ).toEqual({ from: '2026-01-31', toExclusive: '2026-03-02' });
    expect(
      policyPeriod({ type: 'ROLLING_DAYS', length: 1 }, '2026-01-01'),
    ).toEqual({ from: '2026-01-01', toExclusive: '2026-01-02' });
  });
  it('starts calendar months on the first day and crosses the year boundary', () => {
    expect(
      policyPeriod({ type: 'CALENDAR_MONTHS', length: 2 }, '2026-01-15'),
    ).toEqual({ from: '2025-12-01', toExclusive: '2026-01-16' });
    expect(
      policyPeriod({ type: 'CALENDAR_MONTHS', length: 1 }, '2026-12-31'),
    ).toEqual({ from: '2026-12-01', toExclusive: '2027-01-01' });
  });
  it('limits a fixed period to the reference and refuses a reference before its start', () => {
    const period = {
      type: 'FIXED_PERIOD',
      start: '2026-02-01',
      endExclusive: '2026-03-01',
    } as const;
    expect(policyPeriod(period, '2026-01-31')).toBeNull();
    expect(policyPeriod(period, '2026-02-10')).toEqual({
      from: '2026-02-01',
      toExclusive: '2026-02-11',
    });
    expect(policyPeriod(period, '2026-06-01')).toEqual({
      from: '2026-02-01',
      toExclusive: '2026-03-01',
    });
  });
});

describe('Eligibility policy validity', () => {
  it('selects the version in effect on the reference date, never a later one', () => {
    const versions = [
      policy('00000000-0000-4000-8000-000000000002', '2026-03-01'),
      policy('00000000-0000-4000-8000-000000000001', '2026-01-01'),
    ];
    expect(policyInEffect(versions, '2025-12-31')).toBeNull();
    expect(policyInEffect(versions, '2026-02-28')?.id).toBe(versions[1]!.id);
    expect(policyInEffect(versions, '2026-03-01')?.id).toBe(versions[0]!.id);
  });
  it('ends each version at the start of the next one, newest first', () => {
    const versions = [
      policy('00000000-0000-4000-8000-000000000001', '2026-01-01'),
      policy('00000000-0000-4000-8000-000000000002', '2026-03-01'),
    ];
    expect(
      policyVersions(versions).map((row) => [
        row.effectiveFrom,
        row.effectiveUntilExclusive,
      ]),
    ).toEqual([
      ['2026-03-01', null],
      ['2026-01-01', '2026-03-01'],
    ]);
  });
});

describe('Eligibility policy definition', () => {
  it('normalizes the selected activities as a set', () => {
    const other = '00000000-0000-4000-8000-0000000000a0';
    expect(
      assertPolicyDefinition(draft({ activityIds: [activityId, other] }))
        .activityIds,
    ).toEqual([other, activityId]);
  });
  it.each([
    ['justificationRule', 'EXCUSED_COUNTS_AS_PRESENT'],
    ['recessRule', 'PLANNED_SCHEDULE'],
    ['newParticipantRule', 'GRACE_PERIOD'],
    ['toleranceRule', 'ONE_ABSENCE'],
    ['incompleteEvidenceRule', 'ASSUME_ABSENT'],
    ['schemaVersion', 2],
  ] as const)('rejects the unsupported modality %s=%s', (field, value) => {
    expect(() => assertPolicyDefinition(draft({ [field]: value }))).toThrow(
      expect.objectContaining({ rule: 'UNSUPPORTED_POLICY_MODALITY' }),
    );
  });
  it.each([
    [{ period: { type: 'ROLLING_DAYS', length: 0 } }],
    [
      {
        period: {
          type: 'FIXED_PERIOD',
          start: '2026-03-01',
          endExclusive: '2026-03-01',
        },
      },
    ],
    [{ minimum: { type: 'PRESENCE_COUNT', value: 0 } }],
    [{ minimum: { type: 'ATTENDANCE_RATE', basisPoints: 0 } }],
    [{ minimum: { type: 'ATTENDANCE_RATE', basisPoints: 10001 } }],
    [{ activityIds: [] }],
    [{ activityIds: [activityId, activityId] }],
  ] as const)('rejects the incomplete definition %j', (changes) => {
    expect(() =>
      assertPolicyDefinition(draft(changes as Partial<PolicyDraft>)),
    ).toThrow(expect.objectContaining({ rule: 'INVALID_POLICY_DEFINITION' }));
  });
});
