import { z } from 'zod';
import {
  idSchema,
  nameSchema,
  reasonSchema,
  revisionSchema,
  instantSchema,
  civilDateSchema,
} from './common';
import { paginationSchema } from './access-api';

const nullableText = (limit: number) =>
  z
    .string()
    .trim()
    .max(limit)
    .transform((value) => value || null)
    .nullable();
const digits = (length: number) =>
  z
    .string()
    .trim()
    .transform((value) => value.replace(/[.\s-]/g, ''))
    .transform((value) => value || null)
    .pipe(
      z
        .string()
        .regex(new RegExp(`^\\d{${length}}$`))
        .nullable(),
    )
    .nullable();
const optionalCivilDate = z
  .string()
  .trim()
  .transform((value) => value || null)
  .pipe(civilDateSchema.nullable())
  .nullable();
const familyFields = z.object({
  referenceName: nullableText(200),
  address: nullableText(500),
  neighborhood: nullableText(200),
  postalCode: digits(8),
  location: z.enum(['URBAN', 'RURAL']).nullable(),
  contactPhone: nullableText(50),
});
const personFields = z.object({
  name: nameSchema,
  birthDate: optionalCivilDate,
  sex: nullableText(100),
  cpf: digits(11),
  rg: nullableText(30),
  occupation: nullableText(100),
  educationLevel: nullableText(100),
  contactPhone: nullableText(50),
});
export const duplicateReviewSchema = z
  .object({
    candidateIds: z
      .array(idSchema)
      .min(1)
      .transform((ids) => [...new Set(ids)].sort()),
    decision: z.literal('DISTINCT'),
    reason: reasonSchema,
  })
  .strict();
export const duplicateQuerySchema = z.discriminatedUnion('entityType', [
  z
    .object({
      entityType: z.literal('FAMILY'),
      referenceName: z.string().trim().min(2).max(200).optional(),
      address: z.string().trim().min(2).max(200).optional(),
    })
    .strict()
    .refine((query) => Boolean(query.referenceName || query.address)),
  z
    .object({
      entityType: z.literal('PERSON'),
      name: z.string().trim().min(2).max(200).optional(),
      birthDate: civilDateSchema.optional(),
      cpf: digits(11).pipe(z.string()).optional(),
    })
    .strict()
    .refine((query) => Boolean(query.name || query.cpf)),
]);
export const duplicateCandidateSchema = z.object({
  id: idSchema,
  entityType: z.enum(['PERSON', 'FAMILY']),
  reasons: z.array(
    z.enum([
      'CPF_MATCH',
      'NAME_BIRTH_MATCH',
      'NAME_SIMILAR',
      'ADDRESS_SIMILAR',
    ]),
  ),
});
export const listPeopleSchema = paginationSchema
  .extend({
    q: z.string().trim().min(2).max(200).optional(),
    birthDate: civilDateSchema.optional(),
    cpf: digits(11).pipe(z.string()).optional(),
    familyId: idSchema.optional(),
    asOf: instantSchema.optional(),
  })
  .strict();
export const familyDtoSchema = familyFields.extend({
  id: idSchema,
  code: z.string().regex(/^\d+$/),
  revision: revisionSchema,
  createdAt: instantSchema,
  updatedAt: instantSchema,
});
export const createFamilySchema = familyFields
  .extend({
    referenceName: familyFields.shape.referenceName.default(null),
    address: familyFields.shape.address.default(null),
    neighborhood: familyFields.shape.neighborhood.default(null),
    postalCode: familyFields.shape.postalCode.default(null),
    location: familyFields.shape.location.default(null),
    contactPhone: familyFields.shape.contactPhone.default(null),
    duplicateReview: duplicateReviewSchema.optional(),
  })
  .strict();
export const personDtoSchema = personFields.extend({
  id: idSchema,
  revision: revisionSchema,
  createdAt: instantSchema,
  updatedAt: instantSchema,
});
export const participantIdentitySchema = z
  .object({
    id: idSchema,
    name: nameSchema,
    family: z
      .object({ id: idSchema, code: z.string().regex(/^\d+$/) })
      .nullable(),
  })
  .strict();
export const peoplePageSchema = z.object({
  data: z.array(z.union([personDtoSchema, participantIdentitySchema])),
  pagination: paginationSchema.extend({
    total: z.number().int().nonnegative(),
  }),
});
export const membershipDtoSchema = z.object({
  id: idSchema,
  personId: idSchema,
  familyId: idSchema,
  relationshipToReference: nullableText(100),
  isReference: z.boolean(),
  validFrom: instantSchema,
  validUntil: instantSchema.nullable(),
  revision: revisionSchema,
});
export const personRegistrationSchema = z.object({
  person: personDtoSchema,
  membership: membershipDtoSchema,
  family: familyDtoSchema,
});
export const membershipTransferSchema = z
  .object({
    membershipId: idSchema,
    targetFamilyId: idSchema,
    effectiveAt: instantSchema.transform((value) =>
      new Date(value).toISOString(),
    ),
    expectedMembershipRevision: revisionSchema,
    expectedSourceFamilyRevision: revisionSchema,
    expectedTargetFamilyRevision: revisionSchema,
    relationshipToReference: nullableText(100).default(null),
    isReference: z.boolean().default(false),
    reason: reasonSchema,
  })
  .strict();
export const membershipTransferResultSchema = z.object({
  previousMembership: membershipDtoSchema,
  membership: membershipDtoSchema,
  sourceFamily: familyDtoSchema,
  targetFamily: familyDtoSchema,
});
export const referenceChangeSchema = z
  .object({
    membershipId: idSchema,
    expectedRevision: revisionSchema,
    effectiveAt: instantSchema.transform((value) =>
      new Date(value).toISOString(),
    ),
    reason: reasonSchema,
  })
  .strict();
export const referenceChangeResultSchema = z.object({
  family: familyDtoSchema,
  memberships: z.array(membershipDtoSchema),
});
export const familyDetailSchema = z.object({
  family: familyDtoSchema.extend({
    memberCount: z.number().int().nonnegative(),
    referencePersonName: z.string().nullable(),
  }),
  members: z.array(
    z.object({ person: personDtoSchema, membership: membershipDtoSchema }),
  ),
});
export const updateFamilySchema = familyFields
  .partial()
  .extend({
    expectedRevision: revisionSchema,
  })
  .strict()
  .refine((input) => Object.keys(input).length > 1);
export const createRegisteredPersonSchema = personFields
  .extend({
    birthDate: personFields.shape.birthDate.default(null),
    sex: personFields.shape.sex.default(null),
    cpf: personFields.shape.cpf.default(null),
    rg: personFields.shape.rg.default(null),
    occupation: personFields.shape.occupation.default(null),
    educationLevel: personFields.shape.educationLevel.default(null),
    contactPhone: personFields.shape.contactPhone.default(null),
    familyId: idSchema,
    expectedFamilyRevision: revisionSchema,
    validFrom: instantSchema.transform((value) =>
      new Date(value).toISOString(),
    ),
    relationshipToReference: nullableText(100).default(null),
    isReference: z.boolean().default(false),
    duplicateReview: duplicateReviewSchema.optional(),
  })
  .strict();

export const listFamiliesSchema = paginationSchema
  .extend({
    q: z.string().trim().min(2).max(200).optional(),
    code: z
      .string()
      .regex(/^[1-9]\d{0,18}$/)
      .pipe(z.string().refine((value) => BigInt(value) <= 9223372036854775807n))
      .optional(),
    asOf: instantSchema.optional(),
  })
  .strict();
export const familySummarySchema = familyDetailSchema.shape.family;
export const familiesPageSchema = z.object({
  data: z.array(familySummarySchema),
  pagination: paginationSchema.extend({
    total: z.number().int().nonnegative(),
  }),
});
export const updatePersonSchema = personFields
  .partial()
  .extend({ expectedRevision: revisionSchema })
  .strict()
  .refine((input) => Object.keys(input).length > 1);
export const sizeProfileSchema = z.object({
  personId: idSchema,
  shoeSize: nullableText(30),
  clothingSize: nullableText(30),
  informedOn: optionalCivilDate,
  revision: revisionSchema,
});
export const sizesInputSchema = sizeProfileSchema
  .omit({ personId: true, revision: true })
  .extend({
    expectedRevision: revisionSchema.nullable(),
    shoeSize: nullableText(30).default(null),
    clothingSize: nullableText(30).default(null),
    informedOn: optionalCivilDate.default(null),
  })
  .strict();
export const personDetailSchema = z.object({
  person: personDtoSchema,
  memberships: z.array(membershipDtoSchema),
  currentFamily: participantIdentitySchema.shape.family,
  sizeProfile: sizeProfileSchema.nullable(),
});
export const membershipClosureSchema = z
  .object({
    expectedRevision: revisionSchema,
    expectedFamilyRevision: revisionSchema,
    validUntil: instantSchema.transform((value) =>
      new Date(value).toISOString(),
    ),
    reason: reasonSchema,
  })
  .strict();
export const membershipChangeResultSchema = z.object({
  membership: membershipDtoSchema,
  family: familyDtoSchema,
});

export type FamilyDto = z.infer<typeof familyDtoSchema>;
export type PersonDto = z.infer<typeof personDtoSchema>;
export type MembershipDto = z.infer<typeof membershipDtoSchema>;
export type FamilyDetailDto = z.infer<typeof familyDetailSchema>;
export type PersonDetailDto = z.infer<typeof personDetailSchema>;
export type CreateFamilyInput = z.input<typeof createFamilySchema>;
export type CreatePersonInput = z.input<typeof createRegisteredPersonSchema>;
export type UpdatePersonInput = z.input<typeof updatePersonSchema>;
export type MembershipTransferInput = z.input<typeof membershipTransferSchema>;
export type ReferenceChangeInput = z.input<typeof referenceChangeSchema>;
export type SizesInput = z.input<typeof sizesInputSchema>;
export const membershipCorrectionSchema = z
  .object({
    expectedRevision: revisionSchema,
    expectedFamilyRevision: revisionSchema,
    validFrom: instantSchema
      .transform((value) => new Date(value).toISOString())
      .optional(),
    validUntil: instantSchema
      .transform((value) => new Date(value).toISOString())
      .nullable()
      .optional(),
    relationshipToReference: nullableText(100).optional(),
    isReference: z.boolean().optional(),
    reason: reasonSchema,
  })
  .strict()
  .refine((input) => Object.keys(input).length > 3);
export type UpdateFamilyInput = z.input<typeof updateFamilySchema>;
export type MembershipCorrectionInput = z.input<
  typeof membershipCorrectionSchema
>;
export type MembershipClosureInput = z.input<typeof membershipClosureSchema>;
export type ListFamiliesInput = z.input<typeof listFamiliesSchema>;
export type ListPeopleInput = z.input<typeof listPeopleSchema>;
export type SizeProfileDto = z.infer<typeof sizeProfileSchema>;
export type FamiliesPageDto = z.infer<typeof familiesPageSchema>;
export type PeoplePageDto = z.infer<typeof peoplePageSchema>;
export type ReferenceChangeResultDto = z.infer<
  typeof referenceChangeResultSchema
>;
export type MembershipTransferResultDto = z.infer<
  typeof membershipTransferResultSchema
>;
