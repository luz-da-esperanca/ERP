import { z } from 'zod';
import {
  socialFormDtoSchema,
  socialFormMemberDtoSchema,
  socialMemberBlocksSchema,
  fieldSelectionDtoSchema,
  featureDecisionDtoSchema,
  socialOptionDtoSchema,
  acknowledgementDtoSchema,
  socialFormSummarySchema,
} from '@erp/contracts/social-forms-api';
import type { Prisma } from '../../../generated/prisma/client.js';

export function projectSocialFormSummary(
  row: Prisma.SocialFormGetPayload<object>,
  canonicalFamilyId: string,
) {
  return socialFormSummarySchema.parse({
    id: row.id,
    familyId: row.familyId,
    version: row.version,
    previousVersionId: row.previousVersionId,
    correctionOfFormId: row.correctionOfFormId,
    occurredAt: row.occurredAt.toISOString(),
    recordedAt: row.recordedAt.toISOString(),
    recordedBy: row.recordedBy,
    fieldSelectionVersionId: row.fieldSelectionVersionId,
    originFamilyId: row.familyId === canonicalFamilyId ? null : row.familyId,
    originalVersion: row.familyId === canonicalFamilyId ? null : row.version,
  });
}

const protectedPayloadSchema = z
  .object({
    keyId: z.string().min(1),
    nonce: z.string(),
    ciphertext: z.string(),
    tag: z.string(),
  })
  .strict();
export const storedFormMemberSchema = socialFormMemberDtoSchema
  .extend({
    blocks: socialMemberBlocksSchema
      .omit({ health: true, medications: true, religion: true })
      .strict(),
    protectedBlocks: z
      .object({
        health: protectedPayloadSchema.optional(),
        medications: protectedPayloadSchema.optional(),
        religion: protectedPayloadSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export const storedSocialFormSchema = socialFormDtoSchema.extend({
  members: z.array(storedFormMemberSchema),
});
export const socialSnapshotSchemas = {
  SocialForm: storedSocialFormSchema,
  Acknowledgement: acknowledgementDtoSchema,
  FieldSelectionVersion: fieldSelectionDtoSchema,
  FeatureDecision: featureDecisionDtoSchema,
  SocialFormOption: socialOptionDtoSchema,
};
