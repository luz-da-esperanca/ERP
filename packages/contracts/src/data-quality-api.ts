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
  resolution: z.enum(['DISTINCT', 'MERGED']).nullable(),
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
