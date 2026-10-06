import type { Principal } from '../../access/application/ports.js';
import type { MissingDataTransaction } from './missing-data-ports.js';
import type { AttendanceTransaction } from '../../attendance/application/attendance-ports.js';
import type {
  ActivitySession,
  Attendance,
  AttendanceCoverage,
} from '../../attendance/domain/attendance.js';
import type { Enrollment } from '../../projects/domain/projects.js';
import type { QualityIssue } from '../domain/data-quality.js';
import type {
  IdentityMerge,
  MergeIdentities,
  MergeResult,
  MergeSources,
} from '../domain/identity-merge.js';
import type {
  RegisteredFamily,
  RegisteredMembership,
  RegisteredPerson,
  SizeProfile,
} from '../domain/registration.js';
import type { RevisionReference } from './registration-ports.js';

export interface MergeReference {
  merge: { entityType: 'IdentityMerge'; entityId: string };
  target: RevisionReference;
}
export interface MergeAuditEntry {
  operationId: string;
  actorId: string;
  classification: 'REGISTRATION' | 'PROJECTS' | 'ATTENDANCE';
  entityType: string;
  entityId: string;
  revision: number;
  before: object | null;
  after: object;
  reason: string;
  occurredAt?: string;
}
export interface IdentityMergeReaderPorts {
  /** Null unless both identities exist and are still canonical. */
  sources(identities: MergeIdentities): Promise<MergeSources | null>;
}
export interface IdentityMergeTransaction extends IdentityMergeReaderPorts {
  missingData: MissingDataTransaction;
  actor(id: string): Promise<Principal | null>;
  operation(
    type: string,
    key: string,
  ): Promise<{
    actorId: string | null;
    fingerprint: string;
    reference: MergeReference;
  } | null>;
  createOperation(
    type: string,
    key: string,
    actorId: string,
    fingerprint: string,
  ): Promise<string>;
  completeOperation(id: string, reference: MergeReference): Promise<void>;
  restore(reference: MergeReference): Promise<MergeResult>;
  coverage: Pick<AttendanceTransaction, 'updateCoverage' | 'audit'>;
  personCoverage(personId: string): Promise<AttendanceCoverage[]>;
  membershipMarkings(
    membershipId: string,
  ): Promise<{ id: string; occurredAt: string }[]>;
  /** Always produces a new target revision, even without field changes. */
  updateTarget(
    identities: MergeIdentities,
    changes: Record<string, string>,
  ): Promise<RegisteredPerson | RegisteredFamily>;
  updateMembership(
    id: string,
    changes: Partial<
      Pick<
        RegisteredMembership,
        'personId' | 'familyId' | 'validFrom' | 'validUntil'
      > & { supersededById: string }
    >,
  ): Promise<RegisteredMembership>;
  updateEnrollment(
    id: string,
    changes: Partial<
      Pick<
        Enrollment,
        'personId' | 'validFrom' | 'validUntil' | 'supersededById'
      >
    >,
    actorId: string,
  ): Promise<Enrollment>;
  updateAttendance(
    id: string,
    changes: Partial<
      Pick<
        Attendance,
        | 'personId'
        | 'familyId'
        | 'membershipId'
        | 'membershipRevision'
        | 'supersededById'
      >
    >,
  ): Promise<Attendance>;
  reviseSession(id: string): Promise<ActivitySession>;
  reviseFamily(id: string): Promise<RegisteredFamily>;
  saveSizes(profile: SizeProfile): Promise<SizeProfile>;
  resolveIssue(
    id: string,
    actorId: string,
    reason: string,
  ): Promise<QualityIssue>;
  markMerged(identities: MergeIdentities): Promise<void>;
  createMerge(
    input: Omit<IdentityMerge, 'id' | 'recordedAt'>,
  ): Promise<IdentityMerge>;
  audit(entry: MergeAuditEntry): Promise<void>;
}
export interface IdentityMergeReader {
  read<T>(work: (ports: IdentityMergeReaderPorts) => Promise<T>): Promise<T>;
}
export interface IdentityMergeUnitOfWork {
  run<T>(
    actorId: string,
    identities: MergeIdentities,
    work: (ports: IdentityMergeTransaction) => Promise<T>,
  ): Promise<T>;
}
