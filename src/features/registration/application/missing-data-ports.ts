import type {
  MissingDataSelection,
  QualityIssue,
  QualityResolution,
} from '../domain/data-quality.js';
import type { RegistrationEntity } from '../domain/duplicate-rules.js';
import type { Principal } from '../../access/application/ports.js';
import type { RegistrationTransaction } from './registration-ports.js';

export interface MissingDataTransaction {
  selection(): Promise<MissingDataSelection | null>;
  openIssues(
    entityType: RegistrationEntity,
    entityId: string,
  ): Promise<QualityIssue[]>;
  createIssue(
    operationId: string,
    actorId: string,
    entityType: RegistrationEntity,
    entityId: string,
    fieldKey: string,
  ): Promise<void>;
  closeIssue(
    operationId: string,
    actorId: string,
    issue: QualityIssue,
    resolution: QualityResolution,
    reason?: string,
  ): Promise<void>;
}
export interface MissingDataSelectionTransaction {
  missingData: MissingDataTransaction;
  findActor(id: string): Promise<Principal | null>;
  findOperation: RegistrationTransaction['findOperation'];
  createOperation: RegistrationTransaction['createOperation'];
  completeOperation: RegistrationTransaction['completeOperation'];
  selectionRevision(id: string): Promise<MissingDataSelection>;
  publishSelection(
    input: Omit<MissingDataSelection, 'id'>,
  ): Promise<MissingDataSelection>;
  entities(): Promise<
    { entityType: RegistrationEntity; id: string; fields: object }[]
  >;
  auditSelection(
    operationId: string,
    actorId: string,
    selection: MissingDataSelection,
  ): Promise<void>;
}
export interface MissingDataSelectionStore {
  current(): Promise<MissingDataSelection | null>;
  run<T>(
    actorId: string,
    work: (tx: MissingDataSelectionTransaction) => Promise<T>,
  ): Promise<T>;
}
