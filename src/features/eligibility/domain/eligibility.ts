import type {
  ActivitySession,
  Attendance,
  AttendanceCoverage,
  CivilPeriod,
  HistoricalMembership,
  SourceVersion,
} from '../../attendance/domain/attendance.js';
import type { Enrollment } from '../../projects/domain/projects.js';

export type EligibilityStatus = 'ELIGIBLE' | 'INELIGIBLE' | 'PENDING';
export type EligibilityEntity = 'EligibilityPolicy' | 'EligibilityAssessment';
export type ActivityCombination = 'ANY_ACTIVITY' | 'COMBINED';
export type MembershipScope = 'CURRENT_ON_REFERENCE' | 'ANY_WITHIN_PERIOD';
export type OpportunityRule =
  'ENROLLMENT_OR_RECORDED' | 'ALL_COMPLETED_DURING_MEMBERSHIP';
export type FamilyPendingReason =
  'POLICY_UNDEFINED' | 'REFERENCE_OUTSIDE_PERIOD' | 'MEMBERSHIP_UNRESOLVED';
export type EvidencePendingReason =
  'NO_OPPORTUNITIES' | 'COVERAGE_INCOMPLETE' | 'MARKINGS_INCOMPLETE';
export type PendingReason = FamilyPendingReason | EvidencePendingReason;
export type ExplanationRule =
  | FamilyPendingReason
  | 'MEMBER_MEETS_MINIMUM'
  | 'EVIDENCE_INSUFFICIENT'
  | 'ALL_MEMBERS_BELOW_MINIMUM';
export type PolicyPeriod =
  | { type: 'ROLLING_DAYS'; length: number }
  | { type: 'CALENDAR_MONTHS'; length: number }
  | { type: 'FIXED_PERIOD'; start: string; endExclusive: string };
export type PolicyMinimum =
  | { type: 'PRESENCE_COUNT'; value: number }
  | { type: 'ATTENDANCE_RATE'; basisPoints: number };
interface PolicySelections {
  period: PolicyPeriod;
  minimum: PolicyMinimum;
  activityIds: string[];
  activityCombination: ActivityCombination;
  membershipScope: MembershipScope;
  opportunityRule: OpportunityRule;
}
export interface PolicyDefinition extends PolicySelections {
  schemaVersion: 1;
  justificationRule: 'NOT_SUPPORTED';
  recessRule: 'RECORDED_SESSIONS_ONLY';
  newParticipantRule: 'OPPORTUNITY_RULE';
  toleranceRule: 'NONE';
  incompleteEvidenceRule: 'THREE_VALUED';
}
/** Requested definition before its modalities are checked against the supported mechanism. */
export interface PolicyDraft extends PolicySelections {
  schemaVersion: number;
  justificationRule: string;
  recessRule: string;
  newParticipantRule: string;
  toleranceRule: string;
  incompleteEvidenceRule: string;
}
export interface EligibilityPolicy {
  id: string;
  effectiveFrom: string;
  definition: PolicyDefinition;
  decisionReference: string;
  reason: string;
  recordedAt: string;
  recordedBy: string;
}
export interface PolicyVersion extends EligibilityPolicy {
  effectiveUntilExclusive: string | null;
}
export interface PolicyPublication {
  definition: PolicyDraft;
  effectiveFrom: string;
  expectedLatestPolicyId: string | null;
  decisionReference: string;
  reason: string;
  retroactive: boolean;
}
export interface ActivityEvidenceSources {
  activityId: string;
  sessions: Pick<
    ActivitySession,
    'id' | 'occurredAt' | 'status' | 'revision'
  >[];
  attendances: Pick<
    Attendance,
    | 'id'
    | 'sessionId'
    | 'personId'
    | 'familyId'
    | 'membershipId'
    | 'status'
    | 'revision'
  >[];
  enrollments: Pick<
    Enrollment,
    'id' | 'personId' | 'validFrom' | 'validUntil' | 'revision'
  >[];
  declarations: (Pick<
    AttendanceCoverage,
    'id' | 'periodStart' | 'periodEndExclusive' | 'revision'
  > & { invalidatedPeriods: CivilPeriod[] })[];
}
export interface EvidenceSnapshot {
  /** Effective memberships of canonical people in the evaluated family. */
  memberships: HistoricalMembership[];
  activities: ActivityEvidenceSources[];
}
export interface EvaluationContext {
  familyId: string;
  referenceDate: string;
  evaluatedAt: string;
  timeZone: string;
}
export interface EligibilityEvidence {
  personId: string;
  membershipIds: string[];
  activityIds: string[];
  periodStart: string;
  periodEndExclusive: string;
  sessionCount: number;
  presenceCount: number;
  absenceCount: number;
  unrecordedCount: number;
  /** Possible rate bounds in basis points; unknown without a proven denominator. */
  rateLowerBasisPoints: number | null;
  rateUpperBasisPoints: number | null;
  coverageComplete: boolean;
  status: EligibilityStatus;
  pendingReason: EvidencePendingReason | null;
  sourceVersions: SourceVersion[];
}
export interface EligibilityExplanation {
  rule: ExplanationRule;
  period: CivilPeriod | null;
  minimum: PolicyMinimum | null;
  activityIds: string[];
  activityCombination: ActivityCombination | null;
  membershipScope: MembershipScope | null;
  opportunityRule: OpportunityRule | null;
  qualifyingPersonIds: string[];
}
export interface EligibilityResult {
  familyId: string;
  referenceDate: string;
  evaluatedAt: string;
  policyId: string | null;
  status: EligibilityStatus;
  pendingReasons: PendingReason[];
  explanation: EligibilityExplanation;
  evidences: EligibilityEvidence[];
}
export interface EligibilityPreview extends EligibilityResult {
  sourceFingerprint: string;
}
export interface EligibilityAssessment extends EligibilityPreview {
  id: string;
  requestedBy: string;
}
export type EligibilitySnapshot = EligibilityPolicy | EligibilityAssessment;
export interface EligibilityReference {
  entityType: EligibilityEntity;
  entityId: string;
}
