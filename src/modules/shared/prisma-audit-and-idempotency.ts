import { Prisma, type PrismaClient } from '../../server/generated/prisma/client.ts';
import {
  computePayloadDigest,
  validateAndBuildAuditEntry,
  type AuditAction,
  type AuditEntry,
  type AuditRecordInput,
  type AuditTrailPort,
  type IdempotencyPort,
  type IdempotentExecutionRequest,
  type IdempotentExecutionResult,
} from './audit-and-idempotency.ts';
import { idempotencyConflictError, invalidRequestError } from './errors.ts';
import { isUuidV4OrV7 } from './identifiers-and-time.ts';

export class PrismaAuditTrail implements AuditTrailPort {
  private readonly client: PrismaClient;
  private readonly clock: () => Date;

  constructor(client: PrismaClient, clock: () => Date = () => new Date()) {
    this.client = client;
    this.clock = clock;
  }

  async record(input: AuditRecordInput): Promise<AuditEntry> {
    const entry = validateAndBuildAuditEntry(input, this.clock);
    await this.client.auditEntryRecord.create({
      data: {
        id: entry.id,
        actorId: entry.actorId,
        factDate: entry.factDate,
        recordedAt: new Date(entry.recordedAt),
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        beforeJson:
          entry.before === null
            ? Prisma.DbNull
            : (entry.before as Prisma.InputJsonObject),
        afterJson:
          entry.after === null
            ? Prisma.DbNull
            : (entry.after as Prisma.InputJsonObject),
        reason: entry.reason,
        operationId: entry.operationId,
      },
    });
    return entry;
  }

  async listByEntity(entityType: string, entityId: string): Promise<readonly AuditEntry[]> {
    const rows = await this.client.auditEntryRecord.findMany({
      where: { entityType, entityId },
      orderBy: { recordedAt: 'asc' },
    });

    return rows.map((row) => ({
      id: row.id,
      actorId: row.actorId,
      factDate: row.factDate,
      recordedAt: row.recordedAt.toISOString(),
      entityType: row.entityType,
      entityId: row.entityId,
      action: row.action as AuditAction,
      before:
        row.beforeJson !== null && typeof row.beforeJson === 'object' && !Array.isArray(row.beforeJson)
          ? (row.beforeJson as Record<string, unknown>)
          : null,
      after:
        row.afterJson !== null && typeof row.afterJson === 'object' && !Array.isArray(row.afterJson)
          ? (row.afterJson as Record<string, unknown>)
          : null,
      reason: row.reason,
      operationId: row.operationId,
    }));
  }
}

export class PrismaIdempotencyStore implements IdempotencyPort {
  private readonly client: PrismaClient;
  private readonly clock: () => Date;

  constructor(client: PrismaClient, clock: () => Date = () => new Date()) {
    this.client = client;
    this.clock = clock;
  }

  async execute<T>(request: IdempotentExecutionRequest<T>): Promise<IdempotentExecutionResult<T>> {
    if (!isUuidV4OrV7(request.operationId)) {
      throw invalidRequestError(
        'O cabeçalho Idempotency-Key é obrigatório e deve ser um UUID v4 ou v7 válido.',
      );
    }

    const operationId = request.operationId.toLowerCase();
    const payloadDigest = computePayloadDigest(request.payload);

    const existing = await this.client.operationConfirmation.findUnique({
      where: {
        operationType_actorId_operationId: {
          operationType: request.operationType,
          actorId: request.actorId,
          operationId,
        },
      },
    });

    if (existing) {
      if (existing.payloadDigest !== payloadDigest) {
        throw idempotencyConflictError();
      }
      return {
        statusCode: existing.statusCode,
        body: existing.responseBody as T,
        replayed: true,
      };
    }

    const outcome = await request.run();

    await this.client.operationConfirmation.create({
      data: {
        operationType: request.operationType,
        actorId: request.actorId,
        operationId,
        payloadDigest,
        statusCode: outcome.statusCode,
        responseBody: outcome.body as Prisma.InputJsonValue,
        createdAt: this.clock(),
      },
    });

    return {
      statusCode: outcome.statusCode,
      body: outcome.body,
      replayed: false,
    };
  }
}

