import type { Principal } from '../../access/application/ports.js';
import type { ActivityNature } from '../../projects/domain/projects.js';
import type {
  EligibilityAssessment,
  EligibilityEntity,
  EligibilityPolicy,
  EligibilityReference,
  EligibilitySnapshot,
  EvidenceSnapshot,
} from '../domain/eligibility.js';

export interface EligibilityReaderPorts {
  policies(): Promise<EligibilityPolicy[]>;
  assessment(id: string): Promise<EligibilityAssessment | null>;
  familyExists(id: string): Promise<boolean>;
  activities(
    ids: readonly string[],
  ): Promise<{ id: string; nature: ActivityNature }[]>;
  evidence(
    familyId: string,
    activityIds: readonly string[],
  ): Promise<EvidenceSnapshot>;
}
export interface EligibilityTransaction extends EligibilityReaderPorts {
  actor(id: string): Promise<Principal | null>;
  operation(
    type: string,
    key: string,
  ): Promise<{
    actorId: string | null;
    fingerprint: string;
    reference: EligibilityReference;
  } | null>;
  createOperation(
    type: string,
    key: string,
    actorId: string,
    fingerprint: string,
  ): Promise<string>;
  completeOperation(id: string, reference: EligibilityReference): Promise<void>;
  createPolicy(
    input: Omit<EligibilityPolicy, 'id' | 'recordedAt'>,
  ): Promise<EligibilityPolicy>;
  createAssessment(
    input: Omit<EligibilityAssessment, 'id'>,
  ): Promise<EligibilityAssessment>;
  audit(
    operationId: string,
    actorId: string,
    entityType: EligibilityEntity,
    after: EligibilitySnapshot,
    reason?: string,
  ): Promise<void>;
}
export interface EligibilityReader {
  read<T>(work: (ports: EligibilityReaderPorts) => Promise<T>): Promise<T>;
}
export interface EligibilityUnitOfWork {
  run<T>(
    actorId: string,
    work: (ports: EligibilityTransaction) => Promise<T>,
  ): Promise<T>;
}
