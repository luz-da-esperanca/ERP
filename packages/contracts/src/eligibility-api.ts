import { z } from 'zod';
import {
  civilDateSchema,
  idSchema,
  instantSchema,
  reasonSchema,
} from './common';
import { paginationSchema } from './access-api';
import { fingerprintSchema, sourceVersionSchema } from './attendance-api';

export const eligibilityStatusSchema = z.enum([
  'ELIGIBLE',
  'INELIGIBLE',
  'PENDING',
]);
const evidencePendingReasonSchema = z.enum([
  'NO_OPPORTUNITIES',
  'COVERAGE_INCOMPLETE',
  'MARKINGS_INCOMPLETE',
]);
const familyPendingReasonSchema = z.enum([
  'POLICY_UNDEFINED',
  'REFERENCE_OUTSIDE_PERIOD',
  'MEMBERSHIP_UNRESOLVED',
]);
export const pendingReasonSchema = z.union([
  familyPendingReasonSchema,
  evidencePendingReasonSchema,
]);
const length = (max: number) => z.number().int().positive().max(max);
export const policyPeriodSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ROLLING_DAYS'), length: length(3660) }).strict(),
  z
    .object({ type: z.literal('CALENDAR_MONTHS'), length: length(120) })
    .strict(),
  z
    .object({
      type: z.literal('FIXED_PERIOD'),
      start: civilDateSchema,
      endExclusive: civilDateSchema,
    })
    .strict(),
]);
export const policyMinimumSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('PRESENCE_COUNT'),
      value: z.number().int().positive().max(100000),
    })
    .strict(),
  z
    .object({
      type: z.literal('ATTENDANCE_RATE'),
      basisPoints: z.number().int().min(1).max(10000),
    })
    .strict(),
]);
const activityCombinationSchema = z.enum(['ANY_ACTIVITY', 'COMBINED']);
const membershipScopeSchema = z.enum([
  'CURRENT_ON_REFERENCE',
  'ANY_WITHIN_PERIOD',
]);
const opportunityRuleSchema = z.enum([
  'ENROLLMENT_OR_RECORDED',
  'ALL_COMPLETED_DURING_MEMBERSHIP',
]);
const selections = {
  period: policyPeriodSchema,
  minimum: policyMinimumSchema,
  activityIds: z.array(idSchema).min(1).max(100),
  activityCombination: activityCombinationSchema,
  membershipScope: membershipScopeSchema,
  opportunityRule: opportunityRuleSchema,
};
// A named but unimplemented modality is a business rejection, not a malformed request.
const modality = z.string().trim().min(1).max(50);
export const policyDraftSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    ...selections,
    justificationRule: modality,
    recessRule: modality,
    newParticipantRule: modality,
    toleranceRule: modality,
    incompleteEvidenceRule: modality,
  })
  .strict();
export const policyDefinitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    ...selections,
    justificationRule: z.literal('NOT_SUPPORTED'),
    recessRule: z.literal('RECORDED_SESSIONS_ONLY'),
    newParticipantRule: z.literal('OPPORTUNITY_RULE'),
    toleranceRule: z.literal('NONE'),
    incompleteEvidenceRule: z.literal('THREE_VALUED'),
  })
  .strict();
export const publishPolicySchema = z
  .object({
    definition: policyDraftSchema,
    effectiveFrom: civilDateSchema,
    expectedLatestPolicyId: idSchema.nullable(),
    decisionReference: z.string().trim().min(1).max(2000),
    reason: reasonSchema,
    retroactive: z.boolean(),
  })
  .strict();
export const policyDtoSchema = z
  .object({
    id: idSchema,
    effectiveFrom: civilDateSchema,
    definition: policyDefinitionSchema,
    decisionReference: z.string(),
    reason: z.string(),
    recordedAt: instantSchema,
    recordedBy: idSchema,
  })
  .strict();
export const policyVersionSchema = policyDtoSchema
  .extend({ effectiveUntilExclusive: civilDateSchema.nullable() })
  .strict();
export const policiesQuerySchema = paginationSchema.strict();
export const policiesPageSchema = z
  .object({
    data: z.array(policyVersionSchema),
    pagination: paginationSchema.extend({
      total: z.number().int().nonnegative(),
    }),
  })
  .strict();
export const assessmentCommandSchema = z
  .object({ referenceDate: civilDateSchema })
  .strict();
export const previewQuerySchema = assessmentCommandSchema;
const count = z.number().int().nonnegative();
const basisPoints = z.number().int().min(0).max(10000).nullable();
export const evidenceSchema = z
  .object({
    personId: idSchema,
    membershipIds: z.array(idSchema),
    activityIds: z.array(idSchema),
    periodStart: civilDateSchema,
    periodEndExclusive: civilDateSchema,
    sessionCount: count,
    presenceCount: count,
    absenceCount: count,
    unrecordedCount: count,
    rateLowerBasisPoints: basisPoints,
    rateUpperBasisPoints: basisPoints,
    coverageComplete: z.boolean(),
    status: eligibilityStatusSchema,
    pendingReason: evidencePendingReasonSchema.nullable(),
    sourceVersions: z.array(sourceVersionSchema),
  })
  .strict();
export const explanationSchema = z
  .object({
    rule: z.union([
      familyPendingReasonSchema,
      z.enum([
        'MEMBER_MEETS_MINIMUM',
        'EVIDENCE_INSUFFICIENT',
        'ALL_MEMBERS_BELOW_MINIMUM',
      ]),
    ]),
    period: z
      .object({ from: civilDateSchema, toExclusive: civilDateSchema })
      .strict()
      .nullable(),
    minimum: policyMinimumSchema.nullable(),
    activityIds: z.array(idSchema),
    activityCombination: activityCombinationSchema.nullable(),
    membershipScope: membershipScopeSchema.nullable(),
    opportunityRule: opportunityRuleSchema.nullable(),
    qualifyingPersonIds: z.array(idSchema),
  })
  .strict();
export const eligibilityPreviewSchema = z
  .object({
    familyId: idSchema,
    referenceDate: civilDateSchema,
    evaluatedAt: instantSchema,
    policyId: idSchema.nullable(),
    status: eligibilityStatusSchema,
    pendingReasons: z.array(pendingReasonSchema),
    explanation: explanationSchema,
    evidences: z.array(evidenceSchema),
    sourceFingerprint: fingerprintSchema,
  })
  .strict();
export const assessmentDtoSchema = eligibilityPreviewSchema
  .extend({ id: idSchema, requestedBy: idSchema })
  .strict();
export type PublishPolicyInput = z.input<typeof publishPolicySchema>;
export type PolicyDto = z.infer<typeof policyDtoSchema>;
export type PolicyVersionDto = z.infer<typeof policyVersionSchema>;
export type EligibilityPreviewDto = z.infer<typeof eligibilityPreviewSchema>;
export type AssessmentDto = z.infer<typeof assessmentDtoSchema>;
