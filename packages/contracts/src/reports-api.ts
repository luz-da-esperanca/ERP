import { z } from 'zod';
import {
  civilDateSchema,
  idSchema,
  instantSchema,
  revisionSchema,
} from './common';
import { paginationSchema } from './access-api';
import {
  attendanceStatusSchema,
  fingerprintSchema,
  sessionStatusSchema,
} from './attendance-api';
import { dataQualityIssueSchema } from './data-quality-api';
import {
  eligibilityStatusSchema,
  evidenceSchema,
  explanationSchema,
  pendingReasonSchema,
} from './eligibility-api';

const period = { from: civilDateSchema, toExclusive: civilDateSchema };
const ordered = (value: { from?: string; toExclusive?: string }) =>
  !value.from || !value.toExclusive || value.from < value.toExclusive;
const detail = {
  ...paginationSchema.shape,
  expectedQueryFingerprint: fingerprintSchema,
};
const scope = {
  instituteId: idSchema.optional(),
  projectId: idSchema.optional(),
  activityId: idSchema.optional(),
};
const reachUnitSchema = z.enum(['PERSON', 'FAMILY', 'SESSION', 'PRESENCE']);
const frequencyUnitSchema = z.enum(['OPPORTUNITY', 'SESSION']);
const dateBasisSchema = z.enum(['IDENTIFICATION', 'RESOLUTION']);
const qualityKindSchema = z.enum(['MISSING_DATA', 'POSSIBLE_DUPLICATE']);
const qualityStatusSchema = z.enum(['OPEN', 'RESOLVED']);
export const historyEventTypeSchema = z.enum([
  'MEMBERSHIP_STARTED',
  'MEMBERSHIP_ENDED',
  'ENROLLMENT_STARTED',
  'ENROLLMENT_ENDED',
  'ATTENDANCE',
  'SOCIAL_FORM',
  'ELIGIBILITY_ASSESSMENT',
]);

export const reachReportQuerySchema = z
  .object({ ...period, ...scope })
  .strict()
  .refine(ordered);
export const reachRecordsQuerySchema = z
  .object({ ...period, ...scope, unit: reachUnitSchema, ...detail })
  .strict()
  .refine(ordered);
const frequencyFilters = {
  ...period,
  activityId: idSchema,
  personId: idSchema.optional(),
  familyId: idSchema.optional(),
};
export const frequencyReportQuerySchema = z
  .object(frequencyFilters)
  .strict()
  .refine(ordered);
export const frequencyRecordsQuerySchema = z
  .object({ ...frequencyFilters, unit: frequencyUnitSchema, ...detail })
  .strict()
  .refine(ordered);
const eligibilityFilters = {
  referenceDate: civilDateSchema,
  familyId: idSchema.optional(),
};
export const eligibilityReportQuerySchema = paginationSchema
  .extend({ ...eligibilityFilters, status: eligibilityStatusSchema.optional() })
  .strict();
export const eligibilityRecordsQuerySchema = z
  .object({ ...eligibilityFilters, status: eligibilityStatusSchema, ...detail })
  .strict();
const qualityFilters = {
  ...period,
  // The response repeats the basis, so a total always says which date selected it.
  dateBasis: dateBasisSchema.default('IDENTIFICATION'),
  kind: qualityKindSchema.optional(),
  status: qualityStatusSchema.optional(),
};
export const qualityReportQuerySchema = paginationSchema
  .extend(qualityFilters)
  .strict()
  .refine(ordered);
export const qualityRecordsQuerySchema = z
  .object({ ...qualityFilters, ...detail })
  .strict()
  .refine(ordered);
export const historyQuerySchema = paginationSchema
  .extend({
    from: civilDateSchema.optional(),
    toExclusive: civilDateSchema.optional(),
    eventTypes: z
      .preprocess(
        (value) =>
          typeof value === 'string' ? value.split(',').filter(Boolean) : value,
        z.array(historyEventTypeSchema).min(1),
      )
      .transform((types) => [...new Set(types)].sort())
      .optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict()
  .refine(ordered);

const count = z.number().int().nonnegative();
const page = paginationSchema.extend({ total: count });
const nullableId = idSchema.nullable();
const civilPeriod = z.object(period).strict();
const reachCounts = {
  people: count,
  families: count,
  sessions: count,
  presences: count,
};
const reachFilters = z
  .object({
    ...period,
    instituteId: nullableId,
    projectId: nullableId,
    activityId: nullableId,
  })
  .strict();
export const reachReportSchema = z
  .object({
    generatedAt: instantSchema,
    filters: reachFilters,
    units: z.array(reachUnitSchema),
    method: z.literal('PRESENT_MARKINGS_IN_COMPLETED_SESSIONS'),
    queryFingerprint: fingerprintSchema,
    totals: z.object(reachCounts).strict(),
    groups: z.array(
      z.object({ activityId: idSchema, ...reachCounts }).strict(),
    ),
  })
  .strict();
const reachSession = {
  id: idSchema,
  activityId: idSchema,
  occurredAt: instantSchema,
  revision: revisionSchema,
};
export const reachRecordSchema = z.union([
  z
    .object({ personId: idSchema, personName: z.string(), presences: count })
    .strict(),
  z
    .object({
      familyId: idSchema,
      familyCode: z.string(),
      people: count,
      presences: count,
    })
    .strict(),
  z.object({ ...reachSession, presences: count }).strict(),
  z
    .object({
      ...reachSession,
      sessionId: idSchema,
      personId: idSchema,
      personName: z.string(),
      familyId: idSchema,
      familyCode: z.string(),
    })
    .strict(),
]);
const records = <F extends z.ZodType, U extends z.ZodType, R extends z.ZodType>(
  filters: F,
  unit: U,
  row: R,
) =>
  z
    .object({
      report: z
        .object({
          generatedAt: instantSchema,
          filters,
          unit,
          queryFingerprint: fingerprintSchema,
        })
        .strict(),
      data: z.array(row),
      pagination: page,
    })
    .strict();
export const reachRecordsSchema = records(
  reachFilters,
  reachUnitSchema,
  reachRecordSchema,
);
const frequencyFilterValues = z
  .object({
    ...period,
    activityId: idSchema,
    personId: nullableId,
    familyId: nullableId,
  })
  .strict();
export const frequencyReportSchema = z
  .object({
    generatedAt: instantSchema,
    filters: frequencyFilterValues,
    units: z.array(frequencyUnitSchema),
    denominator: z.literal('ENROLLMENT_OR_RECORDED'),
    queryFingerprint: fingerprintSchema,
    totals: z
      .object({
        participants: count,
        sessionCount: count,
        presenceCount: count,
        absenceCount: count,
        unrecordedCount: count,
        attendanceRate: z.number().min(0).max(100).nullable(),
        markingsComplete: z.boolean(),
        contextComplete: z.boolean(),
        coverageComplete: z.boolean(),
        isComplete: z.boolean(),
        completedSessions: count,
        canceledSessions: count,
      })
      .strict(),
    coverage: z
      .object({
        confirmedPeriods: z.array(civilPeriod),
        gaps: z.array(civilPeriod),
      })
      .strict(),
  })
  .strict();
export const frequencyRecordSchema = z.union([
  z
    .object({
      personId: idSchema,
      personName: z.string(),
      sessionId: idSchema,
      occurredAt: instantSchema,
      familyId: nullableId,
      status: attendanceStatusSchema.nullable(),
      attendanceId: nullableId,
      relevance: z.enum(['ENROLLMENT', 'RECORDED', 'BOTH']),
      contextResolved: z.boolean(),
    })
    .strict(),
  z
    .object({
      id: idSchema,
      occurredAt: instantSchema,
      status: sessionStatusSchema,
      revision: revisionSchema,
    })
    .strict(),
]);
export const frequencyRecordsSchema = records(
  frequencyFilterValues,
  frequencyUnitSchema,
  frequencyRecordSchema,
);
const eligibilityRow = z
  .object({
    family: z.object({ id: idSchema, code: z.string() }).strict(),
    status: eligibilityStatusSchema,
    pendingReasons: z.array(pendingReasonSchema),
    policyId: nullableId,
    explanation: explanationSchema,
    evidences: z.array(evidenceSchema),
  })
  .strict();
const eligibilityFilterValues = z
  .object({
    referenceDate: civilDateSchema,
    familyId: nullableId,
    status: eligibilityStatusSchema.nullable(),
  })
  .strict();
export const eligibilityReportSchema = z
  .object({
    generatedAt: instantSchema,
    filters: eligibilityFilterValues,
    unit: z.literal('FAMILY'),
    method: z.literal('CALCULATED_ON_REQUEST'),
    policyId: nullableId,
    queryFingerprint: fingerprintSchema,
    totals: z
      .object({
        total: count,
        ELIGIBLE: count,
        INELIGIBLE: count,
        PENDING: count,
      })
      .strict(),
    data: z.array(eligibilityRow),
    pagination: page,
  })
  .strict();
export const eligibilityRecordsSchema = records(
  eligibilityFilterValues,
  z.literal('FAMILY'),
  eligibilityRow,
);
const qualityFilterValues = z
  .object({
    ...period,
    dateBasis: dateBasisSchema,
    kind: qualityKindSchema.nullable(),
    status: qualityStatusSchema.nullable(),
  })
  .strict();
export const qualityReportSchema = z
  .object({
    generatedAt: instantSchema,
    filters: qualityFilterValues,
    unit: z.literal('ISSUE'),
    queryFingerprint: fingerprintSchema,
    totals: z
      .object({
        total: count,
        open: count,
        resolved: count,
        byKind: z
          .object({ POSSIBLE_DUPLICATE: count, MISSING_DATA: count })
          .strict(),
        byResolution: z.object({ DISTINCT: count, MERGED: count }).strict(),
      })
      .strict(),
    data: z.array(dataQualityIssueSchema),
    pagination: page,
  })
  .strict();
export const qualityRecordsSchema = records(
  qualityFilterValues,
  z.literal('ISSUE'),
  dataQualityIssueSchema,
);
export const historyEventSchema = z
  .object({
    type: historyEventTypeSchema,
    occurredAt: instantSchema,
    referenceDate: civilDateSchema.nullable(),
    recordedAt: instantSchema.nullable(),
    sourceType: z.string(),
    sourceId: idSchema,
    familyId: nullableId,
    personId: nullableId,
    activityId: nullableId,
    valid: z.boolean(),
    invalidReason: z.enum(['SESSION_CANCELED', 'SUPERSEDED']).nullable(),
    details: z.record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
    ),
  })
  .strict();
export const historySchema = z
  .object({
    report: z
      .object({
        generatedAt: instantSchema,
        order: z.enum(['asc', 'desc']),
        eventTypes: z.array(historyEventTypeSchema),
        from: civilDateSchema.nullable(),
        toExclusive: civilDateSchema.nullable(),
        familyId: idSchema.optional(),
        personId: idSchema.optional(),
      })
      .strict(),
    data: z.array(historyEventSchema),
    pagination: page,
  })
  .strict();
export type ReachReportDto = z.infer<typeof reachReportSchema>;
export type FrequencyReportDto = z.infer<typeof frequencyReportSchema>;
export type EligibilityReportDto = z.infer<typeof eligibilityReportSchema>;
export type QualityReportDto = z.infer<typeof qualityReportSchema>;
export type HistoryDto = z.infer<typeof historySchema>;
export type HistoryEventDto = z.infer<typeof historyEventSchema>;
