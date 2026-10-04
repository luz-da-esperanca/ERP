import type { Capability } from './access';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'CORRECT'
  | 'CLOSE'
  | 'CANCEL'
  | 'PUBLISH'
  | 'ACTIVATE'
  | 'DEACTIVATE';
export interface AuditEntry {
  id: string;
  entityId: string;
  entityLabel: string;
  action: AuditAction;
  actorId: string;
  actorName: string;
  recordedAt: string;
  occurredAt: string | null;
  reason: string | null;
  readCapability: Capability;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
}
