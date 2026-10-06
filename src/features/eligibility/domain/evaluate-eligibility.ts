import type {
  CivilPeriod,
  HistoricalMembership,
  SourceVersion,
} from '../../attendance/domain/attendance.js';
import {
  civilBoundary,
  coveredPeriods,
} from '../../attendance/domain/frequency-rules.js';
import { isMembershipCurrent } from '../../registration/domain/membership-rules.js';
import { policyPeriod } from './policy-rules.js';
import type {
  ActivityEvidenceSources,
  EligibilityEvidence,
  EligibilityPolicy,
  EligibilityResult,
  EligibilityStatus,
  EvaluationContext,
  EvidencePendingReason,
  EvidenceSnapshot,
  ExplanationRule,
  FamilyPendingReason,
  PolicyDefinition,
  PolicyMinimum,
} from './eligibility.js';

interface Counts {
  presenceCount: number;
  absenceCount: number;
  unrecordedCount: number;
  coverageComplete: boolean;
}

function decide(
  minimum: PolicyMinimum,
  { presenceCount, absenceCount, unrecordedCount, coverageComplete }: Counts,
): { status: EligibilityStatus; pendingReason: EvidencePendingReason | null } {
  const sessionCount = presenceCount + absenceCount + unrecordedCount;
  const pending = (pendingReason: EvidencePendingReason) => ({
    status: 'PENDING' as const,
    pendingReason,
  });
  // 0/0 is neither a rate nor proof of failure.
  if (sessionCount === 0) return pending('NO_OPPORTUNITIES');
  const best = presenceCount + unrecordedCount;
  if (minimum.type === 'PRESENCE_COUNT') {
    // Known presences already prove an absolute minimum, whatever else is missing.
    if (presenceCount >= minimum.value)
      return { status: 'ELIGIBLE', pendingReason: null };
    if (!coverageComplete) return pending('COVERAGE_INCOMPLETE');
    return best < minimum.value
      ? { status: 'INELIGIBLE', pendingReason: null }
      : pending('MARKINGS_INCOMPLETE');
  }
  // The denominator is only known once every completed session is declared registered.
  if (!coverageComplete) return pending('COVERAGE_INCOMPLETE');
  const required = minimum.basisPoints * sessionCount;
  if (presenceCount >= 1 && presenceCount * 10000 >= required)
    return { status: 'ELIGIBLE', pendingReason: null };
  return best * 10000 < required
    ? { status: 'INELIGIBLE', pendingReason: null }
    : pending('MARKINGS_INCOMPLETE');
}

function overlaps(
  interval: Pick<HistoricalMembership, 'validFrom' | 'validUntil'>,
  from: string,
  toExclusive: string,
) {
  return (
    Date.parse(interval.validFrom) < Date.parse(toExclusive) &&
    (interval.validUntil === null ||
      Date.parse(interval.validUntil) > Date.parse(from))
  );
}

function collect(
  sources: ActivityEvidenceSources,
  definition: PolicyDefinition,
  familyId: string,
  personId: string,
  memberships: readonly HistoricalMembership[],
  period: CivilPeriod,
  from: string,
  toExclusive: string,
) {
  const versions: SourceVersion[] = [];
  const counts = { presenceCount: 0, absenceCount: 0, unrecordedCount: 0 };
  const enrollments = sources.enrollments.filter(
    (row) => row.personId === personId,
  );
  for (const session of sources.sessions) {
    if (
      session.status !== 'COMPLETED' ||
      session.occurredAt < from ||
      session.occurredAt >= toExclusive
    )
      continue;
    const marking = sources.attendances.find(
      (row) => row.sessionId === session.id && row.personId === personId,
    );
    // A recorded fact stays in the family registered at the session.
    if (marking && marking.familyId !== familyId) continue;
    if (!marking) {
      const member = memberships.some((row) =>
        isMembershipCurrent(row, session.occurredAt),
      );
      const pertinent =
        definition.opportunityRule === 'ALL_COMPLETED_DURING_MEMBERSHIP' ||
        enrollments.some((row) => isMembershipCurrent(row, session.occurredAt));
      if (!member || !pertinent) continue;
    }
    versions.push({
      entityType: 'ActivitySession',
      entityId: session.id,
      revision: session.revision,
    });
    if (!marking) counts.unrecordedCount++;
    else {
      versions.push({
        entityType: 'Attendance',
        entityId: marking.id,
        revision: marking.revision,
      });
      if (marking.status === 'PRESENT') counts.presenceCount++;
      else counts.absenceCount++;
    }
  }
  for (const enrollment of enrollments)
    if (overlaps(enrollment, from, toExclusive))
      versions.push({
        entityType: 'ParticipantEnrollment',
        entityId: enrollment.id,
        revision: enrollment.revision,
      });
  for (const declaration of sources.declarations)
    if (
      declaration.periodStart < period.toExclusive &&
      declaration.periodEndExclusive > period.from
    )
      versions.push({
        entityType: 'AttendanceCoverage',
        entityId: declaration.id,
        revision: declaration.revision,
      });
  return {
    ...counts,
    versions,
    coverageComplete: coveredPeriods(
      period.from,
      period.toExclusive,
      sources.declarations,
    ).isComplete,
  };
}

/**
 * Pure three-valued evaluation. Unknown markings are only used as bounds:
 * they never count as presence nor as absence.
 */
export function evaluateEligibility(
  context: EvaluationContext,
  policy: EligibilityPolicy | null,
  snapshot: EvidenceSnapshot,
): EligibilityResult {
  const definition = policy?.definition ?? null;
  const period = definition
    ? policyPeriod(definition.period, context.referenceDate)
    : null;
  const result = (
    status: EligibilityStatus,
    rule: ExplanationRule,
    evidences: EligibilityEvidence[] = [],
    pendingReasons: EligibilityResult['pendingReasons'] = [],
  ): EligibilityResult => ({
    familyId: context.familyId,
    referenceDate: context.referenceDate,
    evaluatedAt: context.evaluatedAt,
    policyId: policy?.id ?? null,
    status,
    pendingReasons,
    explanation: {
      rule,
      period,
      minimum: definition?.minimum ?? null,
      activityIds: definition?.activityIds ?? [],
      activityCombination: definition?.activityCombination ?? null,
      membershipScope: definition?.membershipScope ?? null,
      opportunityRule: definition?.opportunityRule ?? null,
      qualifyingPersonIds: [
        ...new Set(
          evidences
            .filter((row) => row.status === 'ELIGIBLE')
            .map((row) => row.personId),
        ),
      ].sort(),
    },
    evidences,
  });
  const unresolved = (reason: FamilyPendingReason) =>
    result('PENDING', reason, [], [reason]);
  if (!definition) return unresolved('POLICY_UNDEFINED');
  if (!period) return unresolved('REFERENCE_OUTSIDE_PERIOD');

  const from = civilBoundary(period.from, context.timeZone);
  const toExclusive = civilBoundary(period.toExclusive, context.timeZone);
  // Facts never go beyond the reference day nor beyond what is known at evaluation.
  const cut = new Date(
    Math.min(Date.parse(toExclusive) - 1, Date.parse(context.evaluatedAt)),
  ).toISOString();
  const family = snapshot.memberships.filter(
    (row) => row.familyId === context.familyId,
  );
  const candidates = [
    ...new Set(
      family
        .filter((row) =>
          definition.membershipScope === 'CURRENT_ON_REFERENCE'
            ? isMembershipCurrent(row, cut)
            : overlaps(row, from, toExclusive),
        )
        .map((row) => row.personId),
    ),
  ].sort();
  if (!candidates.length) return unresolved('MEMBERSHIP_UNRESOLVED');

  const groups =
    definition.activityCombination === 'COMBINED'
      ? [definition.activityIds]
      : definition.activityIds.map((id) => [id]);
  const evidences: EligibilityEvidence[] = [];
  for (const personId of candidates) {
    const memberships = family.filter((row) => row.personId === personId);
    const relevant = memberships.filter((row) =>
      overlaps(row, from, toExclusive),
    );
    for (const activityIds of groups) {
      const parts = activityIds.map((activityId) =>
        collect(
          snapshot.activities.find((row) => row.activityId === activityId) ?? {
            activityId,
            sessions: [],
            attendances: [],
            enrollments: [],
            declarations: [],
          },
          definition,
          context.familyId,
          personId,
          memberships,
          period,
          from,
          toExclusive,
        ),
      );
      const sum = (key: keyof Counts & `${string}Count`) =>
        parts.reduce((total, part) => total + part[key], 0);
      const counts = {
        presenceCount: sum('presenceCount'),
        absenceCount: sum('absenceCount'),
        unrecordedCount: sum('unrecordedCount'),
        coverageComplete: parts.every((part) => part.coverageComplete),
      };
      const sessionCount =
        counts.presenceCount + counts.absenceCount + counts.unrecordedCount;
      const bounded = counts.coverageComplete && sessionCount > 0;
      evidences.push({
        personId,
        membershipIds: relevant.map((row) => row.id).sort(),
        activityIds,
        periodStart: period.from,
        periodEndExclusive: period.toExclusive,
        sessionCount,
        ...counts,
        rateLowerBasisPoints: bounded
          ? Math.floor((counts.presenceCount * 10000) / sessionCount)
          : null,
        rateUpperBasisPoints: bounded
          ? Math.floor(
              ((counts.presenceCount + counts.unrecordedCount) * 10000) /
                sessionCount,
            )
          : null,
        ...decide(definition.minimum, counts),
        sourceVersions: [
          ...relevant.map((row) => ({
            entityType: 'FamilyMembership',
            entityId: row.id,
            revision: row.revision,
          })),
          ...parts.flatMap((part) => part.versions),
        ].sort(
          (a, b) =>
            a.entityType.localeCompare(b.entityType) ||
            a.entityId.localeCompare(b.entityId),
        ),
      });
    }
  }
  // One proven member is enough, whatever is missing for the others.
  if (evidences.some((row) => row.status === 'ELIGIBLE'))
    return result('ELIGIBLE', 'MEMBER_MEETS_MINIMUM', evidences);
  const reasons = [
    ...new Set(
      evidences.flatMap((row) =>
        row.pendingReason ? [row.pendingReason] : [],
      ),
    ),
  ].sort();
  return reasons.length
    ? result('PENDING', 'EVIDENCE_INSUFFICIENT', evidences, reasons)
    : result('INELIGIBLE', 'ALL_MEMBERS_BELOW_MINIMUM', evidences);
}
