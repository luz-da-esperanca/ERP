import type {
  ActivitySession,
  Attendance,
} from '../../attendance/domain/attendance.js';
import type { Enrollment } from '../../projects/domain/projects.js';
import type { QualityIssue } from './data-quality.js';
import type { RegistrationEntity } from './duplicate-rules.js';
import type {
  FamilyFields,
  PersonFields,
  RegisteredFamily,
  RegisteredMembership,
  RegisteredPerson,
  SizeProfile,
} from './registration.js';

export type FieldChoice = 'SOURCE' | 'TARGET';
export interface IntervalRow {
  id: string;
  /** Family of a membership or activity of an enrollment. */
  group: string;
  validFrom: string;
  validUntil: string | null;
}
export type IntervalResolution =
  | { id: string; action: 'KEEP'; validFrom: string; validUntil: string | null }
  | { id: string; action: 'SUPERSEDE'; supersededById: string };
export interface ResolvedInterval extends IntervalRow {
  supersededById: string | null;
  changed: boolean;
}
export interface IntervalConflict {
  ids: [string, string];
  sameGroup: boolean;
}
export interface AttendanceConflict {
  sessionId: string;
  attendanceIds: [string, string];
  statusesDiffer: boolean;
}
export interface AttendanceResolution {
  sessionId: string;
  effectiveAttendanceId: string;
  reason?: string;
}
export interface FieldConflict {
  field: string;
  source: string;
  target: string;
}
export interface MergeIdentities {
  entityType: RegistrationEntity;
  sourceId: string;
  targetId: string;
}
interface CommonSources {
  /** Open duplicate issues that already relate the two identities. */
  issues: QualityIssue[];
  /** Immutable records that keep pointing to the source identity. */
  preserved: {
    socialForms: number;
    eligibilityAssessments: number;
  };
}
export interface PersonMergeSources extends CommonSources {
  entityType: 'PERSON';
  source: RegisteredPerson;
  target: RegisteredPerson;
  memberships: RegisteredMembership[];
  families: RegisteredFamily[];
  enrollments: Enrollment[];
  attendances: Attendance[];
  sessions: ActivitySession[];
  sizeProfiles: { source: SizeProfile | null; target: SizeProfile | null };
}
export interface FamilyMergeSources extends CommonSources {
  entityType: 'FAMILY';
  source: RegisteredFamily;
  target: RegisteredFamily;
  memberships: RegisteredMembership[];
  attendances: Attendance[];
  sessions: ActivitySession[];
}
export type MergeSources = PersonMergeSources | FamilyMergeSources;
export interface MergePreview extends MergeIdentities {
  expectedSourceRevision: number;
  expectedTargetRevision: number;
  sourceFingerprint: string;
  fieldConflicts: FieldConflict[];
  adoptedFields: string[];
  membershipConflicts: IntervalConflict[];
  /** Two references in the unified family; fixed by reference commands before merging. */
  referenceConflicts: { membershipIds: string[] }[];
  enrollmentConflicts: IntervalConflict[];
  attendanceConflicts: AttendanceConflict[];
  sizeProfileConflict: { source: SizeProfile; target: SizeProfile } | null;
  memberships: RegisteredMembership[];
  enrollments: Enrollment[];
  attendances: Attendance[];
  issueIds: string[];
  preserved: CommonSources['preserved'];
}
export interface MergeCommand extends MergeIdentities {
  expectedSourceRevision: number;
  expectedTargetRevision: number;
  expectedSourceFingerprint: string;
  fieldSelections: Record<string, FieldChoice>;
  membershipResolutions: IntervalResolution[];
  enrollmentResolutions: IntervalResolution[];
  attendanceResolutions: AttendanceResolution[];
  sizeProfileResolution: { keep: FieldChoice } | null;
  reason: string;
}
/** What the confirmation decided, kept with the immutable mapping. */
export interface MergeResolutionSummary {
  fieldSelections: Record<string, FieldChoice>;
  adoptedFields: string[];
  supersededMemberships: { id: string; supersededById: string }[];
  supersededEnrollments: { id: string; supersededById: string }[];
  supersededAttendances: { id: string; supersededById: string }[];
  sizeProfile: FieldChoice | null;
  resolvedIssueIds: string[];
}
export interface IdentityMerge extends MergeIdentities {
  id: string;
  recordedAt: string;
  recordedBy: string;
  reason: string;
  operationId: string;
  resolution: MergeResolutionSummary;
}
export interface MergeResult {
  merge: IdentityMerge;
  target: RegisteredPerson | RegisteredFamily;
}
export type MergeFields = PersonFields | FamilyFields;
