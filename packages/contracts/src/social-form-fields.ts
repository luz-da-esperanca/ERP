export const socialFieldKeys = [
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
  'economy.declaredChildCount',
  'economy.declaredAdolescentCount',
  'economy.receivesGovernmentBenefit',
  'economy.governmentBenefitName',
  'needs.declaredNeeds',
  'needs.hasNeeds',
  'needs.otherNeed',
  'situation.text',
  'situation.hasObservations',
  'situation.observations',
  'situation.beneficiarySigned',
  'situation.registrationResponsibleName',
  'situation.registrationResponsibleSigned',
  'members[].economy.worksCurrently',
  'members[].economy.occupationOrIncomeSource',
  'members[].economy.incomeAmount',
  'members[].education.attendsSchool',
  'members[].education.schoolLevelOrGrade',
  'members[].education.studyMode',
  'members[].health.spiritualHealth',
  'members[].health.otherSpiritualHealth',
  'members[].health.physicalHealth',
  'members[].health.physicalHealthProblems',
  'members[].health.hasPhysicalHealthProblems',
  'members[].health.generalCondition',
  'members[].health.healthUnit',
  'members[].health.hasHealthUnit',
  'members[].health.communityHealthAgent',
  'members[].health.hasCommunityHealthAgent',
  'members[].medications',
  'members[].religion.participatesInEvangelization',
] as const;
export type SocialFieldKey = (typeof socialFieldKeys)[number];
export type SocialBlock =
  | 'housing'
  | 'economy'
  | 'needs'
  | 'situation'
  | 'education'
  | 'health'
  | 'medications'
  | 'religion';
export type SocialFieldScope =
  'FAMILY' | 'ALL_MEMBERS' | 'REFERENCE_MEMBER' | 'SELECTED_MEMBERS';
export type SocialCardinality = 'SINGLE' | 'MULTIPLE';
export const featureDecisionCodes = [
  'REAL_PERSONAL_DATA',
  'FIC_HOUSING',
  'FIC_ECONOMY',
  'FIC_NEEDS',
  'FIC_SITUATION',
  'FIC_EDUCATION',
  'FIC_HEALTH',
  'FIC_MEDICATION',
  'FIC_RELIGION',
] as const;
export type FeatureDecisionCode = (typeof featureDecisionCodes)[number];
export interface SocialChoice {
  code: string;
  label?: string;
  otherText?: string | null;
}
export type SocialValue =
  | string
  | number
  | boolean
  | null
  | SocialChoice[]
  | { occurredOn: string; description: string }[]
  | { medicationName: string; providedByGovernment?: boolean | null }[];
export type SocialValues = Record<string, SocialValue>;
export type SocialFormBlocks = Partial<
  Record<'housing' | 'economy' | 'needs' | 'situation', SocialValues>
>;
export type SocialMemberBlocks = Partial<
  Record<'economy' | 'education' | 'health' | 'religion', SocialValues>
> & {
  medications?:
    { medicationName: string; providedByGovernment?: boolean | null }[] | null;
};
