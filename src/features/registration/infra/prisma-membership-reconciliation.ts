import { z } from 'zod';
import { sourceVersionSchema } from '@erp/contracts/attendance-api';
import { Prisma } from '../../../generated/prisma/client.js';
import {
  serializable,
  databaseOperation,
  type Database,
  type Transaction,
} from '../../../core/infra/database.js';
import { ResourceNotFoundError } from '../../../core/application/errors.js';
import { registrationTransactionPorts } from './prisma-registration.js';
import { attendanceTransactionPorts } from '../../attendance/infra/prisma-attendance.js';
import type {
  ReconciliationPorts,
  ReconciliationReader,
  ReconciliationUnitOfWork,
} from '../application/membership-reconciliation-ports.js';
import type { ReconciliationReference } from '../domain/membership-reconciliation.js';

const referenceSchema = z
  .object({
    person: sourceVersionSchema,
    memberships: z.array(sourceVersionSchema),
    families: z.array(sourceVersionSchema),
    sessions: z.array(sourceVersionSchema),
    attendances: z.array(sourceVersionSchema),
    createdMemberships: z.array(
      z.object({ clientRef: z.string(), membershipId: z.uuid() }).strict(),
    ),
  })
  .strict();
function ports(tx: Transaction): ReconciliationPorts {
  const registration = registrationTransactionPorts(tx);
  const attendance = attendanceTransactionPorts(tx, false);
  return {
    registration,
    attendance,
    async activityIdsForPerson(personId) {
      return (
        await tx.activity.findMany({
          where: {
            OR: [
              { enrollments: { some: { personId } } },
              { sessions: { some: { attendances: { some: { personId } } } } },
            ],
          },
          select: { id: true },
          orderBy: { id: 'asc' },
        })
      ).map((row) => row.id);
    },
    async operation(type, key) {
      const row = await tx.operationRecord.findUnique({
        where: { type_key: { type, key } },
        select: {
          actorId: true,
          requestFingerprint: true,
          resultReference: true,
        },
      });
      return row
        ? {
            actorId: row.actorId,
            fingerprint: row.requestFingerprint,
            reference: referenceSchema.parse(row.resultReference),
          }
        : null;
    },
    async completeOperation(id, reference: ReconciliationReference) {
      await tx.operationRecord.update({
        where: { id },
        data: {
          completedAt: new Date(),
          resultReference: referenceSchema.parse(reference),
        },
      });
    },
    async restore(reference) {
      return {
        person: await registration.readPersonRevision(
          reference.person.entityId,
          reference.person.revision,
        ),
        memberships: await Promise.all(
          reference.memberships.map((row) =>
            registration.readMembershipRevision(row.entityId, row.revision),
          ),
        ),
        families: await Promise.all(
          reference.families.map((row) =>
            registration.readFamilyRevision(row.entityId, row.revision),
          ),
        ),
        sessions: await Promise.all(
          reference.sessions.map(async (row) => {
            const record = await attendance.revision(row);
            if (!('occurredAt' in record)) throw new ResourceNotFoundError();
            return record;
          }),
        ),
        attendances: await Promise.all(
          reference.attendances.map(async (row) => {
            const record = await attendance.revision(row);
            if (!('membershipId' in record)) throw new ResourceNotFoundError();
            return record;
          }),
        ),
        createdMemberships: reference.createdMemberships,
      };
    },
  };
}
export class PrismaMembershipReconciliation
  implements ReconciliationReader, ReconciliationUnitOfWork
{
  constructor(private readonly database: Database) {}
  read<T>(work: (ports: ReconciliationPorts) => Promise<T>) {
    return databaseOperation(() =>
      this.database.$transaction((tx) => work(ports(tx)), {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      }),
    );
  }
  run<T>(
    actorId: string,
    personId: string,
    familyIds: readonly string[],
    work: (ports: ReconciliationPorts) => Promise<T>,
  ) {
    return serializable(this.database, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "UserAccount" WHERE id = ${actorId}::uuid FOR UPDATE`;
      const activities = await tx.activity.findMany({
        where: {
          OR: [
            { enrollments: { some: { personId } } },
            { sessions: { some: { attendances: { some: { personId } } } } },
          ],
        },
        select: { id: true, projectId: true },
        orderBy: { id: 'asc' },
      });
      const projectIds = [
        ...new Set(activities.map((row) => row.projectId)),
      ].sort();
      if (projectIds.length)
        await tx.$queryRaw`SELECT id FROM "Project" WHERE id IN (${Prisma.join(projectIds.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`;
      if (activities.length)
        await tx.$queryRaw`SELECT id FROM "Activity" WHERE id IN (${Prisma.join(activities.map((row) => Prisma.sql`${row.id}::uuid`))}) ORDER BY id FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Person" WHERE id = ${personId}::uuid FOR UPDATE`;
      const memberships = await tx.familyMembership.findMany({
        where: { personId, supersededById: null },
        select: { familyId: true },
      });
      const ids = [
        ...new Set([...familyIds, ...memberships.map((row) => row.familyId)]),
      ].sort();
      if (ids.length)
        await tx.$queryRaw`SELECT id FROM "Family" WHERE id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`;
      return work(ports(tx));
    });
  }
}
