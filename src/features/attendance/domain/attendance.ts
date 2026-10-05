import type {
  Activity,
  Project,
  Enrollment,
} from '../../projects/domain/projects.js';
export type AttendanceStatus = 'PRESENT' | 'ABSENT';
export type SessionStatus = 'COMPLETED' | 'CANCELED';
export type OpportunityRelevance = 'ENROLLMENT' | 'RECORDED' | 'BOTH';
export type AttendanceResultKind = 'SESSION' | 'COVERAGE';
export type AttendanceEntity =
  'ActivitySession' | 'Attendance' | 'AttendanceCoverage';
export interface SourceVersion {
  entityType: string;
  entityId: string;
  revision: number;
}
export interface ActivitySession {
  id: string;
  activityId: string;
  responsibleId: string;
  occurredAt: string;
  recordedAt: string;
  recordedBy: string;
  status: SessionStatus;
  revision: number;
}
export interface Attendance {
  id: string;
  sessionId: string;
  personId: string;
  familyId: string;
  membershipId: string;
  membershipRevision: number;
  status: AttendanceStatus;
  recordedAt: string;
  recordedBy: string;
  revision: number;
  supersededById: string | null;
}
export interface CivilPeriod {
  from: string;
  toExclusive: string;
}
export interface InvalidatedPeriod extends CivilPeriod {
  recordedAt: string;
  recordedBy: string;
  reason: string;
}
export interface AttendanceCoverage {
  id: string;
  activityId: string;
  periodStart: string;
  periodEndExclusive: string;
  declaredBy: string;
  declaredAt: string;
  sourceVersions: SourceVersion[];
  revision: number;
  invalidatedPeriods: InvalidatedPeriod[];
}
export interface HistoricalMembership {
  id: string;
  personId: string;
  familyId: string;
  validFrom: string;
  validUntil: string | null;
  revision: number;
}
export interface ParticipantSources {
  id: string;
  name: string;
  revision: number;
  memberships: (HistoricalMembership & {
    familyCode: string;
    familyRevision: number;
  })[];
}
export interface AttendanceSources {
  activity: Activity;
  project: Project;
  enrollments: Enrollment[];
  people: ParticipantSources[];
  sessions: ActivitySession[];
  attendances: Attendance[];
  declarations: AttendanceCoverage[];
}
export interface RosterRow {
  personId: string;
  name: string;
  expectedPersonRevision: number;
  familyId: string | null;
  familyCode: string | null;
  expectedFamilyRevision: number | null;
  membershipId: string | null;
  expectedMembershipRevision: number | null;
  enrollmentIds: string[];
  attendance: Attendance | null;
}
export interface AttendanceContext {
  activityId: string;
  projectId: string;
  occurredAt: string;
  expectedActivityRevision: number;
  expectedProjectRevision: number;
  session: ActivitySession | null;
  rows: RosterRow[];
  rosterFingerprint: string;
}
export interface MarkingContext {
  personId: string;
  expectedPersonRevision: number;
  familyId: string;
  expectedFamilyRevision: number;
  membershipId: string;
  expectedMembershipRevision: number;
}
export interface CreateMarking extends MarkingContext {
  status: AttendanceStatus;
}
export type UpdateMarking =
  | { personId: string; expectedRevision: number; status: AttendanceStatus }
  | (CreateMarking & { expectedRevision: null });
export interface CreateSession {
  guestPersonIds?: string[];
  occurredAt: string;
  responsibleId: string;
  expectedActivityRevision: number;
  expectedRosterFingerprint: string;
  entries: CreateMarking[];
}
export interface UpdateAttendance {
  guestPersonIds?: string[];
  expectedSessionRevision: number;
  expectedRosterFingerprint: string;
  reason: string;
  entries: UpdateMarking[];
}
export interface SessionCorrection {
  expectedSessionRevision: number;
  occurredAt?: string;
  responsibleId?: string;
  reason: string;
  expectedRosterFingerprint?: string;
  contextCorrections?: (MarkingContext & { expectedRevision: number })[];
}
export interface ContextCorrection extends Omit<MarkingContext, 'personId'> {
  expectedRevision: number;
  expectedSessionRevision: number;
  reason: string;
}
export interface CoverageDeclaration {
  periodStart: string;
  periodEndExclusive: string;
  expectedActivityRevision: number;
  expectedSourceFingerprint: string;
  confirmed: true;
  reason: string;
}
export interface SessionResult {
  session: ActivitySession;
  attendances: Attendance[];
}
export interface SessionDetail extends SessionResult {
  context: AttendanceContext;
}
export interface FrequencyOpportunity {
  personId: string;
  sessionId: string;
  occurredAt: string;
  familyId: string | null;
  membershipId: string | null;
  membershipRevision: number | null;
  relevance: OpportunityRelevance;
  attendance: Attendance | null;
  sessionRevision: number;
  enrollmentRevisions: SourceVersion[];
  contextResolved: boolean;
}
export interface FrequencyQuery {
  personId: string;
  activityId: string;
  from: string;
  toExclusive: string;
  familyId?: string;
}
export interface AttendanceQuery {
  occurredAt: string;
  sessionId?: string;
  guestPersonIds: string[];
}
export interface SessionsQuery {
  page: number;
  pageSize: number;
  from?: string;
  toExclusive?: string;
  status?: SessionStatus;
}
export type AttendanceSnapshot =
  ActivitySession | Attendance | AttendanceCoverage;
export interface AttendanceReference {
  kind: AttendanceResultKind;
  primary: SourceVersion;
  attendances: SourceVersion[];
}
