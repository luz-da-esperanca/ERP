import type { Capability } from '@erp/contracts/access';
import type { AuditEntity } from './audit-entry.js';
export const auditScopes: readonly {
  classification: string;
  capability: Capability;
  entities: readonly AuditEntity[];
}[] = [
  {
    classification: 'ACCOUNTS',
    capability: 'accounts.manage',
    entities: ['UserAccount'],
  },
  {
    classification: 'REGISTRATION',
    capability: 'registration.read',
    entities: [
      'Family',
      'Person',
      'FamilyMembership',
      'SizeProfile',
      'DataQualityIssue',
      'IdentityMerge',
    ],
  },
  {
    classification: 'PROJECTS',
    capability: 'projects.read',
    entities: [
      'Institute',
      'ServiceType',
      'Project',
      'Activity',
      'ParticipantEnrollment',
    ],
  },
  {
    classification: 'ATTENDANCE',
    capability: 'attendance.read',
    entities: ['ActivitySession', 'Attendance', 'AttendanceCoverage'],
  },
  {
    classification: 'ELIGIBILITY',
    capability: 'eligibility.read',
    entities: ['EligibilityPolicy', 'EligibilityAssessment'],
  },
  {
    classification: 'SOCIAL_FORMS',
    capability: 'socialForms.read',
    entities: ['SocialForm', 'Acknowledgement'],
  },
  {
    classification: 'FEATURE_DECISIONS',
    capability: 'featureDecisions.manage',
    entities: ['FieldSelectionVersion', 'SocialFormOption', 'FeatureDecision'],
  },
];
export function auditScope(entity: AuditEntity) {
  const scope = auditScopes.find((scope) => scope.entities.includes(entity));
  if (!scope) throw new Error('Unknown audit entity');
  return scope;
}
