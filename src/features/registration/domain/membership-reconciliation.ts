import type {
  RegisteredMembership,
  RegisteredPerson,
  RegisteredFamily,
} from './registration.js';
import type {
  Attendance,
  ActivitySession,
  SourceVersion,
  AttendanceSources,
} from '../../attendance/domain/attendance.js';
export type ReconciliationIntent = 'TRANSFER' | 'CORRECTION';
export type MembershipChange = Pick<
  RegisteredMembership,
  'validFrom' | 'validUntil' | 'isReference' | 'relationshipToReference'
> &
  (
    | { membershipId: string; expectedRevision: number }
    | { clientRef: string; familyId: string }
  );
export interface AttendanceContextChange {
  attendanceId: string;
  expectedRevision: number;
  sessionId: string;
  expectedSessionRevision: number;
  membership: { id: string } | { clientRef: string };
  reason: string;
}
export interface ReconciliationPlan {
  intent: ReconciliationIntent;
  expectedPersonRevision: number;
  familyRevisions: { familyId: string; expectedRevision: number }[];
  membershipChanges: MembershipChange[];
  attendanceContextChanges: AttendanceContextChange[];
  reason: string;
}
export interface ReconciliationCommand extends ReconciliationPlan {
  expectedSourceFingerprint: string;
}
export interface ReconciliationResult {
  person: RegisteredPerson;
  memberships: RegisteredMembership[];
  families: RegisteredFamily[];
  sessions: ActivitySession[];
  attendances: Attendance[];
  createdMemberships: { clientRef: string; membershipId: string }[];
}
export interface ReconciliationReference {
  person: SourceVersion;
  memberships: SourceVersion[];
  families: SourceVersion[];
  sessions: SourceVersion[];
  attendances: SourceVersion[];
  createdMemberships: { clientRef: string; membershipId: string }[];
}
export interface ReconciliationSources {
  person: RegisteredPerson;
  memberships: RegisteredMembership[];
  families: RegisteredFamily[];
  activities: AttendanceSources[];
}
