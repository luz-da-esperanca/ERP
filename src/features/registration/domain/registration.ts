import type { DuplicateReview } from './duplicate-rules.js';
export type FamilyLocation = 'URBAN' | 'RURAL';
export interface FamilyFields {
  referenceName: string | null;
  address: string | null;
  neighborhood: string | null;
  postalCode: string | null;
  location: FamilyLocation | null;
  contactPhone: string | null;
}
export interface RegisteredFamily extends FamilyFields {
  id: string;
  code: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
export interface FamilyComposition {
  family: RegisteredFamily & {
    memberCount: number;
    referencePersonName: string | null;
  };
  members: Array<{
    person: RegisteredPerson;
    membership: RegisteredMembership;
  }>;
}
export interface PersonFields {
  name: string;
  birthDate: string | null;
  sex: string | null;
  cpf: string | null;
  rg: string | null;
  occupation: string | null;
  educationLevel: string | null;
  contactPhone: string | null;
}
export interface RegisteredPerson extends PersonFields {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
export interface RegisteredMembership {
  id: string;
  personId: string;
  familyId: string;
  relationshipToReference: string | null;
  isReference: boolean;
  validFrom: string;
  validUntil: string | null;
  revision: number;
}
export interface PersonRegistration {
  person: RegisteredPerson;
  membership: RegisteredMembership;
  family: RegisteredFamily;
}
export interface CreateRegisteredPerson extends PersonFields {
  familyId: string;
  expectedFamilyRevision: number;
  validFrom: string;
  relationshipToReference: string | null;
  isReference: boolean;
}
export interface CreateRegisteredFamily extends FamilyFields {
  duplicateReview?: DuplicateReview;
}
export interface RegistrationPage<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number };
}
export interface PeopleQuery {
  page: number;
  pageSize: number;
  q?: string;
  birthDate?: string;
  cpf?: string;
  familyId?: string;
  asOf: string;
}
export interface ParticipantIdentity {
  id: string;
  name: string;
  family: { id: string; code: string } | null;
}
export type FamilyPatch = Partial<FamilyFields> & { expectedRevision: number };
export interface MembershipTransfer {
  membershipId: string;
  targetFamilyId: string;
  effectiveAt: string;
  expectedMembershipRevision: number;
  expectedSourceFamilyRevision: number;
  expectedTargetFamilyRevision: number;
  relationshipToReference: string | null;
  isReference: boolean;
  reason: string;
}
export interface MembershipTransferResult {
  previousMembership: RegisteredMembership;
  membership: RegisteredMembership;
  sourceFamily: RegisteredFamily;
  targetFamily: RegisteredFamily;
}
export interface ReferenceChange {
  membershipId: string;
  effectiveAt: string;
  expectedRevision: number;
  reason: string;
}
export interface FamiliesQuery {
  page: number;
  pageSize: number;
  q?: string;
  code?: string;
  asOf: string;
}
export type FamilySummary = FamilyComposition['family'];
export type PersonPatch = Partial<PersonFields> & { expectedRevision: number };
export interface SizeProfile {
  personId: string;
  shoeSize: string | null;
  clothingSize: string | null;
  informedOn: string | null;
  revision: number;
}
export type SizesInput = Omit<SizeProfile, 'personId' | 'revision'> & {
  expectedRevision: number | null;
};
export interface PersonDetail {
  person: RegisteredPerson;
  memberships: RegisteredMembership[];
  currentFamily: { id: string; code: string } | null;
  sizeProfile: SizeProfile | null;
}
export interface MembershipClosure {
  expectedRevision: number;
  expectedFamilyRevision: number;
  validUntil: string;
  reason: string;
}
export type MembershipCorrection = Partial<
  Pick<
    RegisteredMembership,
    'validFrom' | 'validUntil' | 'relationshipToReference' | 'isReference'
  >
> & {
  expectedRevision: number;
  expectedFamilyRevision: number;
  reason: string;
};
