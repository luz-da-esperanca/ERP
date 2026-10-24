import { computePayloadDigest, validateAndBuildAuditEntry, type AuditEntry, type AuditRecordInput, type AuditTrailPort, type IdempotencyPort, type IdempotentExecutionRequest, type IdempotentExecutionResult } from '../audit-and-idempotency.ts';
import { invalidRequestError, idempotencyConflictError } from '../errors.ts';
import { isUuidV4OrV7 } from '../identifiers-and-time.ts';
import { hashPassword, matchesSecret } from './secret-hasher.ts';

export class InMemoryAuditTrail implements AuditTrailPort {
  private readonly entries: AuditEntry[] = [];
  private readonly clock: () => Date;

  constructor(clock: () => Date = () => new Date()) {
    this.clock = clock;
  }

  async record(input: AuditRecordInput): Promise<AuditEntry> {
    const entry = validateAndBuildAuditEntry(input, this.clock);
    this.entries.push(entry);
    return entry;
  }

  async listByEntity(entityType: string, entityId: string): Promise<readonly AuditEntry[]> {
    return this.entries.filter(
      (entry) => entry.entityType === entityType && entry.entityId === entityId,
    );
  }

  checkpoint(): () => void {
    const entries = structuredClone(this.entries);
    return () => { this.entries.splice(0, this.entries.length, ...entries); };
  }

  all(): readonly AuditEntry[] {
    return [...this.entries];
  }
}

interface StoredIdempotencyRecord {
  readonly secretHash: string | null;
  readonly payloadDigest: string;
  readonly statusCode: number;
  readonly body: unknown;
}

export class InMemoryIdempotencyStore implements IdempotencyPort {
  private readonly records = new Map<string, StoredIdempotencyRecord>();
  private readonly pending = new Map<string, Promise<void>>();

  checkpoint(): () => void {
    const records = structuredClone(this.records);
    return () => {
      this.records.clear();
      for (const [key, value] of records) this.records.set(key, value);
    };
  }

  async execute<T>(request: IdempotentExecutionRequest<T>): Promise<IdempotentExecutionResult<T>> {
    if (!isUuidV4OrV7(request.operationId)) {
      throw invalidRequestError(
        'O cabeçalho Idempotency-Key é obrigatório e deve ser um UUID v4 ou v7 válido.',
      );
    }

    const compositeKey = `${request.operationType}:${request.actorId}:${request.operationId.toLowerCase()}`;
    const payloadDigest = computePayloadDigest(request.payload);
    const pending = this.pending.get(compositeKey);
    if (pending) {
      await pending;
      return this.execute(request);
    }
    let release = () => {};
    this.pending.set(compositeKey, new Promise<void>((resolve) => { release = resolve; }));
    try {
      const existing = this.records.get(compositeKey);

      if (existing) {
        if (existing.payloadDigest !== payloadDigest || !matchesSecret(existing.secretHash, request.secret)) {
          throw idempotencyConflictError();
        }
        return {
          statusCode: existing.statusCode,
          // The matching operation scope/digest binds this stored result to its original response contract; persistence erases T.
        body: existing.body as T,
          replayed: true,
        };
      }

      const outcome = await request.run();
      this.records.set(compositeKey, {
        secretHash: request.secret === undefined ? null : hashPassword(request.secret),
        payloadDigest,
        statusCode: outcome.statusCode,
        body: outcome.body,
      });

      return {
        statusCode: outcome.statusCode,
        body: outcome.body,
        replayed: false,
      };
    } finally {
      this.pending.delete(compositeKey);
      release();
    }
  }
}
