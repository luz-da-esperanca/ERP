import { z } from 'zod';
import {
  idSchema,
  instantSchema,
  optionalText,
  optionalMoneySchema,
  revisionSchema,
} from './common';

export const socialFormInputSchema = z
  .object({
    familyId: idSchema,
    expectedFamilyRevision: revisionSchema,
    expectedPreviousVersionId: idSchema.nullable(),
    occurredAt: instantSchema,
    housingTenure: z
      .enum(['OWNED', 'FINANCED', 'RENTED', 'PROVIDED', 'OTHER'])
      .nullable(),
    needs: z
      .array(
        z.enum([
          'FOOD',
          'CLOTHING',
          'FOOTWEAR',
          'EMPLOYMENT',
          'MEDICAL_SUPPORT',
          'OTHER',
        ]),
      )
      .nullable(),
    situation: optionalText(4000),
    members: z.array(
      z
        .object({
          personId: idSchema,
          incomeAmount: optionalMoneySchema,
          attendsSchool: z.boolean().nullable(),
        })
        .strict(),
    ),
  })
  .strict();
export type SocialFormInput = z.infer<typeof socialFormInputSchema>;
export interface SocialForm extends SocialFormInput {
  id: string;
  version: number;
  recordedAt: string;
  recordedBy: string;
  familySnapshot: {
    code: string;
    referenceName: string | null;
    address: string | null;
  };
  memberSnapshots: Array<{
    personId: string;
    name: string;
    isReference: boolean;
    relationshipToReference: string | null;
  }>;
}
