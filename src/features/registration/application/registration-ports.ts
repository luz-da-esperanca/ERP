import type {
  RegisteredFamily,
  FamilyFields,
  FamilyComposition,
  RegisteredPerson,
  PersonFields,
  RegisteredMembership,
  PeopleQuery,
  RegistrationPage,
  ParticipantIdentity,
} from '../domain/registration.js';
import type { Principal } from '../../access/application/ports.js';
import type {
  DuplicateQuery,
  DuplicateRecord,
  DuplicateReview,
  RegistrationEntity,
} from '../domain/duplicate-rules.js';
import type {
  FamiliesQuery,
  FamilySummary,
  PersonDetail,
  SizeProfile,
} from '../domain/registration.js';
import type { QualityIssue, QualityQuery } from '../domain/data-quality.js';

export interface RegistrationTransaction {
  recordPossibleDuplicates(
    operationId: string,
    actorId: string,
    entityType: RegistrationEntity,
    entityId: string,
    candidateIds: string[],
  ): Promise<void>;
  findQualityIssue(id: string): Promise<QualityIssue | null>;
  resolveQualityIssue(
    id: string,
    actorId: string,
    reason: string,
  ): Promise<QualityIssue>;
  readQualityRevision(id: string, revision: number): Promise<QualityIssue>;
  appendQualityResolutionAudit(
    operationId: string,
    actorId: string,
    before: QualityIssue,
    after: QualityIssue,
  ): Promise<void>;
  findPerson(id: string): Promise<RegisteredPerson | null>;
  updatePerson(
    id: string,
    changes: Partial<PersonFields>,
  ): Promise<RegisteredPerson>;
  appendPersonUpdateAudit(
    operationId: string,
    actorId: string,
    before: RegisteredPerson,
    after: RegisteredPerson,
  ): Promise<void>;
  sizeProfile(personId: string): Promise<SizeProfile | null>;
  saveSizes(input: SizeProfile): Promise<SizeProfile>;
  readSizeRevision(personId: string, revision: number): Promise<SizeProfile>;
  appendSizesAudit(
    operationId: string,
    actorId: string,
    before: SizeProfile | null,
    after: SizeProfile,
  ): Promise<void>;
  findMembership(id: string): Promise<RegisteredMembership | null>;
  updateMembership(
    id: string,
    changes: Partial<
      Omit<RegisteredMembership, 'id' | 'personId' | 'familyId' | 'revision'>
    >,
  ): Promise<RegisteredMembership>;
  appendMembershipUpdateAudit(
    operationId: string,
    actorId: string,
    before: RegisteredMembership,
    after: RegisteredMembership,
    reason: string,
    action: 'CLOSE' | 'CORRECT',
    occurredAt: string,
  ): Promise<void>;
  duplicateRecords(query: DuplicateQuery): Promise<DuplicateRecord[]>;
  recordDuplicateReview(
    operationId: string,
    actorId: string,
    entityType: RegistrationEntity,
    entityId: string,
    review: DuplicateReview,
  ): Promise<void>;
  findOperation(
    type: string,
    key: string,
  ): Promise<{
    actorId: string | null;
    fingerprint: string;
    resultReference: RegistrationReference;
  } | null>;
  readFamilyRevision(id: string, revision: number): Promise<RegisteredFamily>;
  readPersonRevision(id: string, revision: number): Promise<RegisteredPerson>;
  readMembershipRevision(
    id: string,
    revision: number,
  ): Promise<RegisteredMembership>;
  findFamily(id: string): Promise<RegisteredFamily | null>;
  memberships(
    familyIds: readonly string[],
    personIds?: readonly string[],
  ): Promise<RegisteredMembership[]>;
  createPerson(input: PersonFields): Promise<RegisteredPerson>;
  createMembership(
    input: Omit<RegisteredMembership, 'id' | 'revision'>,
  ): Promise<RegisteredMembership>;
  reviseFamily(id: string): Promise<RegisteredFamily>;
  updateFamily(
    id: string,
    changes: Partial<FamilyFields>,
  ): Promise<RegisteredFamily>;
  appendPersonAudit(
    operationId: string,
    actorId: string,
    person: RegisteredPerson,
  ): Promise<void>;
  appendMembershipAudit(
    operationId: string,
    actorId: string,
    membership: RegisteredMembership,
  ): Promise<void>;
  appendFamilyUpdateAudit(
    operationId: string,
    actorId: string,
    before: RegisteredFamily,
    after: RegisteredFamily,
  ): Promise<void>;
  findActor(id: string): Promise<Principal | null>;
  createFamily(input: FamilyFields): Promise<RegisteredFamily>;
  appendFamilyAudit(
    operationId: string,
    actorId: string,
    family: RegisteredFamily,
  ): Promise<void>;
  createOperation(
    type: string,
    key: string,
    actorId: string,
    fingerprint: string,
  ): Promise<string>;
  completeOperation(
    id: string,
    reference: RegistrationReference,
  ): Promise<void>;
}
export interface RevisionReference {
  entityType: string;
  entityId: string;
  revision: number;
}
export type RegistrationReference =
  | RevisionReference
  | {
      person: RevisionReference;
      membership: RevisionReference;
      family: RevisionReference;
    }
  | {
      previousMembership: RevisionReference;
      membership: RevisionReference;
      sourceFamily: RevisionReference;
      targetFamily: RevisionReference;
    }
  | { family: RevisionReference; memberships: RevisionReference[] };
export interface RegistrationUnitOfWork {
  run<T>(
    actorId: string,
    familyIds: readonly string[],
    work: (tx: RegistrationTransaction) => Promise<T>,
    personIds?: readonly string[],
  ): Promise<T>;
}
export interface RegistrationReader {
  qualityIssues(query: QualityQuery): Promise<RegistrationPage<QualityIssue>>;
  families(query: FamiliesQuery): Promise<RegistrationPage<FamilySummary>>;
  person(
    id: string,
    asOf: string,
    minimal: boolean,
  ): Promise<PersonDetail | ParticipantIdentity | null>;
  membership(id: string): Promise<RegisteredMembership | null>;
  people(
    query: PeopleQuery,
    minimal: boolean,
  ): Promise<RegistrationPage<RegisteredPerson | ParticipantIdentity>>;
  duplicateRecords(query: DuplicateQuery): Promise<DuplicateRecord[]>;
  family(id: string, asOf: string): Promise<FamilyComposition | null>;
}
