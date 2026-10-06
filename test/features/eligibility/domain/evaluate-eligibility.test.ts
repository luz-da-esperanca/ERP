import { describe, expect, it } from 'vitest';
import { evaluateEligibility } from '../../../../src/features/eligibility/domain/evaluate-eligibility.js';
import {
  activityId,
  evidenceBuilder,
  familyId,
  otherActivityId,
  otherFamilyId,
  personId,
  publishedPolicy,
  timeZone,
} from '../../../support/eligibility-fixture.js';

const context = (referenceDate = '2026-03-31') => ({
  familyId,
  referenceDate,
  evaluatedAt: '2026-06-01T12:00:00.000Z',
  timeZone,
});
const covered = ['2026-03-02', '2026-04-01'] as const;

describe('Eligibility without an applicable criterion', () => {
  it('keeps every family pending while no policy is in effect', () => {
    const sources = evidenceBuilder();
    sources.member(1);
    sources.enroll(1).session('2026-03-10', { 1: 'PRESENT' });
    expect(
      evaluateEligibility(context(), null, sources.snapshot),
    ).toMatchObject({
      status: 'PENDING',
      policyId: null,
      pendingReasons: ['POLICY_UNDEFINED'],
      evidences: [],
      explanation: { rule: 'POLICY_UNDEFINED', minimum: null, period: null },
    });
  });
  it('stays pending when no member of the family can be resolved', () => {
    const result = evaluateEligibility(
      context(),
      publishedPolicy(),
      evidenceBuilder().snapshot,
    );
    expect(result).toMatchObject({
      status: 'PENDING',
      pendingReasons: ['MEMBERSHIP_UNRESOLVED'],
      evidences: [],
    });
  });
  it('stays pending when the reference precedes a fixed period', () => {
    const sources = evidenceBuilder();
    sources.member(1);
    const policy = publishedPolicy({
      period: {
        type: 'FIXED_PERIOD',
        start: '2026-05-01',
        endExclusive: '2026-06-01',
      },
    });
    expect(
      evaluateEligibility(context(), policy, sources.snapshot),
    ).toMatchObject({
      status: 'PENDING',
      pendingReasons: ['REFERENCE_OUTSIDE_PERIOD'],
    });
  });
});

describe('Eligibility by absolute presence count', () => {
  it('declares the family eligible when one member proves the minimum despite incomplete relatives', () => {
    const sources = evidenceBuilder();
    sources.member(1);
    sources.member(2);
    sources
      .enroll(1)
      .enroll(2)
      .session('2026-03-10', { 1: 'PRESENT' })
      .session('2026-03-17', { 1: 'PRESENT' });
    const result = evaluateEligibility(
      context(),
      publishedPolicy(),
      sources.snapshot,
    );
    expect(result).toMatchObject({
      status: 'ELIGIBLE',
      pendingReasons: [],
      explanation: {
        rule: 'MEMBER_MEETS_MINIMUM',
        qualifyingPersonIds: [personId(1)],
        membershipScope: 'CURRENT_ON_REFERENCE',
        period: { from: '2026-03-02', toExclusive: '2026-04-01' },
      },
    });
    expect(result.evidences).toEqual([
      expect.objectContaining({
        personId: personId(1),
        activityIds: [activityId],
        sessionCount: 2,
        presenceCount: 2,
        unrecordedCount: 0,
        coverageComplete: false,
        status: 'ELIGIBLE',
        pendingReason: null,
      }),
      expect.objectContaining({
        personId: personId(2),
        sessionCount: 2,
        presenceCount: 0,
        unrecordedCount: 2,
        status: 'PENDING',
        pendingReason: 'COVERAGE_INCOMPLETE',
      }),
    ]);
  });
  it('never treats enrollment without marking as presence or as absence', () => {
    const sources = evidenceBuilder();
    sources.member(1);
    sources
      .enroll(1)
      .session('2026-03-10')
      .session('2026-03-17')
      .cover(...covered);
    expect(
      evaluateEligibility(context(), publishedPolicy(), sources.snapshot),
    ).toMatchObject({
      status: 'PENDING',
      pendingReasons: ['MARKINGS_INCOMPLETE'],
      evidences: [{ presenceCount: 0, absenceCount: 0, unrecordedCount: 2 }],
    });
  });
  it('concludes ineligible only when coverage is complete and the best case stays below the minimum', () => {
    const sources = evidenceBuilder();
    sources.member(1);
    sources
      .enroll(1)
      .session('2026-03-10', { 1: 'ABSENT' })
      .session('2026-03-17', { 1: 'PRESENT' })
      .session('2026-03-24', { 1: 'ABSENT' });
    const policy = publishedPolicy();
    expect(
      evaluateEligibility(context(), policy, sources.snapshot),
    ).toMatchObject({
      status: 'PENDING',
      pendingReasons: ['COVERAGE_INCOMPLETE'],
    });
    sources.cover(...covered);
    expect(
      evaluateEligibility(context(), policy, sources.snapshot),
    ).toMatchObject({
      status: 'INELIGIBLE',
      pendingReasons: [],
      explanation: {
        rule: 'ALL_MEMBERS_BELOW_MINIMUM',
        qualifyingPersonIds: [],
      },
    });
  });
  it('does not turn zero opportunities into a negative result', () => {
    const sources = evidenceBuilder();
    sources.member(1);
    sources.enroll(1).cover(...covered);
    expect(
      evaluateEligibility(context(), publishedPolicy(), sources.snapshot),
    ).toMatchObject({
      status: 'PENDING',
      pendingReasons: ['NO_OPPORTUNITIES'],
      evidences: [{ sessionCount: 0, rateUpperBasisPoints: null }],
    });
  });
  it('ignores canceled sessions and sessions after the reference cut', () => {
    const sources = evidenceBuilder();
    sources.member(1);
    sources
      .enroll(1)
      .session('2026-03-10', { 1: 'PRESENT' }, { status: 'CANCELED' })
      .session(
        '2026-03-31',
        { 1: 'PRESENT' },
        { at: '2026-04-01T02:59:59.999Z' },
      )
      .session(
        '2026-04-01',
        { 1: 'PRESENT' },
        { at: '2026-04-01T03:00:00.000Z' },
      );
    expect(
      evaluateEligibility(context(), publishedPolicy(), sources.snapshot)
        .evidences[0],
    ).toMatchObject({ sessionCount: 1, presenceCount: 1 });
  });
});

describe('Eligibility by attendance rate', () => {
  const rate = (basisPoints: number) =>
    publishedPolicy({ minimum: { type: 'ATTENDANCE_RATE', basisPoints } });
  it('compares integers so rounding never approves a rate below the minimum', () => {
    const sources = evidenceBuilder();
    sources.member(1);
    sources
      .enroll(1)
      .session('2026-03-10', { 1: 'PRESENT' })
      .session('2026-03-17', { 1: 'PRESENT' })
      .session('2026-03-24', { 1: 'ABSENT' })
      .cover(...covered);
    expect(
      evaluateEligibility(context(), rate(6667), sources.snapshot),
    ).toMatchObject({
      status: 'INELIGIBLE',
      evidences: [{ rateLowerBasisPoints: 6666, rateUpperBasisPoints: 6666 }],
    });
    expect(
      evaluateEligibility(context(), rate(6666), sources.snapshot).status,
    ).toBe('ELIGIBLE');
  });
  it('requires complete coverage even when every known marking is a presence', () => {
    const sources = evidenceBuilder();
    sources.member(1);
    sources.enroll(1).session('2026-03-10', { 1: 'PRESENT' });
    expect(
      evaluateEligibility(context(), rate(5000), sources.snapshot),
    ).toMatchObject({
      status: 'PENDING',
      pendingReasons: ['COVERAGE_INCOMPLETE'],
      evidences: [{ rateLowerBasisPoints: null }],
    });
  });
  it('stays pending while unrecorded markings could still change the conclusion', () => {
    const sources = evidenceBuilder();
    sources.member(1);
    sources
      .enroll(1)
      .session('2026-03-10', { 1: 'PRESENT' })
      .session('2026-03-17')
      .cover(...covered);
    expect(
      evaluateEligibility(context(), rate(7500), sources.snapshot),
    ).toMatchObject({
      status: 'PENDING',
      pendingReasons: ['MARKINGS_INCOMPLETE'],
      evidences: [{ rateLowerBasisPoints: 5000, rateUpperBasisPoints: 10000 }],
    });
  });
});

describe('Eligibility across activities and opportunity rules', () => {
  it('evaluates each activity separately or combines their counts as the policy selects', () => {
    const sources = evidenceBuilder();
    sources.member(1);
    sources
      .enroll(1)
      .enroll(1, otherActivityId)
      .session('2026-03-10', { 1: 'PRESENT' })
      .session('2026-03-11', { 1: 'PRESENT' }, { activity: otherActivityId });
    const activityIds = [activityId, otherActivityId];
    const separate = evaluateEligibility(
      context(),
      publishedPolicy({ activityIds }),
      sources.snapshot,
    );
    expect(separate.status).toBe('PENDING');
    expect(separate.evidences).toHaveLength(2);
    const combined = evaluateEligibility(
      context(),
      publishedPolicy({ activityIds, activityCombination: 'COMBINED' }),
      sources.snapshot,
    );
    expect(combined).toMatchObject({
      status: 'ELIGIBLE',
      evidences: [{ activityIds, sessionCount: 2, presenceCount: 2 }],
    });
  });
  it('counts sessions without enrollment only when the policy selects membership opportunities', () => {
    const sources = evidenceBuilder();
    sources.member(1);
    sources.session('2026-03-10').session('2026-03-17');
    expect(
      evaluateEligibility(context(), publishedPolicy(), sources.snapshot)
        .evidences[0],
    ).toMatchObject({ sessionCount: 0 });
    expect(
      evaluateEligibility(
        context(),
        publishedPolicy({ opportunityRule: 'ALL_COMPLETED_DURING_MEMBERSHIP' }),
        sources.snapshot,
      ).evidences[0],
    ).toMatchObject({ sessionCount: 2, unrecordedCount: 2 });
  });
});

describe('Eligibility and historical family context', () => {
  it('never carries presences recorded in the previous family into the current one', () => {
    const sources = evidenceBuilder();
    sources.member(1, {
      family: otherFamilyId,
      from: '2025-01-01',
      until: '2026-03-15',
    });
    sources.member(1, { from: '2026-03-15' });
    sources
      .enroll(1)
      .session('2026-03-05', { 1: 'PRESENT' }, { family: otherFamilyId })
      .session('2026-03-10', { 1: 'PRESENT' }, { family: otherFamilyId })
      .session('2026-03-20', { 1: 'PRESENT' });
    const result = evaluateEligibility(
      context(),
      publishedPolicy(),
      sources.snapshot,
    );
    expect(result.status).toBe('PENDING');
    expect(result.evidences[0]).toMatchObject({
      sessionCount: 1,
      presenceCount: 1,
    });
  });
  it('considers a member who left before the cut only under the period scope', () => {
    const sources = evidenceBuilder();
    sources.member(1, { from: '2025-01-01', until: '2026-03-20' });
    sources.member(2);
    sources
      .enroll(1)
      .session('2026-03-05', { 1: 'PRESENT' })
      .session('2026-03-10', { 1: 'PRESENT' });
    const current = evaluateEligibility(
      context(),
      publishedPolicy(),
      sources.snapshot,
    );
    expect(current.status).toBe('PENDING');
    expect(current.evidences.map((row) => row.personId)).toEqual([personId(2)]);
    const within = evaluateEligibility(
      context(),
      publishedPolicy({ membershipScope: 'ANY_WITHIN_PERIOD' }),
      sources.snapshot,
    );
    expect(within).toMatchObject({
      status: 'ELIGIBLE',
      explanation: {
        membershipScope: 'ANY_WITHIN_PERIOD',
        qualifyingPersonIds: [personId(1)],
      },
    });
  });
  it('lists the revisions of every source that supports the result', () => {
    const sources = evidenceBuilder();
    const membershipId = sources.member(1);
    sources
      .enroll(1)
      .session('2026-03-10', { 1: 'PRESENT' })
      .cover(...covered);
    const [evidence] = evaluateEligibility(
      context(),
      publishedPolicy(),
      sources.snapshot,
    ).evidences;
    expect(evidence!.membershipIds).toEqual([membershipId]);
    expect(
      evidence!.sourceVersions.map((row) => row.entityType).sort(),
    ).toEqual([
      'ActivitySession',
      'Attendance',
      'AttendanceCoverage',
      'FamilyMembership',
      'ParticipantEnrollment',
    ]);
  });
});
