import type {
  SocialFormBlocks,
  SocialMemberBlocks,
} from '@erp/contracts/social-form-fields';

export const fixedFamilyBlocks: SocialFormBlocks = {
  housing: {
    housingTenure: [{ code: 'OWNED' }],
    location: [{ code: 'URBAN' }],
    roomCount: 3,
    bedroomCount: 1,
    riskArea: false,
    dwellingType: [{ code: 'HOUSE' }],
    construction: [{ code: 'BRICK_PLASTERED' }],
    floorType: [{ code: 'CEMENT' }],
    electricity: [{ code: 'BILL_PAID' }],
    waterSupply: [{ code: 'BILL_PAID' }],
    waterTreatment: [{ code: 'FILTERED' }],
    sewage: [{ code: 'SEWER' }],
    wasteDisposal: [{ code: 'COLLECTED' }],
    transportation: [{ code: 'PUBLIC_TRANSPORT' }],
    hygiene: [{ code: 'GOOD' }],
  },
  economy: {
    declaredWorkerCount: 0,
    declaredPensionerCount: 0,
    declaredChildCount: 0,
    declaredAdolescentCount: 0,
    receivesGovernmentBenefit: false,
    governmentBenefitName: null,
  },
  needs: { hasNeeds: false, declaredNeeds: [], otherNeed: null },
  situation: {
    text: 'Synthetic family situation',
    hasObservations: false,
    observations: [],
    beneficiarySigned: false,
    registrationResponsibleName: 'Synthetic operator',
    registrationResponsibleSigned: false,
  },
};
export const fixedReferenceBlocks: SocialMemberBlocks = {
  economy: {
    worksCurrently: false,
    occupationOrIncomeSource: 'Sem ocupação',
    incomeAmount: '0.00',
  },
  health: {
    spiritualHealth: 'EQUILIBRATED',
    otherSpiritualHealth: null,
    physicalHealth: 'GOOD',
    hasPhysicalHealthProblems: false,
    physicalHealthProblems: null,
    generalCondition: 'Synthetic general condition',
    hasHealthUnit: false,
    healthUnit: null,
    hasCommunityHealthAgent: false,
    communityHealthAgent: null,
  },
  medications: [],
};
