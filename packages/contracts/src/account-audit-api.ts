import { z } from 'zod';
import { paginationSchema, userDtoSchema } from './access-api';

export const accountAuditActionSchema = z.enum([
  'CREATE',
  'UPDATE',
  'ACTIVATE',
  'DEACTIVATE',
  'PASSWORD_CHANGE',
  'PASSWORD_RESET',
]);
export const auditQuerySchema = paginationSchema
  .extend({
    entityType: z.literal('UserAccount'),
    entityId: z.uuid().optional(),
    actorId: z.uuid().optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
    action: accountAuditActionSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      !value.from || !value.to || new Date(value.from) < new Date(value.to),
  );

const snapshotSchema = userDtoSchema.extend({
  passwordChanged: z.boolean().optional(),
});
export const accountAuditEntrySchema = z.object({
  id: z.uuid(),
  operationId: z.uuid(),
  entityType: z.literal('UserAccount'),
  entityId: z.uuid(),
  revision: z.number().int().positive(),
  action: accountAuditActionSchema,
  actorType: z.enum(['USER', 'SYSTEM_BOOTSTRAP']),
  actorId: z.uuid().nullable(),
  actor: z
    .object({ id: z.uuid(), displayName: z.string(), active: z.boolean() })
    .nullable(),
  recordedAt: z.iso.datetime(),
  occurredAt: z.iso.datetime().nullable(),
  before: snapshotSchema.nullable(),
  after: snapshotSchema,
  reason: z.string().nullable(),
  classification: z.literal('ACCOUNTS'),
});
export const accountAuditPageSchema = z.object({
  data: z.array(accountAuditEntrySchema),
  pagination: paginationSchema.extend({
    total: z.number().int().nonnegative(),
  }),
});
export type AccountAuditDto = z.infer<typeof accountAuditEntrySchema>;
