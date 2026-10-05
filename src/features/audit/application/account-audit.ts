import type { Account } from '../../access/domain/account.js';
import type { AccountAuditAction } from '../domain/account-audit.js';
export type { AccountAuditAction } from '../domain/account-audit.js';

export interface AccountAuditChange {
  operationId: string;
  actorId: string | null;
  action: AccountAuditAction;
  before: Account | null;
  after: Account;
  reason?: string;
}

export interface AccountAuditWriter {
  append(input: AccountAuditChange): Promise<void>;
  readRevision(id: string, revision: number): Promise<Account>;
}
