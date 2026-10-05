import type { AccountAuditAction } from '../domain/account-audit.js';
import type {
  AuditEntity,
  AuditEntry,
  RegistrationAuditAction,
  AttendanceAuditAction,
} from '../domain/audit-entry.js';

export interface AuditQueryInput {
  entityType: AuditEntity;
  page: number;
  pageSize: number;
  entityId?: string;
  actorId?: string;
  from?: string;
  to?: string;
  action?: AccountAuditAction | RegistrationAuditAction | AttendanceAuditAction;
}
export interface AuditPage {
  data: AuditEntry[];
  pagination: { page: number; pageSize: number; total: number };
}
export interface AuditReader {
  list(input: AuditQueryInput): Promise<AuditPage>;
  get(
    id: string,
    entityTypes?: readonly AuditEntity[],
  ): Promise<AuditEntry | null>;
}
