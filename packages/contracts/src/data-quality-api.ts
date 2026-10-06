import { z } from 'zod';
import { paginationSchema } from './access-api';
import { reasonSchema, revisionSchema } from './common';
export const dataQualityIssueSchema = z.object({
  id: z.uuid(),
  entityType: z.enum(['PERSON', 'FAMILY']),
  entityId: z.uuid(),
  kind: z.enum(['MISSING_DATA', 'POSSIBLE_DUPLICATE']),
  candidateIds: z.array(z.uuid()),
  fieldKeys: z.array(z.string()),
  identifiedAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
  resolution: z
    .enum(['DISTINCT', 'MERGED', 'COMPLETED', 'NOT_TRACKED'])
    .nullable(),
  resolvedBy: z.uuid().nullable(),
  reason: z.string().nullable(),
  revision: revisionSchema,
});
export const qualityQuerySchema = paginationSchema
  .extend({
    entityType: z.enum(['PERSON', 'FAMILY']).optional(),
    kind: z.enum(['MISSING_DATA', 'POSSIBLE_DUPLICATE']).optional(),
    status: z.enum(['OPEN', 'RESOLVED']).optional(),
  })
  .strict();
export const qualityPageSchema = z.object({
  data: z.array(dataQualityIssueSchema),
  pagination: paginationSchema.extend({
    total: z.number().int().nonnegative(),
  }),
});
export const qualityResolutionSchema = z
  .object({
    expectedRevision: revisionSchema,
    resolution: z.literal('DISTINCT'),
    reason: reasonSchema,
  })
  .strict();
export type QualityIssueDto = z.infer<typeof dataQualityIssueSchema>;

export const missingPersonFieldSchema = z.enum([
  'birthDate',
  'sex',
  'cpf',
  'rg',
  'occupation',
  'educationLevel',
  'contactPhone',
]);
export const missingFamilyFieldSchema = z.enum([
  'referenceName',
  'address',
  'neighborhood',
  'postalCode',
  'location',
  'contactPhone',
]);
const personFieldsSchema = z
  .array(missingPersonFieldSchema)
  .refine((values) => new Set(values).size === values.length)
  .transform((values) => values.sort());
const familyFieldsSchema = z
  .array(missingFamilyFieldSchema)
  .refine((values) => new Set(values).size === values.length)
  .transform((values) => values.sort());
export const missingDataSelectionInputSchema = z
  .object({
    expectedVersion: revisionSchema.nullable(),
    personFields: personFieldsSchema,
    familyFields: familyFieldsSchema,
    decisionReference: reasonSchema,
  })
  .strict();
export const missingDataSelectionSchema = z.object({
  id: z.uuid(),
  version: revisionSchema,
  personFields: personFieldsSchema,
  familyFields: familyFieldsSchema,
  decisionReference: reasonSchema,
  recordedAt: z.iso.datetime(),
  recordedBy: z.uuid(),
});
export type MissingDataSelectionInput = z.infer<
  typeof missingDataSelectionInputSchema
>;
export type MissingDataSelectionDto = z.infer<
  typeof missingDataSelectionSchema
>;
