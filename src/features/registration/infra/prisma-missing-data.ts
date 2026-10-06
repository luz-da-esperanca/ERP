import {
  missingDataSelectionSchema,
  dataQualityIssueSchema,
} from '@erp/contracts/data-quality-api';
import type { Database, Transaction } from '../../../core/infra/database.js';
import type { MissingDataTransaction } from '../application/missing-data-ports.js';

// Configuration publication excludes registration writes and identity merges.
export const missingDataSelectionLock = 20461006;

export async function loadMissingDataSelection(tx: Transaction | Database) {
  const row = await tx.registrationFieldSelection.findFirst({
    orderBy: { version: 'desc' },
  });
  return row
    ? missingDataSelectionSchema.parse({
        ...row,
        recordedAt: row.recordedAt.toISOString(),
      })
    : null;
}

export function missingDataTransactionPorts(
  tx: Transaction,
): MissingDataTransaction {
  return {
    selection: () => loadMissingDataSelection(tx),
    async openIssues(entityType, entityId) {
      return (
        await tx.dataQualityIssue.findMany({
          where: {
            entityType,
            entityId,
            kind: 'MISSING_DATA',
            resolvedAt: null,
          },
          orderBy: { id: 'asc' },
        })
      ).map((row) =>
        dataQualityIssueSchema.parse({
          ...row,
          identifiedAt: row.identifiedAt.toISOString(),
          resolvedAt: null,
        }),
      );
    },
    async createIssue(operationId, actorId, entityType, entityId, fieldKey) {
      const row = await tx.dataQualityIssue.create({
        data: {
          entityType,
          entityId,
          kind: 'MISSING_DATA',
          fieldKeys: [fieldKey],
          candidateIds: [],
        },
      });
      const after = dataQualityIssueSchema.parse({
        ...row,
        identifiedAt: row.identifiedAt.toISOString(),
        resolvedAt: null,
      });
      await tx.auditEntry.create({
        data: {
          operationId,
          actorId,
          actorType: 'USER',
          entityType: 'DataQualityIssue',
          entityId: row.id,
          action: 'CREATE',
          revision: row.revision,
          classification: 'REGISTRATION',
          after,
        },
      });
    },
    async closeIssue(operationId, actorId, before, resolution, reason) {
      const row = await tx.dataQualityIssue.update({
        where: { id: before.id, revision: before.revision, resolvedAt: null },
        data: {
          resolvedAt: new Date(),
          resolvedBy: actorId,
          resolution,
          reason,
          revision: { increment: 1 },
        },
      });
      const after = dataQualityIssueSchema.parse({
        ...row,
        identifiedAt: row.identifiedAt.toISOString(),
        resolvedAt: row.resolvedAt?.toISOString() ?? null,
      });
      await tx.auditEntry.create({
        data: {
          operationId,
          actorId,
          actorType: 'USER',
          entityType: 'DataQualityIssue',
          entityId: row.id,
          action: 'UPDATE',
          revision: row.revision,
          classification: 'REGISTRATION',
          reason,
          before: { ...before },
          after,
        },
      });
    },
  };
}
