import type {
  CreatePersonInput,
  Family,
  FamilyDetail,
  FamilyInput,
  FamilySummary,
  Person,
  PersonDetail,
} from '@erp/contracts/registration';
import type { z } from 'zod';
import type { duplicateCandidateSchema } from '@erp/contracts/registration-api';
export type DuplicateCandidate = z.infer<typeof duplicateCandidateSchema>;
export interface TransferInput {
  personId: string;
  membershipId: string;
  targetFamilyId: string;
  effectiveAt: string;
  expectedPersonRevision: number;
  expectedSourceRevision: number;
  expectedTargetRevision: number;
  reason: string;
}
export interface RegistrationGateway {
  listFamilies(query?: string): Promise<FamilySummary[]>;
  getFamily(id: string, asOf: string): Promise<FamilyDetail>;
  createFamily(input: FamilyInput): Promise<Family>;
  updateFamily(
    id: string,
    revision: number,
    input: FamilyInput,
  ): Promise<Family>;
  listPeople(query?: string): Promise<Person[]>;
  getPerson(id: string): Promise<PersonDetail>;
  createPerson(input: CreatePersonInput): Promise<Person>;
  transfer(input: TransferInput): Promise<void>;
}
