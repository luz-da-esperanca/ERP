import { z } from 'zod';
import {
  idSchema,
  nameSchema,
  optionalText,
  optionalDateSchema,
  instantSchema,
  revisionSchema,
} from './common';

export const familyInputSchema = z
  .object({
    referenceName: optionalText(200),
    address: optionalText(500),
    neighborhood: optionalText(200),
    postalCode: z.preprocess(
      (v) => (v === '' || v === undefined ? null : v),
      z
        .string()
        .regex(/^\d{8}$/)
        .nullable(),
    ),
    location: z.enum(['URBAN', 'RURAL']).nullable().default(null),
    contactPhone: optionalText(50),
  })
  .strict();
export const familySchema = familyInputSchema.extend({
  id: idSchema,
  code: z.string(),
  revision: revisionSchema,
  createdAt: instantSchema,
  updatedAt: instantSchema,
});
export const personInputSchema = z
  .object({
    name: nameSchema,
    birthDate: optionalDateSchema,
    sex: optionalText(100),
    cpf: z.preprocess(
      (v) => (v === '' || v === undefined ? null : v),
      z
        .string()
        .regex(/^\d{11}$/)
        .nullable(),
    ),
    rg: optionalText(30),
    occupation: optionalText(100),
    educationLevel: optionalText(100),
    contactPhone: optionalText(50),
  })
  .strict();
export const personSchema = personInputSchema.extend({
  id: idSchema,
  revision: revisionSchema,
  updatedAt: instantSchema,
});
export const membershipSchema = z
  .object({
    id: idSchema,
    personId: idSchema,
    familyId: idSchema,
    relationshipToReference: optionalText(100),
    isReference: z.boolean(),
    validFrom: instantSchema,
    validUntil: instantSchema.nullable(),
    revision: revisionSchema,
  })
  .strict();
export type Family = z.infer<typeof familySchema>;
export type FamilyInput = z.infer<typeof familyInputSchema>;
export type Person = z.infer<typeof personSchema>;
export type PersonInput = z.infer<typeof personInputSchema>;
export type FamilyMembership = z.infer<typeof membershipSchema>;
export interface FamilySummary extends Family {
  memberCount: number;
  referencePersonName: string | null;
}
export interface FamilyDetail {
  family: FamilySummary;
  members: Array<{ person: Person; membership: FamilyMembership }>;
}
export interface PersonDetail {
  person: Person;
  memberships: Array<FamilyMembership & { familyCode: string }>;
}
export const createPersonSchema = z
  .object({
    person: personInputSchema,
    familyId: idSchema,
    expectedFamilyRevision: revisionSchema,
    validFrom: instantSchema,
    relationshipToReference: optionalText(100),
    isReference: z.boolean(),
    duplicateReason: optionalText(1000),
  })
  .strict();
export type CreatePersonInput = z.infer<typeof createPersonSchema>;
