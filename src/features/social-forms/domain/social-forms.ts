import type { Role } from '@erp/contracts/access';
import type {
  SocialFieldKey,
  SocialFieldScope,
  SocialCardinality,
  FeatureDecisionCode,
  SocialFormBlocks,
  SocialMemberBlocks,
} from '@erp/contracts/social-form-fields';
import type {
  RegisteredFamily,
  RegisteredPerson,
  RegisteredMembership,
  SizeProfile,
} from '../../registration/domain/registration.js';
import type {
  ProtectedSocialBlock,
  ProtectedPayload,
} from './protected-payload.js';

export interface FieldDefinition {
  fieldKey: SocialFieldKey;
  included: boolean;
  required: boolean;
  appliesTo: SocialFieldScope;
  allowedRoleCodes: Role[];
  cardinality: SocialCardinality;
  purpose: string;
  decisionReference: string;
}
export interface FieldSelection {
  id: string;
  version: number;
  recordedAt: string;
  recordedBy: string;
  fields: FieldDefinition[];
  decisionReference: string;
}
export interface SocialOption {
  id: string;
  fieldKey: SocialFieldKey;
  code: string;
  label: string;
  active: boolean;
  isOther: boolean;
  revision: number;
}
export interface FeatureDecision {
  id: string;
  code: FeatureDecisionCode;
  enabled: boolean;
  decisionReference: string;
  decidedAt: string;
  decidedBy: string;
  revision: number;
}
export interface MemberSocialValues {
  personId: string;
  isReference: boolean;
  selectedFieldKeys: SocialFieldKey[];
  blocks: SocialMemberBlocks;
}
export interface SocialValuesInput {
  fields: FieldDefinition[];
  enabledCodes: FeatureDecisionCode[];
  roles: Role[];
  blocks: SocialFormBlocks;
  members: MemberSocialValues[];
  options: SocialOption[];
}
export interface SocialFormSource {
  family: RegisteredFamily;
  familyIds: string[];
  members: Array<{
    person: RegisteredPerson;
    membership: RegisteredMembership;
    sizeProfile: SizeProfile | null;
  }>;
  latestPublishedFormId: string | null;
  expectedPreviousVersionId: string | null;
  previousVersion: number;
}
export interface SocialFormPublication {
  occurredAt: string;
  expectedFamilyRevision: number;
  expectedPreviousVersionId: string | null;
  fieldSelectionVersionId: string;
  memberRevisions: Array<{
    personId: string;
    expectedPersonRevision: number;
    membershipId: string;
    expectedMembershipRevision: number;
    sizeProfilePersonId?: string | null;
    expectedSizeRevision?: number | null;
  }>;
  referencePersonId?: string | null;
  blocks: SocialFormBlocks;
  members: Array<
    SocialMemberBlocks & {
      personId: string;
      selectedFieldKeys?: SocialFieldKey[];
    }
  >;
  acknowledgement?: {
    referencePersonId: string;
    method: 'PAPER_SIGNATURE';
    acknowledgedOn: string;
  };
  correctionOfFormId?: string;
  reason?: string;
}
export interface FormMember {
  id: string;
  socialFormId: string;
  personId: string;
  membershipId: string;
  membershipRevision: number;
  personSnapshot: Pick<
    RegisteredPerson,
    'id' | 'name' | 'birthDate' | 'sex' | 'revision'
  > &
    Partial<
      Pick<
        RegisteredPerson,
        'cpf' | 'rg' | 'occupation' | 'educationLevel' | 'contactPhone'
      >
    >;
  relationshipSnapshot: {
    isReference: boolean;
    relationshipToReference: string | null;
  };
  sizeProfilePersonId: string | null;
  sizeRevision: number | null;
  sizeSnapshot: SizeProfile | null;
  selectedFieldKeys: SocialFieldKey[];
  blocks: SocialMemberBlocks;
  protectedBlocks?: Partial<Record<ProtectedSocialBlock, ProtectedPayload>>;
}
export type SocialFormSummary = Pick<
  StoredSocialForm,
  | 'id'
  | 'familyId'
  | 'version'
  | 'previousVersionId'
  | 'correctionOfFormId'
  | 'occurredAt'
  | 'recordedAt'
  | 'recordedBy'
  | 'fieldSelectionVersionId'
  | 'originFamilyId'
  | 'originalVersion'
>;
export interface SocialFormListQuery {
  page: number;
  pageSize: number;
  orderBy: 'recordedAt' | 'occurredAt';
}
export interface Acknowledgement {
  id: string;
  socialFormId: string;
  referencePersonId: string;
  method: 'PAPER_SIGNATURE';
  acknowledgedOn: string;
  recordedAt: string;
  recordedBy: string;
  revision: number;
}
export interface StoredSocialForm {
  id: string;
  familyId: string;
  version: number;
  previousVersionId: string | null;
  correctionOfFormId: string | null;
  referenceMemberId: string | null;
  occurredAt: string;
  recordedAt: string;
  recordedBy: string;
  familySnapshot: RegisteredFamily;
  fieldSelectionVersionId: string;
  originFamilyId: string | null;
  originalVersion: number | null;
  reason: string | null;
  blocks: SocialFormBlocks;
  members: FormMember[];
  acknowledgement: Acknowledgement | null;
}
export type SocialEntity =
  | 'FieldSelectionVersion'
  | 'FeatureDecision'
  | 'SocialFormOption'
  | 'SocialForm'
  | 'Acknowledgement';
export type SocialSnapshot =
  | FieldSelection
  | FeatureDecision
  | SocialOption
  | StoredSocialForm
  | Acknowledgement;
