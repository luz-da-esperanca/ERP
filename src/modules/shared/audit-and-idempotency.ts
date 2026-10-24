import { requireChangeReason } from './change-reason.ts';
import { createHash } from 'node:crypto';
import {
  invalidRequestError,
  validationFailedError,
} from './errors.ts';
import {
  currentBusinessDateInSaoPaulo,
  generateUuidV7,
  isUuidV4OrV7,
  isValidIsoCalendarDate,
} from './identifiers-and-time.ts';

const SENSITIVE_AUDIT_KEYS = new Set([
  'password',
  'passwordHash',
  'sessionToken',
  'tokenHash',
  'secret',
  'secretHash',
  'rawToken',
  'token',
  'authorization',
]);

const ACTIONS_REQUIRING_REASON = new Set([
  'UPDATE',
  'CLOSE',
  'DEACTIVATE',
  'UPDATE_PROFILES',
  'REVERSE',
]);

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'CLOSE'
  | 'DEACTIVATE'
  | 'UPDATE_PROFILES'
  | 'REVERSE';

export interface AuditRecordInput {
  readonly actorId: string;
  readonly factDate?: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly action: AuditAction;
  readonly before?: Record<string, unknown> | null;
  readonly after?: Record<string, unknown> | null;
  readonly reason?: string | null;
  readonly operationId?: string | null;
}

export interface AuditEntry {
  readonly id: string;
  readonly actorId: string;
  readonly factDate: string;
  readonly recordedAt: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly action: AuditAction;
  readonly before: Record<string, unknown> | null;
  readonly after: Record<string, unknown> | null;
  readonly reason: string | null;
  readonly operationId: string | null;
}

export interface AuditTrailPort {
  record(input: AuditRecordInput): Promise<AuditEntry>;
  listByEntity(entityType: string, entityId: string): Promise<readonly AuditEntry[]>;
}

function sanitizeAuditSnapshot(
  snapshot: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!snapshot) return null;
  return Object.fromEntries(Object.entries(snapshot)
    .filter(([key]) => !SENSITIVE_AUDIT_KEYS.has(key))
    .map(([key, value]) => [key, sanitizeAuditValue(value)]));
}

function sanitizeAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeAuditValue);
  if (value !== null && typeof value === 'object') {
    return sanitizeAuditSnapshot(Object.fromEntries(Object.entries(value)));
  }
  return value;
}

export function validateAndBuildAuditEntry(
  input: AuditRecordInput,
  clock: () => Date = () => new Date(),
): AuditEntry {
  const now = clock();
  const factDate = input.factDate ?? currentBusinessDateInSaoPaulo(now);

  if (!isValidIsoCalendarDate(factDate)) {
    throw validationFailedError([
      {
        field: 'factDate',
        code: 'INVALID_FORMAT',
        message: 'A data do fato deve ser uma data de calendário válida no formato AAAA-MM-DD.',
      },
    ]);
  }

  const trimmedReason = input.reason === null || input.reason === undefined ? null : requireChangeReason(input.reason);
  if (ACTIONS_REQUIRING_REASON.has(input.action) && trimmedReason === null) requireChangeReason(input.reason);

  return {
    id: generateUuidV7(now.getTime()),
    actorId: input.actorId,
    factDate,
    recordedAt: now.toISOString(),
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    before: sanitizeAuditSnapshot(input.before),
    after: sanitizeAuditSnapshot(input.after),
    reason: trimmedReason,
    operationId: input.operationId ?? null,
  };
}

export interface IdempotentExecutionRequest<T> {
  readonly secret?: string;
  readonly operationType: string;
  readonly actorId: string;
  readonly operationId: string;
  readonly payload: unknown;
  readonly run: () => Promise<{ readonly statusCode: number; readonly body: T }>;
}

export interface IdempotentExecutionResult<T> {
  readonly statusCode: number;
  readonly body: T;
  readonly replayed: boolean;
}

export interface IdempotencyPort {
  execute<T>(request: IdempotentExecutionRequest<T>): Promise<IdempotentExecutionResult<T>>;
}

function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeValue(item));
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sortedKeys = Object.keys(record).sort();
    const normalized: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      if (record[key] !== undefined) {
        normalized[key] = canonicalizeValue(record[key]);
      }
    }
    return normalized;
  }
  return value;
}

export function computePayloadDigest(payload: unknown): string {
  const canonicalJson = JSON.stringify(canonicalizeValue(payload ?? null));
  return createHash('sha256').update(canonicalJson).digest('hex');
}

export function requireIdempotencyKey(headerValue: string | readonly string[] | undefined): string {
  const key = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const trimmed = typeof key === 'string' ? key.trim() : '';
  if (!isUuidV4OrV7(trimmed)) {
    throw invalidRequestError(
      'O cabeçalho Idempotency-Key é obrigatório e deve ser um UUID v4 ou v7 válido.',
    );
  }
  return trimmed.toLowerCase();
}
