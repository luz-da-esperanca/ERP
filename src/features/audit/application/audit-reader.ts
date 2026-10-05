import type {
  AccountAuditAction,
  AccountAuditEntry,
} from '../domain/account-audit.js';

export interface AuditQueryInput {
  entityType: 'UserAccount';
  page: number;
  pageSize: number;
  entityId?: string;
  actorId?: string;
  from?: string;
  to?: string;
  action?: AccountAuditAction;
}
export interface AccountAuditPage {
  data: AccountAuditEntry[];
  pagination: { page: number; pageSize: number; total: number };
}
export interface AuditReader {
  list(input: AuditQueryInput): Promise<AccountAuditPage>;
  get(id: string): Promise<AccountAuditEntry | null>;
}
