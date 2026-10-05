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
  'UserAccount' | RegistrationAuditEntity | ProjectsEntity;
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
export type AuditEntry =
  AccountAuditEntry | RegistrationAuditEntry | ProjectsAuditEntry;
