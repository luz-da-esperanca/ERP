import { z } from 'zod';
import {
  idSchema,
  revisionSchema,
  reasonSchema,
  instantSchema,
} from './common';
import {
  sourceVersionSchema,
  attendanceDtoSchema,
  sessionDtoSchema,
  fingerprintSchema,
} from './attendance-api';
import {
  membershipDtoSchema,
  familyDtoSchema,
  personDtoSchema,
} from './registration-api';
const instant = instantSchema.transform((value) =>
  new Date(value).toISOString(),
);
const fields = {
  validFrom: instant,
  validUntil: instant.nullable(),
  isReference: z.boolean(),
  relationshipToReference: z.string().trim().max(100).nullable(),
};
const memberChange = z.union([
  z
    .object({
      membershipId: idSchema,
      expectedRevision: revisionSchema,
      ...fields,
    })
    .strict(),
  z
    .object({
      clientRef: z.string().trim().min(1).max(100),
      familyId: idSchema,
      ...fields,
    })
    .strict(),
]);
const contextChange = z
  .object({
    attendanceId: idSchema,
    expectedRevision: revisionSchema,
    sessionId: idSchema,
    expectedSessionRevision: revisionSchema,
    membership: z.union([
      z.object({ id: idSchema }).strict(),
      z.object({ clientRef: z.string().trim().min(1).max(100) }).strict(),
    ]),
    reason: reasonSchema,
  })
  .strict();
export const reconciliationPlanSchema = z
  .object({
    intent: z.enum(['TRANSFER', 'CORRECTION']),
    expectedPersonRevision: revisionSchema,
    familyRevisions: z
      .array(
        z
          .object({ familyId: idSchema, expectedRevision: revisionSchema })
          .strict(),
      )
      .min(1)
      .max(1000)
      .refine(
        (rows) => new Set(rows.map((row) => row.familyId)).size === rows.length,
      ),
    membershipChanges: z
      .array(memberChange)
      .min(1)
      .max(1000)
      .refine(
        (rows) =>
          new Set(
            rows.map((row) =>
              'membershipId' in row
                ? `old:${row.membershipId}`
                : `new:${row.clientRef}`,
            ),
          ).size === rows.length,
      ),
    attendanceContextChanges: z
      .array(contextChange)
      .max(1000)
      .refine(
        (rows) =>
          new Set(rows.map((row) => row.attendanceId)).size === rows.length,
      ),
    reason: reasonSchema,
  })
  .strict();
export const reconciliationCommandSchema = reconciliationPlanSchema
  .extend({ expectedSourceFingerprint: fingerprintSchema })
  .strict();
export const reconciliationPreviewSchema = z
  .object({
    sourceFingerprint: fingerprintSchema,
    sourceVersions: z.array(sourceVersionSchema),
    conflicts: z.array(idSchema),
    affectedAttendanceIds: z.array(idSchema),
    proposedMemberships: z.array(
      membershipDtoSchema.extend({ id: z.string() }),
    ),
  })
  .strict();
export const reconciliationResultSchema = z
  .object({
    person: personDtoSchema,
    memberships: z.array(membershipDtoSchema),
    families: z.array(familyDtoSchema),
    sessions: z.array(sessionDtoSchema),
    attendances: z.array(attendanceDtoSchema),
    createdMemberships: z.array(
      z.object({ clientRef: z.string(), membershipId: idSchema }).strict(),
    ),
  })
  .strict();
export type ReconciliationPlanInput = z.input<typeof reconciliationPlanSchema>;
export type ReconciliationCommandInput = z.input<
  typeof reconciliationCommandSchema
>;
export type ReconciliationPreviewDto = z.infer<
  typeof reconciliationPreviewSchema
>;
export type ReconciliationResultDto = z.infer<
  typeof reconciliationResultSchema
>;
