import type { Principal } from '../../access/application/ports.js';
import type {
  FieldSelection,
  FeatureDecision,
  SocialOption,
  SocialEntity,
  SocialSnapshot,
} from '../domain/social-forms.js';
import type {
  SocialFormSource,
  StoredSocialForm,
  Acknowledgement,
  SocialFormListQuery,
  SocialFormSummary,
} from '../domain/social-forms.js';
export type { SocialEntity, SocialSnapshot } from '../domain/social-forms.js';

export interface SocialConfiguration {
  selection: FieldSelection | null;
  decisions: FeatureDecision[];
  options: SocialOption[];
}
export interface SocialOperationReference {
  entityType: SocialEntity;
  id: string;
  revision: number;
}
export interface SocialFormsReadTransaction {
  configuration(): Promise<SocialConfiguration>;
  context(
    familyId: string,
    occurredAt: string,
  ): Promise<SocialFormSource | null>;
  selection(id: string): Promise<FieldSelection | null>;
  form(id: string): Promise<StoredSocialForm | null>;
  forms(
    familyId: string,
    query: SocialFormListQuery,
  ): Promise<{
    data: SocialFormSummary[];
    pagination: { page: number; pageSize: number; total: number };
  } | null>;
}
export interface SocialFormsTransaction extends SocialFormsReadTransaction {
  findActor(id: string): Promise<Principal | null>;
  findOperation(
    type: string,
    key: string,
  ): Promise<{
    actorId: string | null;
    fingerprint: string;
    fingerprintKeyId: string;
    reference: SocialOperationReference;
  } | null>;
  createOperation(
    type: string,
    key: string,
    actorId: string,
    fingerprint: string,
    fingerprintKeyId: string,
  ): Promise<string>;
  completeOperation(
    id: string,
    reference: SocialOperationReference,
  ): Promise<void>;
  readRevision(reference: SocialOperationReference): Promise<SocialSnapshot>;
  saveSelection(selection: FieldSelection): Promise<void>;
  saveDecision(decision: FeatureDecision): Promise<void>;
  saveOption(option: SocialOption): Promise<void>;
  createForm(form: StoredSocialForm): Promise<void>;
  saveAcknowledgement(acknowledgement: Acknowledgement): Promise<void>;
  audit(input: {
    operationId: string;
    actorId: string;
    entityType: SocialEntity;
    before: SocialSnapshot | null;
    after: SocialSnapshot;
    reason?: string;
    occurredAt?: string;
    action: 'CREATE' | 'UPDATE' | 'CORRECT';
  }): Promise<void>;
}
export interface SocialFormsRepository {
  read<T>(work: (tx: SocialFormsReadTransaction) => Promise<T>): Promise<T>;
  run<T>(
    actorId: string,
    work: (tx: SocialFormsTransaction) => Promise<T>,
  ): Promise<T>;
}
