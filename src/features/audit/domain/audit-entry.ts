import type {
  AttendanceEntity,
  AttendanceSnapshot,
} from '../../attendance/domain/attendance.js';
import type { AccountAuditEntry } from './account-audit.js';
import type {
  RegisteredFamily,
  RegisteredPerson,
  RegisteredMembership,
  SizeProfile,
} from '../../registration/domain/registration.js';
import type { QualityIssue } from '../../registration/domain/data-quality.js';
import type {
  ProjectsEntity,
  ProjectsSnapshot,
} from '../../projects/domain/projects.js';
export type RegistrationAuditEntity =
  'Family' | 'Person' | 'FamilyMembership' | 'SizeProfile' | 'DataQualityIssue';
export type AuditEntity =
  'UserAccount' | RegistrationAuditEntity | ProjectsEntity | AttendanceEntity;
export type RegistrationAuditAction = 'CREATE' | 'UPDATE' | 'CLOSE' | 'CORRECT';
export type RegistrationSnapshot =
  | RegisteredFamily
  | RegisteredPerson
  | RegisteredMembership
  | SizeProfile
  | QualityIssue;
export type RegistrationAuditEntry = Omit<
  AccountAuditEntry,
  'entityType' | 'action' | 'before' | 'after' | 'classification'
> & {
  entityType: RegistrationAuditEntity;
  action: RegistrationAuditAction;
  before: RegistrationSnapshot | null;
  after: RegistrationSnapshot;
  classification: 'REGISTRATION';
};
export type ProjectsAuditEntry = Omit<
  AccountAuditEntry,
  'entityType' | 'action' | 'before' | 'after' | 'classification'
> & {
  entityType: ProjectsEntity;
  action: RegistrationAuditAction;
  before: ProjectsSnapshot | null;
  after: ProjectsSnapshot;
  classification: 'PROJECTS';
};
export type AttendanceAuditAction =
  'CREATE' | 'CORRECT' | 'CANCEL' | 'INVALIDATE';
export type AttendanceAuditEntry = Omit<
  AccountAuditEntry,
  'entityType' | 'action' | 'before' | 'after' | 'classification'
> & {
  entityType: AttendanceEntity;
  action: AttendanceAuditAction;
  before: AttendanceSnapshot | null;
  after: AttendanceSnapshot;
  classification: 'ATTENDANCE';
};
export type AuditEntry =
  | AccountAuditEntry
  | RegistrationAuditEntry
  | ProjectsAuditEntry
  | AttendanceAuditEntry;
