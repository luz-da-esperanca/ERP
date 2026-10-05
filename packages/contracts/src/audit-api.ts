import {
  sessionDtoSchema,
  attendanceDtoSchema,
  coverageDtoSchema,
} from './attendance-api';
import { z } from 'zod';
import { accountAuditEntrySchema, auditQuerySchema } from './account-audit-api';
import { paginationSchema } from './access-api';
import {
  familyDtoSchema,
  personDtoSchema,
  membershipDtoSchema,
  sizeProfileSchema,
} from './registration-api';
import { dataQualityIssueSchema } from './data-quality-api';
import {
  instituteDtoSchema,
  serviceTypeDtoSchema,
  projectDtoSchema,
  activityDtoSchema,
  enrollmentDtoSchema,
} from './projects-api';

export { dataQualityIssueSchema } from './data-quality-api';
export const registrationAuditActionSchema = z.enum([
  'CREATE',
  'UPDATE',
  'CLOSE',
  'CORRECT',
]);
export const registrationAuditEntitySchema = z.enum([
  'Family',
  'Person',
  'FamilyMembership',
  'SizeProfile',
  'DataQualityIssue',
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
export const auditEntrySchema = z.union([
  accountAuditEntrySchema,
  registrationAuditEntrySchema,
  projectsAuditEntrySchema,
  attendanceAuditEntrySchema,
]);
export const authorizedAuditQuerySchema = z.union([
  auditQuerySchema,
  registrationAuditQuerySchema,
  projectsAuditQuerySchema,
  attendanceAuditQuerySchema,
]);
export const auditPageSchema = z.object({
  data: z.array(auditEntrySchema),
  pagination: paginationSchema.extend({
    total: z.number().int().nonnegative(),
  }),
});
export type AuditEntryDto = z.infer<typeof auditEntrySchema>;
export type AuditPageDto = z.infer<typeof auditPageSchema>;
