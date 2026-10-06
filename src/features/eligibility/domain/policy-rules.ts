import type { CivilPeriod } from '../../attendance/domain/attendance.js';
import { nextCivilDay } from '../../attendance/domain/frequency-rules.js';
import { EligibilityRuleError } from './eligibility-errors.js';
import type {
  EligibilityPolicy,
  PolicyDefinition,
  PolicyDraft,
  PolicyPeriod,
  PolicyVersion,
} from './eligibility.js';

const civilDay = (time: number) => new Date(time).toISOString().slice(0, 10);

/** Civil interval evaluated for a reference; null when the reference precedes a fixed period. */
export function policyPeriod(
  period: PolicyPeriod,
  referenceDate: string,
): CivilPeriod | null {
  const toExclusive = nextCivilDay(referenceDate);
  if (period.type === 'ROLLING_DAYS')
    return {
      from: civilDay(
        Date.parse(referenceDate) - (period.length - 1) * 86400000,
      ),
      toExclusive,
    };
  if (period.type === 'CALENDAR_MONTHS') {
    const reference = new Date(referenceDate);
    return {
      from: civilDay(
        Date.UTC(
          reference.getUTCFullYear(),
          reference.getUTCMonth() - (period.length - 1),
          1,
        ),
      ),
      toExclusive,
    };
  }
  if (referenceDate < period.start) return null;
  return {
    from: period.start,
    toExclusive:
      period.endExclusive < toExclusive ? period.endExclusive : toExclusive,
  };
}

export function policyInEffect(
  policies: readonly EligibilityPolicy[],
  referenceDate: string,
): EligibilityPolicy | null {
  return (
    policies
      .filter((policy) => policy.effectiveFrom <= referenceDate)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] ?? null
  );
}

/** Versions newest first; each one ends where the next version starts. */
export function policyVersions(
  policies: readonly EligibilityPolicy[],
): PolicyVersion[] {
  const ordered = [...policies].sort(
    (a, b) =>
      b.effectiveFrom.localeCompare(a.effectiveFrom) ||
      a.id.localeCompare(b.id),
  );
  return ordered.map((policy, index) => ({
    ...policy,
    effectiveUntilExclusive: ordered[index - 1]?.effectiveFrom ?? null,
  }));
}

const positiveInteger = (value: number) =>
  Number.isInteger(value) && value >= 1;

/** Accepts only the modalities the evaluator implements; nothing is defaulted. */
export function assertPolicyDefinition(draft: PolicyDraft): PolicyDefinition {
  if (
    draft.schemaVersion !== 1 ||
    draft.justificationRule !== 'NOT_SUPPORTED' ||
    draft.recessRule !== 'RECORDED_SESSIONS_ONLY' ||
    draft.newParticipantRule !== 'OPPORTUNITY_RULE' ||
    draft.toleranceRule !== 'NONE' ||
    draft.incompleteEvidenceRule !== 'THREE_VALUED'
  )
    throw new EligibilityRuleError('UNSUPPORTED_POLICY_MODALITY');
  const { period, minimum } = draft;
  const validPeriod =
    period.type === 'FIXED_PERIOD'
      ? period.start < period.endExclusive
      : positiveInteger(period.length);
  const validMinimum =
    minimum.type === 'PRESENCE_COUNT'
      ? positiveInteger(minimum.value)
      : positiveInteger(minimum.basisPoints) && minimum.basisPoints <= 10000;
  if (
    !validPeriod ||
    !validMinimum ||
    draft.activityIds.length === 0 ||
    new Set(draft.activityIds).size !== draft.activityIds.length
  )
    throw new EligibilityRuleError('INVALID_POLICY_DEFINITION');
  return {
    schemaVersion: 1,
    period,
    minimum,
    activityIds: [...draft.activityIds].sort(),
    activityCombination: draft.activityCombination,
    membershipScope: draft.membershipScope,
    opportunityRule: draft.opportunityRule,
    justificationRule: 'NOT_SUPPORTED',
    recessRule: 'RECORDED_SESSIONS_ONLY',
    newParticipantRule: 'OPPORTUNITY_RULE',
    toleranceRule: 'NONE',
    incompleteEvidenceRule: 'THREE_VALUED',
  };
}
