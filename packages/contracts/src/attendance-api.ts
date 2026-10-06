import { z } from 'zod';
import {
  idSchema,
  revisionSchema,
  reasonSchema,
  instantSchema,
  civilDateSchema,
} from './common';
import { paginationSchema } from './access-api';

const instant = instantSchema.transform((value) =>
  new Date(value).toISOString(),
);
export const fingerprintSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const attendanceStatusSchema = z.enum(['PRESENT', 'ABSENT']);
export const sessionStatusSchema = z.enum(['COMPLETED', 'CANCELED']);
export const sourceVersionSchema = z
  .object({
    entityType: z.string(),
    entityId: idSchema,
    revision: revisionSchema,
  })
  .strict();
export const sessionDtoSchema = z
  .object({
    id: idSchema,
    activityId: idSchema,
    responsibleId: idSchema,
    occurredAt: instantSchema,
    recordedAt: instantSchema,
    recordedBy: idSchema,
    status: sessionStatusSchema,
    revision: revisionSchema,
  })
  .strict();
export const attendanceDtoSchema = z
  .object({
    id: idSchema,
    sessionId: idSchema,
    personId: idSchema,
    familyId: idSchema,
    membershipId: idSchema,
    membershipRevision: revisionSchema,
    status: attendanceStatusSchema,
    recordedAt: instantSchema,
    recordedBy: idSchema,
    revision: revisionSchema,
    supersededById: idSchema.nullable(),
  })
  .strict();
export const invalidatedPeriodSchema = z
  .object({
    from: civilDateSchema,
    toExclusive: civilDateSchema,
    recordedAt: instantSchema,
    recordedBy: idSchema,
    reason: z.string(),
  })
  .strict();
export const coverageDtoSchema = z
  .object({
    id: idSchema,
    activityId: idSchema,
    periodStart: civilDateSchema,
    periodEndExclusive: civilDateSchema,
    declaredBy: idSchema,
    declaredAt: instantSchema,
    sourceVersions: z.array(sourceVersionSchema),
    revision: revisionSchema,
    invalidatedPeriods: z.array(invalidatedPeriodSchema),
  })
  .strict();
export const markingContextSchema = z
  .object({
    personId: idSchema,
    expectedPersonRevision: revisionSchema,
    familyId: idSchema,
    expectedFamilyRevision: revisionSchema,
    membershipId: idSchema,
    expectedMembershipRevision: revisionSchema,
  })
  .strict();
export const createMarkingSchema = markingContextSchema
  .extend({ status: attendanceStatusSchema })
  .strict();
const uniquePeople = (entries: readonly { personId: string }[]) =>
  new Set(entries.map((row) => row.personId)).size === entries.length;
const guestSelection = z
  .array(idSchema)
  .max(1000)
  .refine((ids) => new Set(ids).size === ids.length)
  .transform((ids) => ids.sort());
export const createSessionSchema = z
  .object({
    occurredAt: instant,
    responsibleId: idSchema,
    expectedActivityRevision: revisionSchema,
    expectedRosterFingerprint: fingerprintSchema,
    guestPersonIds: guestSelection.default([]),
    entries: z
      .array(createMarkingSchema)
      .max(1000)
      .refine(uniquePeople)
      .transform((rows) =>
        rows.sort((a, b) => a.personId.localeCompare(b.personId)),
      ),
  })
  .strict();
const existingMarking = z
  .object({
    personId: idSchema,
    expectedRevision: revisionSchema,
    status: attendanceStatusSchema,
  })
  .strict();
const newMarking = createMarkingSchema
  .extend({ expectedRevision: z.null() })
  .strict();
export const updateAttendanceSchema = z
  .object({
    expectedSessionRevision: revisionSchema,
    expectedRosterFingerprint: fingerprintSchema,
    reason: reasonSchema,
    guestPersonIds: guestSelection.default([]),
    entries: z
      .array(z.union([existingMarking, newMarking]))
      .min(1)
      .max(1000)
      .refine(uniquePeople)
      .transform((rows) =>
        rows.sort((a, b) => a.personId.localeCompare(b.personId)),
      ),
  })
  .strict();
export const contextCorrectionSchema = z
  .object({
    expectedSessionRevision: revisionSchema,
    expectedRevision: revisionSchema,
    ...markingContextSchema.omit({ personId: true }).shape,
    reason: reasonSchema,
  })
  .strict();
export const sessionCorrectionSchema = z
  .object({
    expectedSessionRevision: revisionSchema,
    occurredAt: instant.optional(),
    responsibleId: idSchema.optional(),
    reason: reasonSchema,
    expectedRosterFingerprint: fingerprintSchema.optional(),
    contextCorrections: z
      .array(markingContextSchema.extend({ expectedRevision: revisionSchema }))
      .max(1000)
      .refine(uniquePeople)
      .optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.occurredAt !== undefined || value.responsibleId !== undefined,
  );
export const cancellationSchema = z
  .object({ expectedSessionRevision: revisionSchema, reason: reasonSchema })
  .strict();
const guestIds = z.preprocess(
  (value) =>
    typeof value === 'string'
      ? value.split(',').filter(Boolean)
      : (value ?? []),
  guestSelection,
);
export const attendanceContextQuerySchema = z
  .object({
    occurredAt: instant,
    sessionId: idSchema.optional(),
    guestPersonIds: guestIds,
  })
  .strict();
export const periodQuerySchema = z
  .object({ periodStart: civilDateSchema, periodEndExclusive: civilDateSchema })
  .strict()
  .refine((value) => value.periodStart < value.periodEndExclusive);
export const coverageDeclarationSchema = z
  .object({
    periodStart: civilDateSchema,
    periodEndExclusive: civilDateSchema,
    expectedActivityRevision: revisionSchema,
    expectedSourceFingerprint: fingerprintSchema,
    confirmed: z.literal(true),
    reason: reasonSchema,
  })
  .strict()
  .refine((value) => value.periodStart < value.periodEndExclusive);
export const frequencyQuerySchema = z
  .object({
    activityId: idSchema,
    from: instant,
    toExclusive: instant,
    familyId: idSchema.optional(),
  })
  .strict()
  .refine((value) => value.from < value.toExclusive);
export const sessionsQuerySchema = paginationSchema
  .extend({
    from: instant.optional(),
    toExclusive: instant.optional(),
    status: sessionStatusSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      !value.from || !value.toExclusive || value.from < value.toExclusive,
  );
export const rosterRowSchema = z
  .object({
    personId: idSchema,
    name: z.string(),
    expectedPersonRevision: revisionSchema,
    familyId: idSchema.nullable(),
    familyCode: z.string().nullable(),
    expectedFamilyRevision: revisionSchema.nullable(),
    membershipId: idSchema.nullable(),
    expectedMembershipRevision: revisionSchema.nullable(),
    enrollmentIds: z.array(idSchema),
    attendance: attendanceDtoSchema.nullable(),
  })
  .strict();
export const attendanceContextSchema = z
  .object({
    activityId: idSchema,
    projectId: idSchema,
    occurredAt: instantSchema,
    expectedActivityRevision: revisionSchema,
    expectedProjectRevision: revisionSchema,
    session: sessionDtoSchema.nullable(),
    rows: z.array(rosterRowSchema),
    rosterFingerprint: fingerprintSchema,
  })
  .strict();
export const sessionResultSchema = z
  .object({
    session: sessionDtoSchema,
    attendances: z.array(attendanceDtoSchema),
  })
  .strict();
export const sessionDetailSchema = sessionResultSchema
  .extend({ context: attendanceContextSchema })
  .strict();
export const sessionsPageSchema = z
  .object({
    data: z.array(sessionDtoSchema),
    pagination: paginationSchema.extend({
      total: z.number().int().nonnegative(),
    }),
  })
  .strict();
export const coverageViewSchema = z
  .object({
    activityId: idSchema,
    periodStart: civilDateSchema,
    periodEndExclusive: civilDateSchema,
    expectedActivityRevision: revisionSchema,
    sourceFingerprint: fingerprintSchema,
    sourceVersions: z.array(sourceVersionSchema),
    declarations: z.array(coverageDtoSchema),
    confirmedPeriods: z.array(
      z
        .object({ from: civilDateSchema, toExclusive: civilDateSchema })
        .strict(),
    ),
    gaps: z.array(
      z
        .object({ from: civilDateSchema, toExclusive: civilDateSchema })
        .strict(),
    ),
    isComplete: z.boolean(),
  })
  .strict();
export const opportunitySchema = z
  .object({
    personId: idSchema,
    sessionId: idSchema,
    occurredAt: instantSchema,
    familyId: idSchema.nullable(),
    membershipId: idSchema.nullable(),
    membershipRevision: revisionSchema.nullable(),
    relevance: z.enum(['ENROLLMENT', 'RECORDED', 'BOTH']),
    attendance: attendanceDtoSchema.nullable(),
    sessionRevision: revisionSchema,
    enrollmentRevisions: z.array(sourceVersionSchema),
    contextResolved: z.boolean(),
  })
  .strict();
export const frequencyResultSchema = z
  .object({
    personId: idSchema,
    activityId: idSchema,
    from: instantSchema,
    toExclusive: instantSchema,
    familyId: idSchema.nullable(),
    denominator: z.literal('ENROLLMENT_OR_RECORDED'),
    sessionCount: z.number().int().nonnegative(),
    presenceCount: z.number().int().nonnegative(),
    absenceCount: z.number().int().nonnegative(),
    unrecordedCount: z.number().int().nonnegative(),
    attendanceRate: z.number().min(0).max(100).nullable(),
    markingsComplete: z.boolean(),
    coverageComplete: z.boolean(),
    contextComplete: z.boolean(),
    isComplete: z.boolean(),
    opportunities: z.array(opportunitySchema),
    unresolvedOpportunities: z.array(opportunitySchema),
    coverageRevisions: z.array(sourceVersionSchema),
  })
  .strict();
export type CreateSessionInput = z.input<typeof createSessionSchema>;
export type UpdateAttendanceInput = z.input<typeof updateAttendanceSchema>;
export type SessionCorrectionInput = z.input<typeof sessionCorrectionSchema>;
export type ContextCorrectionInput = z.input<typeof contextCorrectionSchema>;
export type CoverageDeclarationInput = z.input<
  typeof coverageDeclarationSchema
>;
export type SessionDto = z.infer<typeof sessionDtoSchema>;
export type AttendanceDto = z.infer<typeof attendanceDtoSchema>;
export type CoverageDto = z.infer<typeof coverageDtoSchema>;
export type AttendanceContextDto = z.infer<typeof attendanceContextSchema>;
export type FrequencyResultDto = z.infer<typeof frequencyResultSchema>;
export type CoverageViewDto = z.infer<typeof coverageViewSchema>;
