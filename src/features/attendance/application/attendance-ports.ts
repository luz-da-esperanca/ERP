import type { Principal } from '../../access/application/ports.js';
import type {
  ActivitySession,
  Attendance,
  AttendanceCoverage,
  AttendanceSources,
  AttendanceSnapshot,
  AttendanceEntity,
  AttendanceReference,
  CreateMarking,
  SourceVersion,
} from '../domain/attendance.js';
export interface AttendanceReaderPorts {
  sources(
    activityId: string,
    personIds?: readonly string[],
  ): Promise<AttendanceSources | null>;
  session(id: string): Promise<ActivitySession | null>;
  attendance(id: string): Promise<Attendance | null>;
  accountExists(id: string): Promise<boolean>;
}
export interface AttendanceTransaction extends AttendanceReaderPorts {
  actor(id: string): Promise<Principal | null>;
  operation(
    type: string,
    key: string,
  ): Promise<{
    actorId: string | null;
    fingerprint: string;
    reference: AttendanceReference;
  } | null>;
  createOperation(
    type: string,
    key: string,
    actorId: string,
    fingerprint: string,
  ): Promise<string>;
  completeOperation(id: string, reference: AttendanceReference): Promise<void>;
  restore(reference: AttendanceReference): Promise<AttendanceSnapshot>;
  revision(reference: SourceVersion): Promise<AttendanceSnapshot>;
  createSession(
    activityId: string,
    responsibleId: string,
    occurredAt: string,
    actorId: string,
  ): Promise<ActivitySession>;
  updateSession(
    id: string,
    changes: Partial<
      Pick<ActivitySession, 'occurredAt' | 'responsibleId' | 'status'>
    >,
  ): Promise<ActivitySession>;
  createAttendance(
    sessionId: string,
    entry: CreateMarking,
    actorId: string,
  ): Promise<Attendance>;
  updateAttendance(
    id: string,
    changes: Partial<
      Pick<
        Attendance,
        'status' | 'familyId' | 'membershipId' | 'membershipRevision'
      >
    >,
  ): Promise<Attendance>;
  createCoverage(
    input: Omit<
      AttendanceCoverage,
      'id' | 'revision' | 'declaredAt' | 'invalidatedPeriods'
    >,
  ): Promise<AttendanceCoverage>;
  updateCoverage(
    id: string,
    invalidatedPeriods: AttendanceCoverage['invalidatedPeriods'],
  ): Promise<AttendanceCoverage>;
  audit(
    operationId: string,
    actorId: string,
    entityType: AttendanceEntity,
    before: AttendanceSnapshot | null,
    after: AttendanceSnapshot,
    action: 'CREATE' | 'CORRECT' | 'CANCEL' | 'INVALIDATE',
    reason?: string,
    occurredAt?: string,
  ): Promise<void>;
}
export interface AttendanceReader {
  read<T>(work: (ports: AttendanceReaderPorts) => Promise<T>): Promise<T>;
}
export interface AttendanceUnitOfWork {
  run<T>(
    actorId: string,
    work: (ports: AttendanceTransaction) => Promise<T>,
  ): Promise<T>;
}
