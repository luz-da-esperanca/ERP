import { missingDataSelectionSchema } from '@erp/contracts/data-quality-api';
import { ResourceNotFoundError } from '../../../core/application/errors.js';
import {
  databaseOperation,
  serializable,
  type Database,
} from '../../../core/infra/database.js';
import type {
  MissingDataSelectionStore,
  MissingDataSelectionTransaction,
} from '../application/missing-data-ports.js';
import { registrationTransactionPorts } from './prisma-registration.js';
import {
  loadMissingDataSelection,
  missingDataSelectionLock,
} from './prisma-missing-data.js';

export class PrismaMissingDataSelections implements MissingDataSelectionStore {
  constructor(private readonly database: Database) {}
  current() {
    return databaseOperation(() => loadMissingDataSelection(this.database));
  }
  run<T>(
    actorId: string,
    work: (tx: MissingDataSelectionTransaction) => Promise<T>,
  ): Promise<T> {
    return serializable(this.database, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${missingDataSelectionLock}::bigint)`;
      await tx.$queryRaw`SELECT id FROM "UserAccount" WHERE id = ${actorId}::uuid FOR UPDATE`;
      const registration = registrationTransactionPorts(tx);
      return work({
        missingData: registration.missingData,
        findActor: registration.findActor,
        findOperation: registration.findOperation,
        createOperation: registration.createOperation,
        completeOperation: registration.completeOperation,
        async selectionRevision(id) {
          const row = await tx.registrationFieldSelection.findUnique({
            where: { id },
          });
          if (!row) throw new ResourceNotFoundError();
          return missingDataSelectionSchema.parse({
            ...row,
            recordedAt: row.recordedAt.toISOString(),
          });
        },
        async publishSelection(input) {
          const row = await tx.registrationFieldSelection.create({
            data: { ...input, recordedAt: new Date(input.recordedAt) },
          });
          return missingDataSelectionSchema.parse({
            ...row,
            recordedAt: row.recordedAt.toISOString(),
          });
        },
        async entities() {
          const people = await tx.person.findMany({
            where: { mergedIntoId: null },
            orderBy: { id: 'asc' },
          });
          const families = await tx.family.findMany({
            where: { mergedIntoId: null },
            orderBy: { id: 'asc' },
          });
          return [
            ...people.map((row) => ({
              entityType: 'PERSON' as const,
              id: row.id,
              fields: row,
            })),
            ...families.map((row) => ({
              entityType: 'FAMILY' as const,
              id: row.id,
              fields: row,
            })),
          ];
        },
        async auditSelection(operationId, authorId, selection) {
          await tx.auditEntry.create({
            data: {
              operationId,
              actorId: authorId,
              actorType: 'USER',
              entityType: 'RegistrationFieldSelection',
              entityId: selection.id,
              revision: 1,
              action: 'CREATE',
              classification: 'REGISTRATION_CONFIGURATION',
              after: { ...selection },
            },
          });
        },
      });
    });
  }
}
