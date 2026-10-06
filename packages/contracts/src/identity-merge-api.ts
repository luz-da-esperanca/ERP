import { z } from 'zod';
import {
  idSchema,
  instantSchema,
  reasonSchema,
  revisionSchema,
} from './common';
import { attendanceDtoSchema, fingerprintSchema } from './attendance-api';
import { enrollmentDtoSchema } from './projects-api';
import {
  familyDtoSchema,
  membershipDtoSchema,
  personDtoSchema,
  sizeProfileSchema,
} from './registration-api';

const instant = instantSchema.transform((value) =>
  new Date(value).toISOString(),
);
const entityTypeSchema = z.enum(['PERSON', 'FAMILY']);
const choiceSchema = z.enum(['SOURCE', 'TARGET']);
const identities = {
  entityType: entityTypeSchema,
  sourceId: idSchema,
  targetId: idSchema,
};
export const mergeIdentitiesSchema = z.object(identities).strict();
export const intervalResolutionSchema = z.discriminatedUnion('action', [
  z
    .object({
      id: idSchema,
      action: z.literal('KEEP'),
      validFrom: instant,
      validUntil: instant.nullable(),
    })
    .strict(),
  z
    .object({
      id: idSchema,
      action: z.literal('SUPERSEDE'),
      supersededById: idSchema,
    })
    .strict()
    .refine((value) => value.id !== value.supersededById),
]);
const resolutions = z.array(intervalResolutionSchema).max(1000).default([]);
export const mergeCommandSchema = z
  .object({
    ...identities,
    expectedSourceRevision: revisionSchema,
    expectedTargetRevision: revisionSchema,
    expectedSourceFingerprint: fingerprintSchema,
    // Every divergent field needs an explicit choice; nothing is selected by default.
    fieldSelections: z.record(z.string().max(100), choiceSchema),
    membershipResolutions: resolutions,
    enrollmentResolutions: resolutions,
    attendanceResolutions: z
      .array(
        z
          .object({
            sessionId: idSchema,
            effectiveAttendanceId: idSchema,
            reason: reasonSchema.optional(),
          })
          .strict(),
      )
      .max(1000)
      .default([]),
    sizeProfileResolution: z
      .object({ keep: choiceSchema })
      .strict()
      .nullable()
      .default(null),
    reason: reasonSchema,
  })
  .strict();
const intervalConflictSchema = z
  .object({ ids: z.tuple([idSchema, idSchema]), sameGroup: z.boolean() })
  .strict();
const sizes = sizeProfileSchema.strict();
export const mergePreviewSchema = z
  .object({
    ...identities,
    expectedSourceRevision: revisionSchema,
    expectedTargetRevision: revisionSchema,
    sourceFingerprint: fingerprintSchema,
    fieldConflicts: z.array(
      z
        .object({ field: z.string(), source: z.string(), target: z.string() })
        .strict(),
    ),
    adoptedFields: z.array(z.string()),
    membershipConflicts: z.array(intervalConflictSchema),
    referenceConflicts: z.array(
      z.object({ membershipIds: z.array(idSchema) }).strict(),
    ),
    enrollmentConflicts: z.array(intervalConflictSchema),
    attendanceConflicts: z.array(
      z
        .object({
          sessionId: idSchema,
          attendanceIds: z.tuple([idSchema, idSchema]),
          statusesDiffer: z.boolean(),
        })
        .strict(),
    ),
    sizeProfileConflict: z
      .object({ source: sizes, target: sizes })
      .strict()
      .nullable(),
    memberships: z.array(membershipDtoSchema.strict()),
    enrollments: z.array(enrollmentDtoSchema),
    attendances: z.array(attendanceDtoSchema),
    issueIds: z.array(idSchema),
    preserved: z
      .object({
        socialForms: z.number().int().nonnegative(),
        eligibilityAssessments: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();
const superseded = z.array(
  z.object({ id: idSchema, supersededById: idSchema }).strict(),
);
export const identityMergeDtoSchema = z
  .object({
    id: idSchema,
    ...identities,
    recordedAt: instantSchema,
    recordedBy: idSchema,
    reason: z.string(),
    operationId: idSchema,
    resolution: z
      .object({
        fieldSelections: z.record(z.string(), choiceSchema),
        adoptedFields: z.array(z.string()),
        supersededMemberships: superseded,
        supersededEnrollments: superseded,
        supersededAttendances: superseded,
        sizeProfile: choiceSchema.nullable(),
        resolvedIssueIds: z.array(idSchema),
      })
      .strict(),
  })
  .strict();
export const mergeResultSchema = z
  .object({
    merge: identityMergeDtoSchema,
    target: z.union([personDtoSchema.strict(), familyDtoSchema.strict()]),
  })
  .strict();
export type MergeIdentitiesInput = z.input<typeof mergeIdentitiesSchema>;
export type MergeCommandInput = z.input<typeof mergeCommandSchema>;
export type MergePreviewDto = z.infer<typeof mergePreviewSchema>;
export type IdentityMergeDto = z.infer<typeof identityMergeDtoSchema>;
export type MergeResultDto = z.infer<typeof mergeResultSchema>;
