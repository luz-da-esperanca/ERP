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
import type { IdentityMerge } from '../../registration/domain/identity-merge.js';
import type {
  ProjectsEntity,
  ProjectsSnapshot,
} from '../../projects/domain/projects.js';
import type {
  SocialEntity,
  SocialSnapshot,
} from '../../social-forms/domain/social-forms.js';
import type {
  EligibilityEntity,
  EligibilitySnapshot,
} from '../../eligibility/domain/eligibility.js';
export type RegistrationAuditEntity =
  | 'Family'
  | 'Person'
  | 'FamilyMembership'
  | 'SizeProfile'
  | 'DataQualityIssue'
  | 'IdentityMerge';
export type AuditEntity =
  | 'UserAccount'
  | RegistrationAuditEntity
  | ProjectsEntity
  | AttendanceEntity
  | EligibilityEntity
  | SocialEntity;
export type RegistrationAuditAction =
  'CREATE' | 'UPDATE' | 'CLOSE' | 'CORRECT' | 'MERGE';
export type RegistrationSnapshot =
  | RegisteredFamily
  | RegisteredPerson
  | RegisteredMembership
  | SizeProfile
  | QualityIssue
  | IdentityMerge;
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
  'CREATE' | 'CORRECT' | 'CANCEL' | 'INVALIDATE' | 'MERGE';
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
export type EligibilityAuditEntry = Omit<
  AccountAuditEntry,
  'entityType' | 'action' | 'before' | 'after' | 'classification'
> & {
  entityType: EligibilityEntity;
  action: 'CREATE';
  before: null;
  after: EligibilitySnapshot;
  classification: 'ELIGIBILITY';
};
export type AuditEntry =
  | AccountAuditEntry
  | EligibilityAuditEntry
  | RegistrationAuditEntry
  | ProjectsAuditEntry
  | AttendanceAuditEntry
  | SocialFormsAuditEntry;
export type SocialFormsAuditEntry = Omit<
  AccountAuditEntry,
  'entityType' | 'action' | 'before' | 'after' | 'classification'
> & {
  entityType: SocialEntity;
  action: RegistrationAuditAction;
  before: SocialSnapshot | null;
  after: SocialSnapshot;
  classification: 'SOCIAL_FORMS' | 'FEATURE_DECISIONS';
};
