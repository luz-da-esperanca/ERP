import { expect, it } from 'vitest';
import { familyFormFields } from '../../../../src/features/social-forms/domain/family-form-template.js';
import { validateSocialValues } from '../../../../src/features/social-forms/domain/social-form-rules.js';
import { initialSocialOptions } from '../../../../src/features/social-forms/domain/initial-social-options.js';
import {
  fixedFamilyBlocks,
  fixedReferenceBlocks,
} from '../../../support/family-form-fixture.js';
import type { SocialValuesInput } from '../../../../src/features/social-forms/domain/social-forms.js';

function input(): SocialValuesInput {
  return {
    fields: familyFormFields(),
    roles: ['SOCIAL_ASSISTANCE'],
    enabledCodes: [
      'FIC_HOUSING',
      'FIC_ECONOMY',
      'FIC_NEEDS',
      'FIC_SITUATION',
      'FIC_EDUCATION',
      'FIC_HEALTH',
      'FIC_MEDICATION',
      'FIC_RELIGION',
    ],
    options: initialSocialOptions.map((option, index) => ({
      ...option,
      id: `option-${index}`,
    })),
    blocks: structuredClone(fixedFamilyBlocks),
    members: [
      {
        personId: 'reference',
        isReference: true,
        selectedFieldKeys: [],
        blocks: structuredClone(fixedReferenceBlocks),
      },
    ],
  };
}

it('publishes a complete form with explicit No answers without requiring inapplicable details', () => {
  const result = validateSocialValues(input());
  expect(result.blocks.economy).toMatchObject({
    receivesGovernmentBenefit: false,
    governmentBenefitName: null,
  });
  expect(result.blocks.needs).toMatchObject({
    hasNeeds: false,
    declaredNeeds: [],
    otherNeed: null,
  });
  expect(result.members[0]?.blocks.medications).toEqual([]);
});

it.each([
  'benefit',
  'housing-other',
  'health-problems',
  'medication-government',
  'observations',
] as const)('requires the applicable details for %s', (condition) => {
  const values = input();
  if (condition === 'benefit')
    values.blocks.economy!.receivesGovernmentBenefit = true;
  if (condition === 'housing-other')
    values.blocks.housing!.housingTenure = [{ code: 'OTHER' }];
  if (condition === 'health-problems')
    values.members[0]!.blocks.health!.hasPhysicalHealthProblems = true;
  if (condition === 'medication-government')
    values.members[0]!.blocks.medications = [
      { medicationName: 'Synthetic medication' },
    ];
  if (condition === 'observations')
    values.blocks.situation!.hasObservations = true;
  expect(() => validateSocialValues(values)).toThrow('REQUIRED_FIELD_MISSING');
});

it('rejects stale details after a No answer and an unanswered medication question', () => {
  const values = input();
  values.blocks.economy!.governmentBenefitName = 'Stale benefit';
  expect(() => validateSocialValues(values)).toThrow('FIELD_NOT_ALLOWED');
  values.blocks.economy!.governmentBenefitName = null;
  values.members[0]!.blocks.medications = null;
  expect(() => validateSocialValues(values)).toThrow('REQUIRED_FIELD_MISSING');
});

it('rejects custom catalog choices in the fixed paper form', () => {
  const values = input();
  values.options.push({
    id: 'custom',
    fieldKey: 'housing.housingTenure',
    code: 'CUSTOM',
    label: 'Custom',
    active: true,
    isOther: false,
    revision: 1,
  });
  values.blocks.housing!.housingTenure = [{ code: 'CUSTOM' }];
  expect(() => validateSocialValues(values)).toThrow('INVALID_OPTION');
});
