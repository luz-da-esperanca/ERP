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
export const registrationAuditQuerySchema = paginationSchema
  .extend({
    entityType: registrationAuditEntitySchema,
    entityId: z.uuid().optional(),
    actorId: z.uuid().optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
    action: registrationAuditActionSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      !value.from || !value.to || new Date(value.from) < new Date(value.to),
  );
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
export const auditEntrySchema = z.union([
  accountAuditEntrySchema,
  registrationAuditEntrySchema,
]);
export const authorizedAuditQuerySchema = z.union([
  auditQuerySchema,
  registrationAuditQuerySchema,
]);
export const auditPageSchema = z.object({
  data: z.array(auditEntrySchema),
  pagination: paginationSchema.extend({
    total: z.number().int().nonnegative(),
  }),
});
export type AuditEntryDto = z.infer<typeof auditEntrySchema>;
export type AuditPageDto = z.infer<typeof auditPageSchema>;
