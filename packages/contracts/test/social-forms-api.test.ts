import { describe, expect, it } from 'vitest';
import {
  publishSocialFormSchema,
  fieldSelectionInputSchema,
  acknowledgementCommandSchema,
  socialFormMemberDtoSchema,
  updateSocialOptionSchema,
} from '../src/social-forms-api';
import { authorizedAuditQuerySchema } from '../src/audit-api';

const id = '11111111-1111-4111-8111-111111111111';
const input = {
  occurredAt: '2026-10-01T12:00:00Z',
  expectedFamilyRevision: 1,
  expectedPreviousVersionId: null,
  fieldSelectionVersionId: id,
  memberRevisions: [
    {
      personId: id,
      expectedPersonRevision: 1,
      membershipId: id,
      expectedMembershipRevision: 1,
    },
  ],
  blocks: { housing: { roomCount: null }, needs: { declaredNeeds: [] } },
  members: [{ personId: id, economy: { incomeAmount: '0' } }],
};

describe('Social form publication contract', () => {
  it('accepts explicit applicability, dated paper observations and signature declarations', () => {
    const publication = {
      ...input,
      blocks: {
        needs: { hasNeeds: false, declaredNeeds: [] },
        situation: {
          text: 'Synthetic situation',
          hasObservations: true,
          observations: [
            {
              occurredOn: '2026-10-01',
              description: 'Synthetic paper annotation',
            },
          ],
          beneficiarySigned: false,
          registrationResponsibleName: 'Synthetic operator',
          registrationResponsibleSigned: false,
        },
      },
      members: [
        {
          personId: id,
          health: {
            hasPhysicalHealthProblems: false,
            hasHealthUnit: false,
            hasCommunityHealthAgent: false,
          },
        },
      ],
    };
    expect(publishSocialFormSchema.safeParse(publication).success).toBe(true);
    expect(
      publishSocialFormSchema.safeParse({
        ...publication,
        blocks: {
          situation: {
            observations: [
              { occurredOn: '2026-02-30', description: 'Invalid date' },
            ],
          },
        },
      }).success,
    ).toBe(false);
  });
  it('normalizes optional blank text to unknown without changing declared false or zero', () => {
    expect(
      publishSocialFormSchema.parse({
        ...input,
        blocks: {
          economy: {
            governmentBenefitName: '  ',
            receivesGovernmentBenefit: false,
          },
        },
        members: [
          {
            personId: id,
            economy: { occupationOrIncomeSource: '  ', incomeAmount: '0' },
          },
        ],
      }),
    ).toMatchObject({
      blocks: {
        economy: {
          governmentBenefitName: null,
          receivesGovernmentBenefit: false,
        },
      },
      members: [
        { economy: { occupationOrIncomeSource: null, incomeAmount: '0' } },
      ],
    });
  });
  it('preserves unknown values, declared zero and explicitly empty collections without accepting client snapshots', () => {
    expect(publishSocialFormSchema.parse(input)).toMatchObject(input);
    expect(
      publishSocialFormSchema.safeParse({
        ...input,
        familySnapshot: { address: 'Invented' },
      }).success,
    ).toBe(false);
    expect(
      publishSocialFormSchema.safeParse({
        ...input,
        members: [{ personId: id, diagnosis: 'Forbidden' }],
      }).success,
    ).toBe(false);
  });
  it('rejects duplicate members, ambiguous size bases and corrections without a reason', () => {
    expect(
      publishSocialFormSchema.safeParse({
        ...input,
        memberRevisions: [...input.memberRevisions, ...input.memberRevisions],
      }).success,
    ).toBe(false);
    expect(
      publishSocialFormSchema.safeParse({
        ...input,
        memberRevisions: [
          { ...input.memberRevisions[0], expectedSizeRevision: null },
        ],
      }).success,
    ).toBe(false);
    expect(
      publishSocialFormSchema.safeParse({ ...input, correctionOfFormId: id })
        .success,
    ).toBe(false);
    expect(
      publishSocialFormSchema.safeParse({
        ...input,
        members: [{ personId: id, economy: { incomeAmount: -1 } }],
      }).success,
    ).toBe(false);
  });
  it('accepts only supported field keys and a dated acknowledgement', () => {
    const selection = {
      expectedRevision: null,
      decisionReference: 'SYNTHETIC-TEST',
      reason: 'Synthetic configuration',
      fields: [
        {
          fieldKey: 'housing.roomCount',
          included: true,
          required: false,
          appliesTo: 'FAMILY',
          allowedRoleCodes: ['COORDINATION'],
          cardinality: 'SINGLE',
          purpose: 'Synthetic evaluation',
          decisionReference: 'SYNTHETIC-TEST',
        },
      ],
    };
    expect(fieldSelectionInputSchema.safeParse(selection).success).toBe(true);
    expect(
      fieldSelectionInputSchema.safeParse({
        ...selection,
        fields: [{ ...selection.fields[0], fieldKey: 'clinical.diagnosis' }],
      }).success,
    ).toBe(false);
    expect(
      acknowledgementCommandSchema.safeParse({
        referencePersonId: id,
        method: 'PAPER_SIGNATURE',
        expectedRevision: null,
      }).success,
    ).toBe(false);
  });
  it('bounds the composed option audit reason before starting a database write', () => {
    const update = {
      expectedRevision: 1,
      active: false,
      reason: 'r'.repeat(1000),
      decisionReference: 'd'.repeat(997),
    };
    expect(updateSocialOptionSchema.safeParse(update).success).toBe(true);
    expect(
      updateSocialOptionSchema.safeParse({
        ...update,
        decisionReference: 'd'.repeat(998),
      }).success,
    ).toBe(false);
  });
  it('preserves legacy snapshots, accepts fixed-form identification and never exposes ciphertext', () => {
    const member = {
      id,
      socialFormId: id,
      personId: id,
      membershipId: id,
      membershipRevision: 1,
      personSnapshot: {
        id,
        name: 'Synthetic member',
        birthDate: null,
        sex: null,
        revision: 1,
      },
      relationshipSnapshot: {
        isReference: true,
        relationshipToReference: null,
      },
      sizeProfilePersonId: null,
      sizeRevision: null,
      sizeSnapshot: null,
      selectedFieldKeys: [],
      blocks: {},
    };
    expect(socialFormMemberDtoSchema.safeParse(member).success).toBe(true);
    expect(
      socialFormMemberDtoSchema.safeParse({
        ...member,
        protectedBlocks: { health: { ciphertext: 'private' } },
      }).success,
    ).toBe(false);
    expect(
      socialFormMemberDtoSchema.safeParse({
        ...member,
        personSnapshot: {
          ...member.personSnapshot,
          cpf: '12345678909',
          rg: 'Synthetic RG',
          occupation: 'Synthetic occupation',
          educationLevel: 'Synthetic level',
          contactPhone: '8632221234',
        },
      }).success,
    ).toBe(true);
    expect(
      socialFormMemberDtoSchema.safeParse({
        ...member,
        personSnapshot: { ...member.personSnapshot, cpf: '12345678901' },
      }).success,
    ).toBe(false);
  });
  it('accepts social and configuration audit scopes with the common filters', () => {
    expect(
      authorizedAuditQuerySchema.safeParse({
        entityType: 'SocialForm',
        action: 'CORRECT',
        from: '2026-10-01T00:00:00Z',
      }).success,
    ).toBe(true);
    expect(
      authorizedAuditQuerySchema.safeParse({
        entityType: 'FeatureDecision',
        action: 'UPDATE',
      }).success,
    ).toBe(true);
  });
});
