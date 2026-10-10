import type {
  FeatureDecisionCode,
  SocialBlock,
  SocialFieldKey,
  SocialFormBlocks,
  SocialMemberBlocks,
  SocialValue,
  SocialValues,
} from '@erp/contracts/social-form-fields';
import type { Role } from '@erp/contracts/access';
import type {
  FieldDefinition,
  MemberSocialValues,
  SocialValuesInput,
} from './social-forms.js';
import {
  SocialFormRuleError,
  SocialFormConflictError,
} from './social-form-errors.js';
import { familyFormTemplateCode } from './family-form-template.js';
import { initialSocialOptions } from './initial-social-options.js';

function isApplicable(
  path: string,
  blocks: SocialFormBlocks | SocialMemberBlocks,
) {
  const values = (block: string, key: string) => {
    const group = Object.entries(blocks).find(([name]) => name === block)?.[1];
    return group && !Array.isArray(group) ? group[key] : undefined;
  };
  switch (path) {
    case 'economy.governmentBenefitName':
      return values('economy', 'receivesGovernmentBenefit') === true;
    case 'needs.declaredNeeds':
      return values('needs', 'hasNeeds') === true;
    case 'needs.otherNeed': {
      const choices = values('needs', 'declaredNeeds');
      return (
        values('needs', 'hasNeeds') === true &&
        Array.isArray(choices) &&
        choices.some((choice) => 'code' in choice && choice.code === 'OTHER')
      );
    }
    case 'health.otherSpiritualHealth':
      return values('health', 'spiritualHealth') === 'OTHER';
    case 'health.physicalHealthProblems':
      return values('health', 'hasPhysicalHealthProblems') === true;
    case 'health.healthUnit':
      return values('health', 'hasHealthUnit') === true;
    case 'health.communityHealthAgent':
      return values('health', 'hasCommunityHealthAgent') === true;
    case 'education.schoolLevelOrGrade':
    case 'education.studyMode':
      return values('education', 'attendsSchool') === true;
    case 'situation.observations':
      return values('situation', 'hasObservations') === true;
    default:
      return true;
  }
}

export function resolveSizeProfileId(
  canonicalPersonId: string,
  profilePersonIds: readonly string[],
) {
  if (profilePersonIds.includes(canonicalPersonId)) return canonicalPersonId;
  if (profilePersonIds.length > 1)
    throw new SocialFormConflictError('SIZE_PROFILE_RECONCILIATION_REQUIRED');
  return profilePersonIds[0] ?? null;
}

export function fieldBlock(key: SocialFieldKey): SocialBlock {
  return key.replace('members[].', '').split('.')[0] as SocialBlock;
}
export function blockDecision(block: SocialBlock): FeatureDecisionCode {
  return block === 'medications'
    ? 'FIC_MEDICATION'
    : (`FIC_${block.toUpperCase()}` as FeatureDecisionCode);
}
export function allowsField(
  field: FieldDefinition,
  roles: readonly Role[],
  enabled: readonly FeatureDecisionCode[],
) {
  return (
    field.included &&
    enabled.includes(blockDecision(fieldBlock(field.fieldKey))) &&
    field.allowedRoleCodes.some((role) => roles.includes(role))
  );
}
export function validateFieldSelection(fields: readonly FieldDefinition[]) {
  const keys = new Set<string>();
  for (const field of fields) {
    const individual = field.fieldKey.startsWith('members[].');
    const block = fieldBlock(field.fieldKey);
    if (
      keys.has(field.fieldKey) ||
      (field.required && !field.included) ||
      (individual
        ? field.appliesTo === 'FAMILY'
        : field.appliesTo !== 'FAMILY') ||
      !field.allowedRoleCodes.length ||
      field.allowedRoleCodes.some(
        (role) => role !== 'SOCIAL_ASSISTANCE' && role !== 'COORDINATION',
      ) ||
      !field.purpose.trim() ||
      (field.included && !field.decisionReference.trim()) ||
      ((block === 'health' || block === 'medications') &&
        field.appliesTo !== 'REFERENCE_MEMBER') ||
      (field.cardinality === 'MULTIPLE' &&
        !catalogFields.has(field.fieldKey) &&
        block !== 'medications' &&
        field.fieldKey !== 'situation.observations')
    )
      throw new SocialFormRuleError('INVALID_FIELD_SELECTION');
    keys.add(field.fieldKey);
  }
}
export const catalogFields = new Set<SocialFieldKey>([
  'housing.housingTenure',
  'housing.location',
  'housing.dwellingType',
  'housing.construction',
  'housing.floorType',
  'housing.electricity',
  'housing.waterSupply',
  'housing.waterTreatment',
  'housing.sewage',
  'housing.wasteDisposal',
  'housing.transportation',
  'housing.hygiene',
  'needs.declaredNeeds',
]);
export function memberApplies(
  field: FieldDefinition,
  member: MemberSocialValues,
) {
  return (
    field.appliesTo === 'ALL_MEMBERS' ||
    (field.appliesTo === 'REFERENCE_MEMBER' && member.isReference) ||
    (field.appliesTo === 'SELECTED_MEMBERS' &&
      member.selectedFieldKeys.includes(field.fieldKey))
  );
}
function supplied(
  blocks: SocialFormBlocks | SocialMemberBlocks,
): Array<[string, SocialValue]> {
  const values: Array<[string, SocialValue]> = [];
  for (const [block, data] of Object.entries(blocks)) {
    if (data === undefined) continue;
    if (block === 'medications') values.push([block, data as SocialValue]);
    else
      for (const [key, value] of Object.entries(data ?? {}))
        if (value !== undefined)
          values.push([`${block}.${key}`, value as SocialValue]);
  }
  return values;
}
function normalize(
  input: SocialValuesInput,
  blocks: SocialFormBlocks | SocialMemberBlocks,
  member?: MemberSocialValues,
) {
  const result: Record<string, SocialValues | SocialValue> = {};
  for (const block of Object.keys(blocks))
    if (!input.enabledCodes.includes(blockDecision(block as SocialBlock)))
      throw new SocialFormRuleError('BLOCK_DISABLED');
  for (const [path] of supplied(blocks)) {
    const key = (member ? `members[].${path}` : path) as SocialFieldKey;
    const field = input.fields.find((field) => field.fieldKey === key);
    if (
      !field ||
      !allowsField(field, input.roles, input.enabledCodes) ||
      (member && !memberApplies(field, member))
    )
      throw new SocialFormRuleError('FIELD_NOT_ALLOWED');
  }
  if (
    member?.selectedFieldKeys.some(
      (key) =>
        !input.fields.some(
          (field) =>
            field.fieldKey === key &&
            field.appliesTo === 'SELECTED_MEMBERS' &&
            allowsField(field, input.roles, input.enabledCodes),
        ),
    )
  )
    throw new SocialFormRuleError('FIELD_NOT_ALLOWED');
  for (const field of input.fields) {
    if (
      field.fieldKey.startsWith('members[].') !== !!member ||
      !allowsField(field, input.roles, input.enabledCodes) ||
      (member && !memberApplies(field, member))
    )
      continue;
    const path = field.fieldKey.replace('members[].', '');
    let value = supplied(blocks).find(([key]) => key === path)?.[1] ?? null;
    const fixed = field.decisionReference === familyFormTemplateCode;
    const applicable = !fixed || isApplicable(path, blocks);
    if (
      !applicable &&
      value !== null &&
      value !== '' &&
      !(Array.isArray(value) && value.length === 0)
    )
      throw new SocialFormRuleError('FIELD_NOT_ALLOWED');
    if (field.required && applicable && (value === null || value === ''))
      throw new SocialFormRuleError('REQUIRED_FIELD_MISSING');
    if (
      fixed &&
      applicable &&
      catalogFields.has(field.fieldKey) &&
      Array.isArray(value) &&
      !value.length
    )
      throw new SocialFormRuleError('REQUIRED_FIELD_MISSING');
    if (Array.isArray(value)) {
      if (field.cardinality === 'SINGLE' && value.length > 1)
        throw new SocialFormRuleError('INVALID_CARDINALITY');
      if (catalogFields.has(field.fieldKey)) {
        const codes = new Set<string>();
        value = value.map((item) => {
          if (!('code' in item) || codes.has(item.code))
            throw new SocialFormRuleError('INVALID_OPTION');
          codes.add(item.code);
          const option = input.options.find(
            (option) =>
              option.fieldKey === field.fieldKey &&
              option.code === item.code &&
              option.active,
          );
          if (
            !option ||
            (!option.isOther && item.otherText) ||
            (fixed &&
              !initialSocialOptions.some(
                (candidate) =>
                  candidate.fieldKey === field.fieldKey &&
                  candidate.code === item.code,
              ))
          )
            throw new SocialFormRuleError('INVALID_OPTION');
          if (
            fixed &&
            option.isOther &&
            field.fieldKey !== 'needs.declaredNeeds' &&
            !item.otherText?.trim()
          )
            throw new SocialFormRuleError('REQUIRED_FIELD_MISSING');
          return {
            code: option.code,
            label: option.label,
            ...(option.isOther ? { otherText: item.otherText ?? null } : {}),
          };
        });
      }
    }
    if (
      fixed &&
      path === 'medications' &&
      Array.isArray(value) &&
      value.some(
        (item) =>
          !('providedByGovernment' in item) ||
          typeof item.providedByGovernment !== 'boolean',
      )
    )
      throw new SocialFormRuleError('REQUIRED_FIELD_MISSING');
    if (
      fixed &&
      path === 'situation.observations' &&
      applicable &&
      Array.isArray(value) &&
      !value.length
    )
      throw new SocialFormRuleError('REQUIRED_FIELD_MISSING');
    const [block, key] = path.split('.');
    if (key) {
      const target = (result[block!] ??= {}) as SocialValues;
      target[key] = value;
    } else result[block!] = value;
  }
  return result;
}
export function validateSocialValues(input: SocialValuesInput) {
  return {
    blocks: normalize(input, input.blocks) as SocialFormBlocks,
    members: input.members.map((member) => ({
      ...member,
      blocks: normalize(input, member.blocks, member) as SocialMemberBlocks,
    })),
  };
}
