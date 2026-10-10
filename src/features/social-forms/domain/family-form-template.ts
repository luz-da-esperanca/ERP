import type {
  FieldDefinition,
  SocialFormSource,
  SocialFormPublication,
} from './social-forms.js';
import { SocialFormRuleError } from './social-form-errors.js';
import type { SocialFieldKey } from '@erp/contracts/social-form-fields';

export const familyFormTemplateCode = 'FAMILY_REGISTRATION_2025';
const familyFields: SocialFieldKey[] = [
  'housing.housingTenure',
  'housing.location',
  'housing.roomCount',
  'housing.bedroomCount',
  'housing.riskArea',
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
  'economy.declaredWorkerCount',
  'economy.declaredPensionerCount',
  'economy.receivesGovernmentBenefit',
  'economy.governmentBenefitName',
  'economy.declaredChildCount',
  'economy.declaredAdolescentCount',
  'needs.hasNeeds',
  'needs.declaredNeeds',
  'needs.otherNeed',
  'situation.text',
  'situation.hasObservations',
  'situation.observations',
  'situation.beneficiarySigned',
  'situation.registrationResponsibleName',
  'situation.registrationResponsibleSigned',
];
const memberFields: SocialFieldKey[] = [
  'members[].economy.worksCurrently',
  'members[].economy.occupationOrIncomeSource',
  'members[].economy.incomeAmount',
  'members[].education.attendsSchool',
  'members[].education.schoolLevelOrGrade',
  'members[].education.studyMode',
  'members[].health.spiritualHealth',
  'members[].health.otherSpiritualHealth',
  'members[].health.physicalHealth',
  'members[].health.hasPhysicalHealthProblems',
  'members[].health.physicalHealthProblems',
  'members[].health.generalCondition',
  'members[].health.hasHealthUnit',
  'members[].health.healthUnit',
  'members[].health.hasCommunityHealthAgent',
  'members[].health.communityHealthAgent',
  'members[].medications',
  'members[].religion.participatesInEvangelization',
];

export function familyFormFields(): FieldDefinition[] {
  return [...familyFields, ...memberFields].map((fieldKey) => ({
    fieldKey,
    included: true,
    required: true,
    appliesTo: !fieldKey.startsWith('members[].')
      ? 'FAMILY'
      : fieldKey.startsWith('members[].health') ||
          fieldKey === 'members[].medications' ||
          fieldKey === 'members[].economy.worksCurrently'
        ? 'REFERENCE_MEMBER'
        : fieldKey.startsWith('members[].education') ||
            fieldKey.startsWith('members[].religion')
          ? 'SELECTED_MEMBERS'
          : 'ALL_MEMBERS',
    allowedRoleCodes: ['COORDINATION', 'SOCIAL_ASSISTANCE'],
    cardinality:
      fieldKey === 'members[].medications' ||
      fieldKey === 'needs.declaredNeeds' ||
      fieldKey === 'situation.observations'
        ? 'MULTIPLE'
        : 'SINGLE',
    purpose: 'Cadastro e acompanhamento familiar conforme a ficha de 2025',
    decisionReference: familyFormTemplateCode,
  }));
}

export function validateFamilyFormSource(
  source: SocialFormSource,
  publication: SocialFormPublication,
  referenceId: string | null,
) {
  const reference = source.members.find((row) => row.membership.isReference);
  if (!reference || reference.person.id !== referenceId)
    throw new SocialFormRuleError('INVALID_REFERENCE_MEMBER');
  const required = (value: unknown) =>
    value !== null && value !== undefined && value !== '';
  const beneficiary = publication.members.find(
    (member) => member.personId === referenceId,
  );
  if (
    [
      source.family.address,
      source.family.neighborhood,
      source.family.postalCode,
      reference.person.cpf,
      reference.person.rg,
      reference.person.educationLevel,
      reference.person.contactPhone ?? source.family.contactPhone,
    ].some((value) => !required(value)) ||
    (beneficiary?.economy?.worksCurrently === true &&
      !required(reference.person.occupation))
  )
    throw new SocialFormRuleError('REQUIRED_FIELD_MISSING');
  const childKeys: SocialFieldKey[] = [
    'members[].education.attendsSchool',
    'members[].education.schoolLevelOrGrade',
    'members[].education.studyMode',
    'members[].religion.participatesInEvangelization',
  ];
  let childRows = 0;
  for (const row of source.members) {
    if (
      !required(row.person.birthDate) ||
      (!row.membership.isReference &&
        !required(row.membership.relationshipToReference))
    )
      throw new SocialFormRuleError('REQUIRED_FIELD_MISSING');
    const selected =
      publication.members.find((member) => member.personId === row.person.id)
        ?.selectedFieldKeys ?? [];
    if (!childKeys.some((key) => selected.includes(key))) continue;
    childRows++;
    const sizeRevision = publication.memberRevisions.find(
      (revision) => revision.personId === row.person.id,
    );
    if (
      !childKeys.every((key) => selected.includes(key)) ||
      sizeRevision?.expectedSizeRevision === undefined ||
      sizeRevision.sizeProfilePersonId !== row.sizeProfile?.personId ||
      [
        row.person.sex,
        row.sizeProfile?.shoeSize,
        row.sizeProfile?.clothingSize,
      ].some((value) => !required(value))
    )
      throw new SocialFormRuleError('REQUIRED_FIELD_MISSING');
  }
  const economy = publication.blocks.economy;
  if (
    Number(economy?.declaredChildCount) +
      Number(economy?.declaredAdolescentCount) !==
    childRows
  )
    throw new SocialFormRuleError('INVALID_MEMBERS');
  if (
    publication.blocks.situation?.beneficiarySigned === true &&
    (!publication.acknowledgement ||
      publication.acknowledgement.referencePersonId !== referenceId)
  )
    throw new SocialFormRuleError('INVALID_ACKNOWLEDGEMENT');
  if (
    publication.blocks.situation?.beneficiarySigned === false &&
    publication.acknowledgement
  )
    throw new SocialFormRuleError('INVALID_ACKNOWLEDGEMENT');
}
