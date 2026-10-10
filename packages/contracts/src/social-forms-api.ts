import { z } from 'zod';
import { nullableCpfSchema } from './cpf-schema';
import {
  idSchema,
  instantSchema,
  revisionSchema,
  civilDateSchema,
  reasonSchema,
} from './common';
import { socialFieldKeys, featureDecisionCodes } from './social-form-fields';
import { paginationSchema } from './access-api';
import { roleSchema as roleCodeSchema } from './access';
import {
  familyDtoSchema,
  membershipDtoSchema,
  sizeProfileSchema,
} from './registration-api';

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .optional();
const count = z.number().int().nonnegative().nullable().optional();
const boolean = z.boolean().nullable().optional();
const choice = z
  .object({
    code: z.string().regex(/^[A-Z][A-Z0-9_]{0,99}$/),
    label: z.string().max(200).optional(),
    otherText: text(1000),
  })
  .strict();
const choices = z.array(choice).nullable().optional();
export const socialBlocksSchema = z
  .object({
    housing: z
      .object({
        housingTenure: choices,
        location: choices,
        roomCount: count,
        bedroomCount: count,
        riskArea: boolean,
        dwellingType: choices,
        construction: choices,
        floorType: choices,
        electricity: choices,
        waterSupply: choices,
        waterTreatment: choices,
        sewage: choices,
        wasteDisposal: choices,
        transportation: choices,
        hygiene: choices,
      })
      .strict()
      .optional(),
    economy: z
      .object({
        declaredWorkerCount: count,
        declaredPensionerCount: count,
        declaredChildCount: count,
        declaredAdolescentCount: count,
        receivesGovernmentBenefit: boolean,
        governmentBenefitName: text(200),
      })
      .strict()
      .optional(),
    needs: z
      .object({
        hasNeeds: boolean,
        declaredNeeds: choices,
        otherNeed: text(1000),
      })
      .strict()
      .optional(),
    situation: z
      .object({
        text: text(4000),
        hasObservations: boolean,
        observations: z
          .array(
            z
              .object({
                occurredOn: civilDateSchema,
                description: z.string().trim().min(1).max(2000),
              })
              .strict(),
          )
          .max(100)
          .nullable()
          .optional(),
        beneficiarySigned: boolean,
        registrationResponsibleName: text(200),
        registrationResponsibleSigned: boolean,
      })
      .strict()
      .optional(),
  })
  .strict();
export const socialMemberBlocksSchema = z
  .object({
    economy: z
      .object({
        worksCurrently: boolean,
        occupationOrIncomeSource: text(200),
        incomeAmount: z
          .string()
          .regex(/^\d{1,12}(\.\d{1,2})?$/)
          .nullable()
          .optional(),
      })
      .strict()
      .optional(),
    education: z
      .object({
        attendsSchool: boolean,
        schoolLevelOrGrade: text(100),
        studyMode: text(100),
      })
      .strict()
      .optional(),
    health: z
      .object({
        spiritualHealth: z
          .enum(['EQUILIBRATED', 'INFLUENCED', 'OTHER'])
          .nullable()
          .optional(),
        otherSpiritualHealth: text(1000),
        physicalHealth: z
          .enum(['GOOD', 'REGULAR', 'POOR'])
          .nullable()
          .optional(),
        physicalHealthProblems: text(1000),
        hasPhysicalHealthProblems: boolean,
        generalCondition: text(1000),
        healthUnit: text(200),
        hasHealthUnit: boolean,
        communityHealthAgent: text(200),
        hasCommunityHealthAgent: boolean,
      })
      .strict()
      .optional(),
    medications: z
      .array(
        z
          .object({
            medicationName: z.string().trim().min(1).max(200),
            providedByGovernment: boolean,
          })
          .strict(),
      )
      .nullable()
      .optional(),
    religion: z
      .object({ participatesInEvangelization: boolean })
      .strict()
      .optional(),
  })
  .strict();
export const acknowledgementInputSchema = z
  .object({
    referencePersonId: idSchema,
    method: z.literal('PAPER_SIGNATURE'),
    acknowledgedOn: civilDateSchema,
  })
  .strict();
export const publishSocialFormSchema = z
  .object({
    occurredAt: instantSchema,
    expectedFamilyRevision: revisionSchema,
    expectedPreviousVersionId: idSchema.nullable(),
    fieldSelectionVersionId: idSchema,
    memberRevisions: z.array(
      z
        .object({
          personId: idSchema,
          expectedPersonRevision: revisionSchema,
          membershipId: idSchema,
          expectedMembershipRevision: revisionSchema,
          sizeProfilePersonId: idSchema.nullable().optional(),
          expectedSizeRevision: revisionSchema.nullable().optional(),
        })
        .strict()
        .refine(
          (value) =>
            (value.sizeProfilePersonId === undefined) ===
            (value.expectedSizeRevision === undefined),
          {
            message:
              'Size profile identity and revision must be supplied together',
          },
        ),
    ),
    referencePersonId: idSchema.nullable().optional(),
    blocks: socialBlocksSchema,
    members: z.array(
      socialMemberBlocksSchema
        .extend({
          personId: idSchema,
          selectedFieldKeys: z.array(z.enum(socialFieldKeys)).optional(),
        })
        .strict(),
    ),
    acknowledgement: acknowledgementInputSchema.optional(),
    correctionOfFormId: idSchema.optional(),
    reason: reasonSchema.optional(),
  })
  .strict()
  .refine((value) => !value.correctionOfFormId || !!value.reason, {
    path: ['reason'],
    message: 'A correction requires a reason',
  })
  .refine(
    (value) =>
      new Set(value.memberRevisions.map((member) => member.personId)).size ===
        value.memberRevisions.length &&
      new Set(value.members.map((member) => member.personId)).size ===
        value.members.length,
    { message: 'Member identities must be unique' },
  );
export type PublishSocialFormInput = z.infer<typeof publishSocialFormSchema>;
export const fieldDefinitionSchema = z
  .object({
    fieldKey: z.enum(socialFieldKeys),
    included: z.boolean(),
    required: z.boolean(),
    appliesTo: z.enum([
      'FAMILY',
      'ALL_MEMBERS',
      'REFERENCE_MEMBER',
      'SELECTED_MEMBERS',
    ]),
    allowedRoleCodes: z.array(roleCodeSchema).min(1),
    cardinality: z.enum(['SINGLE', 'MULTIPLE']),
    purpose: z.string().trim().min(1).max(1000),
    decisionReference: z.string().trim().max(2000),
  })
  .strict();
export const fieldSelectionInputSchema = z
  .object({
    expectedRevision: revisionSchema.nullable(),
    decisionReference: z.string().trim().min(1).max(2000),
    reason: reasonSchema,
    fields: z.array(fieldDefinitionSchema),
  })
  .strict();
export const acknowledgementCommandSchema = acknowledgementInputSchema
  .extend({
    expectedRevision: revisionSchema.nullable(),
    reason: reasonSchema.optional(),
  })
  .strict();
export const socialFormListQuerySchema = paginationSchema
  .extend({
    orderBy: z.enum(['recordedAt', 'occurredAt']).default('recordedAt'),
  })
  .strict();
export const socialFormContextQuerySchema = z
  .object({ occurredAt: instantSchema })
  .strict();
export const createSocialOptionSchema = z
  .object({
    fieldKey: z.enum(socialFieldKeys),
    code: z.string().regex(/^[A-Z][A-Z0-9_]{0,99}$/),
    label: z.string().trim().min(1).max(200),
    active: z.boolean().default(true),
    isOther: z.boolean().default(false),
    decisionReference: z.string().trim().min(1).max(2000),
  })
  .strict();
export const updateSocialOptionSchema = z
  .object({
    expectedRevision: revisionSchema,
    label: z.string().trim().min(1).max(200).optional(),
    active: z.boolean().optional(),
    decisionReference: z.string().trim().min(1).max(2000),
    reason: reasonSchema,
  })
  .strict()
  .refine((value) => value.label !== undefined || value.active !== undefined)
  .refine(
    (value) => value.reason.length + value.decisionReference.length + 3 <= 2000,
    {
      path: ['decisionReference'],
      message: 'Combined audit reason must not exceed 2000 characters',
    },
  );
export const featureDecisionInputSchema = z
  .object({
    enabled: z.boolean(),
    expectedRevision: revisionSchema.nullable(),
    decisionReference: z.string().trim().min(1).max(2000),
    reason: reasonSchema,
  })
  .strict();
export const featureDecisionCodeSchema = z.enum(featureDecisionCodes);
export const fieldSelectionDtoSchema = z
  .object({
    id: idSchema,
    version: revisionSchema,
    recordedAt: instantSchema,
    recordedBy: idSchema,
    decisionReference: z.string(),
    fields: z.array(fieldDefinitionSchema),
  })
  .strict();
export const socialOptionDtoSchema = createSocialOptionSchema
  .omit({ decisionReference: true })
  .extend({ id: idSchema, revision: revisionSchema })
  .strict();
export const featureDecisionDtoSchema = z
  .object({
    id: idSchema,
    code: featureDecisionCodeSchema,
    enabled: z.boolean(),
    decisionReference: z.string(),
    decidedAt: instantSchema,
    decidedBy: idSchema,
    revision: revisionSchema,
  })
  .strict();
export const socialPersonSnapshotSchema = z
  .object({
    id: idSchema,
    name: z.string(),
    birthDate: civilDateSchema.nullable(),
    sex: z.string().nullable(),
    cpf: nullableCpfSchema.optional(),
    rg: z.string().nullable().optional(),
    occupation: z.string().nullable().optional(),
    educationLevel: z.string().nullable().optional(),
    contactPhone: z.string().nullable().optional(),
    revision: revisionSchema,
  })
  .strict();
export const socialFormMemberDtoSchema = z
  .object({
    id: idSchema,
    socialFormId: idSchema,
    personId: idSchema,
    membershipId: idSchema,
    membershipRevision: revisionSchema,
    personSnapshot: socialPersonSnapshotSchema,
    relationshipSnapshot: z
      .object({
        isReference: z.boolean(),
        relationshipToReference: z.string().nullable(),
      })
      .strict(),
    sizeProfilePersonId: idSchema.nullable(),
    sizeRevision: revisionSchema.nullable(),
    sizeSnapshot: sizeProfileSchema.nullable(),
    selectedFieldKeys: z.array(z.enum(socialFieldKeys)),
    blocks: socialMemberBlocksSchema,
  })
  .strict();
export const acknowledgementDtoSchema = acknowledgementInputSchema
  .extend({
    id: idSchema,
    socialFormId: idSchema,
    recordedAt: instantSchema,
    recordedBy: idSchema,
    revision: revisionSchema,
  })
  .strict();
export const socialFormSummarySchema = z
  .object({
    id: idSchema,
    familyId: idSchema,
    version: revisionSchema,
    previousVersionId: idSchema.nullable(),
    correctionOfFormId: idSchema.nullable(),
    occurredAt: instantSchema,
    recordedAt: instantSchema,
    recordedBy: idSchema,
    fieldSelectionVersionId: idSchema,
    originFamilyId: idSchema.nullable(),
    originalVersion: revisionSchema.nullable(),
  })
  .strict();
export const socialFormDtoSchema = socialFormSummarySchema
  .extend({
    referenceMemberId: idSchema.nullable(),
    familySnapshot: familyDtoSchema,
    reason: z.string().nullable(),
    blocks: socialBlocksSchema,
    members: z.array(socialFormMemberDtoSchema),
    acknowledgement: acknowledgementDtoSchema.nullable(),
  })
  .strict();
export const socialFormPageSchema = z.object({
  data: z.array(socialFormSummarySchema),
  pagination: paginationSchema.extend({
    total: z.number().int().nonnegative(),
  }),
});
export const socialFormFieldsSchema = z
  .object({
    selection: fieldSelectionDtoSchema.nullable(),
    options: z.array(socialOptionDtoSchema),
    decisions: z.array(featureDecisionDtoSchema),
  })
  .strict();
export const socialFormContextSchema = z
  .object({
    occurredAt: instantSchema,
    family: familyDtoSchema,
    expectedFamilyRevision: revisionSchema,
    expectedPreviousVersionId: idSchema.nullable(),
    latestPublishedFormId: idSchema.nullable(),
    referencePersonId: idSchema.nullable(),
    fieldSelectionVersionId: idSchema.nullable(),
    memberRevisions: publishSocialFormSchema.shape.memberRevisions,
    members: z.array(
      z
        .object({
          person: socialPersonSnapshotSchema,
          membership: membershipDtoSchema,
          sizeProfile: sizeProfileSchema.nullable(),
        })
        .strict(),
    ),
    fieldSelection: fieldSelectionDtoSchema.nullable(),
    options: z.array(socialOptionDtoSchema),
    latestForm: socialFormDtoSchema.nullable(),
  })
  .strict();
export type SocialFormDto = z.infer<typeof socialFormDtoSchema>;
export type SocialFormContextDto = z.infer<typeof socialFormContextSchema>;
export type FieldSelectionDto = z.infer<typeof fieldSelectionDtoSchema>;
