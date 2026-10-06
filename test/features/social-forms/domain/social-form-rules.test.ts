import { describe, expect, it } from 'vitest';
import {
  validateSocialValues,
  validateFieldSelection,
  resolveSizeProfileId,
} from '../../../../src/features/social-forms/domain/social-form-rules.js';
import type {
  FieldDefinition,
  SocialValuesInput,
} from '../../../../src/features/social-forms/domain/social-forms.js';

const fields: FieldDefinition[] = [
  {
    fieldKey: 'housing.roomCount',
    included: true,
    required: false,
    appliesTo: 'FAMILY',
    allowedRoleCodes: ['SOCIAL_ASSISTANCE', 'COORDINATION'],
    cardinality: 'SINGLE',
    purpose: 'Synthetic evaluation',
    decisionReference: 'SYNTHETIC-TEST',
  },
  {
    fieldKey: 'members[].economy.incomeAmount',
    included: true,
    required: false,
    appliesTo: 'ALL_MEMBERS',
    allowedRoleCodes: ['SOCIAL_ASSISTANCE', 'COORDINATION'],
    cardinality: 'SINGLE',
    purpose: 'Synthetic evaluation',
    decisionReference: 'SYNTHETIC-TEST',
  },
];
describe('Social field rules', () => {
  it('uses the canonical size basis or a sole alias and refuses arbitrary reconciliation', () => {
    expect(resolveSizeProfileId('canonical', ['alias', 'canonical'])).toBe(
      'canonical',
    );
    expect(resolveSizeProfileId('canonical', ['alias'])).toBe('alias');
    expect(resolveSizeProfileId('canonical', [])).toBeNull();
    expect(() =>
      resolveSizeProfileId('canonical', ['alias-one', 'alias-two']),
    ).toThrow('SIZE_PROFILE_RECONCILIATION_REQUIRED');
  });
  it('validates required values only for explicitly selected members and keeps unknown others out of the block', () => {
    const field: FieldDefinition = {
      ...fields[1]!,
      fieldKey: 'members[].education.attendsSchool',
      appliesTo: 'SELECTED_MEMBERS',
      required: true,
    };
    const input: SocialValuesInput = {
      fields: [field],
      enabledCodes: ['FIC_EDUCATION'],
      roles: ['COORDINATION'],
      blocks: {},
      options: [],
      members: [
        {
          personId: 'selected',
          isReference: false,
          selectedFieldKeys: [field.fieldKey],
          blocks: { education: { attendsSchool: false } },
        },
        {
          personId: 'unselected',
          isReference: false,
          selectedFieldKeys: [],
          blocks: {},
        },
      ],
    };
    expect(
      validateSocialValues(input).members.map((member) => member.blocks),
    ).toEqual([{ education: { attendsSchool: false } }, {}]);
    expect(() =>
      validateSocialValues({
        ...input,
        members: [{ ...input.members[0]!, blocks: {} }],
      }),
    ).toThrow('REQUIRED_FIELD_MISSING');
    expect(() =>
      validateSocialValues({
        ...input,
        members: [
          {
            ...input.members[1]!,
            blocks: { education: { attendsSchool: true } },
          },
        ],
      }),
    ).toThrow('FIELD_NOT_ALLOWED');
  });
  it('freezes authoritative catalog labels, rejects inactive choices and enforces cardinality', () => {
    const field: FieldDefinition = {
      ...fields[0]!,
      fieldKey: 'housing.housingTenure',
    };
    const option = {
      id: 'option',
      fieldKey: field.fieldKey,
      code: 'OWNED',
      label: 'Própria',
      active: true,
      isOther: false,
      revision: 1,
    };
    const input: SocialValuesInput = {
      fields: [field],
      enabledCodes: ['FIC_HOUSING'],
      roles: ['COORDINATION'],
      blocks: {
        housing: { housingTenure: [{ code: 'OWNED', label: 'Invented' }] },
      },
      members: [],
      options: [option],
    };
    expect(validateSocialValues(input).blocks.housing?.housingTenure).toEqual([
      { code: 'OWNED', label: 'Própria' },
    ]);
    expect(() =>
      validateSocialValues({
        ...input,
        options: [{ ...option, active: false }],
      }),
    ).toThrow('INVALID_OPTION');
    expect(() =>
      validateSocialValues({
        ...input,
        blocks: {
          housing: { housingTenure: [{ code: 'OWNED' }, { code: 'OWNED' }] },
        },
      }),
    ).toThrow('INVALID_CARDINALITY');
    expect(
      validateSocialValues({
        ...input,
        blocks: { housing: { housingTenure: [] } },
      }).blocks.housing?.housingTenure,
    ).toEqual([]);
  });
  it('keeps omitted data unknown and rejects disabled sensitive input', () => {
    const member = {
      personId: 'person',
      isReference: true,
      blocks: { economy: { incomeAmount: '0' } },
      selectedFieldKeys: [],
    };
    const result = validateSocialValues({
      fields,
      enabledCodes: ['FIC_HOUSING', 'FIC_ECONOMY'],
      roles: ['SOCIAL_ASSISTANCE'],
      blocks: { housing: {} },
      members: [member],
      options: [],
    });
    expect(result.blocks).toEqual({ housing: { roomCount: null } });
    expect(result.members[0]?.blocks).toEqual({
      economy: { incomeAmount: '0' },
    });
    expect(() =>
      validateSocialValues({
        fields,
        enabledCodes: ['FIC_HOUSING', 'FIC_ECONOMY'],
        roles: ['SOCIAL_ASSISTANCE'],
        blocks: {},
        members: [
          { ...member, blocks: { health: { physicalHealth: 'GOOD' } } },
        ],
        options: [],
      }),
    ).toThrow('BLOCK_DISABLED');
  });
  it('rejects impossible scopes, silent mandatory fields and social access granted to administrators', () => {
    expect(() =>
      validateFieldSelection([{ ...fields[0]!, appliesTo: 'ALL_MEMBERS' }]),
    ).toThrow('INVALID_FIELD_SELECTION');
    expect(() =>
      validateFieldSelection([
        { ...fields[0]!, included: false, required: true },
      ]),
    ).toThrow('INVALID_FIELD_SELECTION');
    expect(() =>
      validateFieldSelection([
        { ...fields[0]!, allowedRoleCodes: ['ADMINISTRATOR'] },
      ]),
    ).toThrow('INVALID_FIELD_SELECTION');
  });
});
