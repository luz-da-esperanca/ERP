import type { Account } from '../../access/domain/account.js';

export type AccountAuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'ACTIVATE'
  | 'DEACTIVATE'
  | 'PASSWORD_CHANGE'
  | 'PASSWORD_RESET';
export type AuditActorType = 'USER' | 'SYSTEM_BOOTSTRAP';
export interface AccountAuditSnapshot extends Account {
  passwordChanged?: boolean;
}
export interface AuditActor {
  id: string;
  displayName: string;
  active: boolean;
}
export interface AccountAuditEntry {
  id: string;
  operationId: string;
  entityType: 'UserAccount';
  entityId: string;
  revision: number;
  action: AccountAuditAction;
  actorType: AuditActorType;
  actorId: string | null;
  actor: AuditActor | null;
  recordedAt: string;
  occurredAt: string | null;
  before: AccountAuditSnapshot | null;
  after: AccountAuditSnapshot;
  reason: string | null;
  classification: 'ACCOUNTS';
}
