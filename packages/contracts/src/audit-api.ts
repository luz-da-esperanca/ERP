import {
  sessionDtoSchema,
  attendanceDtoSchema,
  coverageDtoSchema,
} from './attendance-api';
import { assessmentDtoSchema, policyDtoSchema } from './eligibility-api';
import { identityMergeDtoSchema } from './identity-merge-api';
import { z } from 'zod';
import { accountAuditEntrySchema, auditQuerySchema } from './account-audit-api';
import { paginationSchema } from './access-api';
import {
  familyDtoSchema,
  personDtoSchema,
  membershipDtoSchema,
  sizeProfileSchema,
} from './registration-api';
import {
  dataQualityIssueSchema,
  missingDataSelectionSchema,
} from './data-quality-api';
import {
  instituteDtoSchema,
  serviceTypeDtoSchema,
  projectDtoSchema,
  activityDtoSchema,
  enrollmentDtoSchema,
} from './projects-api';
import {
  socialFormDtoSchema,
  acknowledgementDtoSchema,
  fieldSelectionDtoSchema,
  socialOptionDtoSchema,
  featureDecisionDtoSchema,
} from './social-forms-api';

export { dataQualityIssueSchema } from './data-quality-api';
export const registrationAuditActionSchema = z.enum([
  'CREATE',
  'UPDATE',
  'CLOSE',
  'CORRECT',
  'MERGE',
]);
export const registrationAuditEntitySchema = z.enum([
  'Family',
  'Person',
  'FamilyMembership',
  'SizeProfile',
  'DataQualityIssue',
  'IdentityMerge',
]);
const recordAuditQuerySchema = paginationSchema
  .extend({
    entityId: z.uuid().optional(),
    actorId: z.uuid().optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
    action: registrationAuditActionSchema.optional(),
  })
  .strict();
const validAuditPeriod = (value: { from?: string; to?: string }) =>
  !value.from || !value.to || new Date(value.from) < new Date(value.to);
export const registrationAuditQuerySchema = recordAuditQuerySchema
  .extend({ entityType: registrationAuditEntitySchema })
  .refine(validAuditPeriod);
const entryFields = accountAuditEntrySchema.omit({
  entityType: true,
  action: true,
  before: true,
  after: true,
  classification: true,
});
const registrationEntry = <
  T extends z.infer<typeof registrationAuditEntitySchema>,
  S extends z.ZodType,
>(
  entityType: T,
  snapshot: S,
) =>
  entryFields.extend({
    entityType: z.literal(entityType),
    action: registrationAuditActionSchema,
    classification: z.literal('REGISTRATION'),
    before: snapshot.nullable(),
    after: snapshot,
  });
export const registrationAuditEntrySchema = z.discriminatedUnion('entityType', [
  registrationEntry('Family', familyDtoSchema),
  registrationEntry('Person', personDtoSchema),
  registrationEntry('FamilyMembership', membershipDtoSchema),
  registrationEntry('SizeProfile', sizeProfileSchema),
  registrationEntry('DataQualityIssue', dataQualityIssueSchema),
  registrationEntry('IdentityMerge', identityMergeDtoSchema),
]);
export const projectsAuditEntitySchema = z.enum([
  'Institute',
  'ServiceType',
  'Project',
  'Activity',
  'ParticipantEnrollment',
]);
const projectsEntry = <
  T extends z.infer<typeof projectsAuditEntitySchema>,
  S extends z.ZodType,
>(
  entityType: T,
  snapshot: S,
) =>
  entryFields.extend({
    entityType: z.literal(entityType),
    action: registrationAuditActionSchema,
    classification: z.literal('PROJECTS'),
    before: snapshot.nullable(),
    after: snapshot,
  });
export const projectsAuditEntrySchema = z.discriminatedUnion('entityType', [
  projectsEntry('Institute', instituteDtoSchema),
  projectsEntry('ServiceType', serviceTypeDtoSchema),
  projectsEntry('Project', projectDtoSchema),
  projectsEntry('Activity', activityDtoSchema),
  projectsEntry('ParticipantEnrollment', enrollmentDtoSchema),
]);
export const projectsAuditQuerySchema = recordAuditQuerySchema
  .extend({ entityType: projectsAuditEntitySchema })
  .refine(validAuditPeriod);
export const attendanceAuditEntitySchema = z.enum([
  'ActivitySession',
  'Attendance',
  'AttendanceCoverage',
]);
export const attendanceAuditActionSchema = z.enum([
  'CREATE',
  'CORRECT',
  'CANCEL',
  'INVALIDATE',
  'MERGE',
]);
const attendanceEntry = <
  T extends z.infer<typeof attendanceAuditEntitySchema>,
  S extends z.ZodType,
>(
  entityType: T,
  snapshot: S,
) =>
  entryFields.extend({
    entityType: z.literal(entityType),
    action: attendanceAuditActionSchema,
    classification: z.literal('ATTENDANCE'),
    before: snapshot.nullable(),
    after: snapshot,
  });
export const attendanceAuditEntrySchema = z.discriminatedUnion('entityType', [
  attendanceEntry('ActivitySession', sessionDtoSchema),
  attendanceEntry('Attendance', attendanceDtoSchema),
  attendanceEntry('AttendanceCoverage', coverageDtoSchema),
]);
export const attendanceAuditQuerySchema = recordAuditQuerySchema
  .extend({
    entityType: attendanceAuditEntitySchema,
    action: attendanceAuditActionSchema.optional(),
  })
  .refine(validAuditPeriod);
export const eligibilityAuditEntitySchema = z.enum([
  'EligibilityPolicy',
  'EligibilityAssessment',
]);
// Policies and assessments are immutable versions: their only event is the creation.
const eligibilityEntry = <
  T extends z.infer<typeof eligibilityAuditEntitySchema>,
  S extends z.ZodType,
>(
  entityType: T,
  snapshot: S,
) =>
  entryFields.extend({
    entityType: z.literal(entityType),
    action: z.literal('CREATE'),
    classification: z.literal('ELIGIBILITY'),
    before: z.null(),
    after: snapshot,
  });
export const eligibilityAuditEntrySchema = z.discriminatedUnion('entityType', [
  eligibilityEntry('EligibilityPolicy', policyDtoSchema),
  eligibilityEntry('EligibilityAssessment', assessmentDtoSchema),
]);
export const eligibilityAuditQuerySchema = recordAuditQuerySchema
  .extend({ entityType: eligibilityAuditEntitySchema })
  .refine(validAuditPeriod);
export const socialFormsAuditEntitySchema = z.enum([
  'SocialForm',
  'Acknowledgement',
  'FieldSelectionVersion',
  'SocialFormOption',
  'FeatureDecision',
]);
export const socialFormsAuditQuerySchema = recordAuditQuerySchema
  .extend({ entityType: socialFormsAuditEntitySchema })
  .refine(validAuditPeriod);
const socialEntry = <
  T extends z.infer<typeof socialFormsAuditEntitySchema>,
  S extends z.ZodType,
>(
  entityType: T,
  snapshot: S,
  classification: 'SOCIAL_FORMS' | 'FEATURE_DECISIONS',
) =>
  entryFields.extend({
    entityType: z.literal(entityType),
    classification: z.literal(classification),
    action: registrationAuditActionSchema,
    before: snapshot.nullable(),
    after: snapshot,
  });
export const socialFormsAuditEntrySchema = z.discriminatedUnion('entityType', [
  socialEntry('SocialForm', socialFormDtoSchema, 'SOCIAL_FORMS'),
  socialEntry('Acknowledgement', acknowledgementDtoSchema, 'SOCIAL_FORMS'),
  socialEntry(
    'FieldSelectionVersion',
    fieldSelectionDtoSchema,
    'FEATURE_DECISIONS',
  ),
  socialEntry('SocialFormOption', socialOptionDtoSchema, 'FEATURE_DECISIONS'),
  socialEntry('FeatureDecision', featureDecisionDtoSchema, 'FEATURE_DECISIONS'),
]);
export const registrationConfigurationAuditEntrySchema = entryFields.extend({
  entityType: z.literal('RegistrationFieldSelection'),
  action: z.literal('CREATE'),
  classification: z.literal('REGISTRATION_CONFIGURATION'),
  before: z.null(),
  after: missingDataSelectionSchema,
});
export const registrationConfigurationAuditQuerySchema = recordAuditQuerySchema
  .extend({ entityType: z.literal('RegistrationFieldSelection') })
  .refine(validAuditPeriod);
export const auditEntrySchema = z.union([
  accountAuditEntrySchema,
  registrationAuditEntrySchema,
  projectsAuditEntrySchema,
  attendanceAuditEntrySchema,
  eligibilityAuditEntrySchema,
  socialFormsAuditEntrySchema,
  registrationConfigurationAuditEntrySchema,
]);
export const authorizedAuditQuerySchema = z.union([
  auditQuerySchema,
  registrationAuditQuerySchema,
  projectsAuditQuerySchema,
  attendanceAuditQuerySchema,
  eligibilityAuditQuerySchema,
  socialFormsAuditQuerySchema,
  registrationConfigurationAuditQuerySchema,
]);
export const auditPageSchema = z.object({
  data: z.array(auditEntrySchema),
  pagination: paginationSchema.extend({
    total: z.number().int().nonnegative(),
  }),
});
export type AuditEntryDto = z.infer<typeof auditEntrySchema>;
export type AuditPageDto = z.infer<typeof auditPageSchema>;
