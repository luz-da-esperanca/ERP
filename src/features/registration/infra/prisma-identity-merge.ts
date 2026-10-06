import { z } from 'zod';
import { identityMergeDtoSchema } from '@erp/contracts/identity-merge-api';
import { dataQualityIssueSchema } from '@erp/contracts/data-quality-api';
import { Prisma } from '../../../generated/prisma/client.js';
import {
  databaseOperation,
  serializable,
  type Database,
  type Transaction,
} from '../../../core/infra/database.js';
import { ResourceNotFoundError } from '../../../core/application/errors.js';
import {
  attendanceRecord,
  attendanceSelect,
  attendanceTransactionPorts,
  sessionRecord,
  sessionSelect,
} from '../../attendance/infra/prisma-attendance.js';
import {
  enrollmentRecord,
  enrollmentSelect,
} from '../../projects/infra/project-projections.js';
import type {
  IdentityMergeReader,
  IdentityMergeReaderPorts,
  IdentityMergeTransaction,
  IdentityMergeUnitOfWork,
} from '../application/identity-merge-ports.js';
import type {
  IdentityMerge,
  MergeIdentities,
  MergeSources,
} from '../domain/identity-merge.js';
import { registrationTransactionPorts } from './prisma-registration.js';

const revision = z
  .object({
    entityType: z.string(),
    entityId: z.uuid(),
    revision: z.number().int().positive(),
  })
  .strict();
const referenceSchema = z
  .object({
    merge: z
      .object({ entityType: z.literal('IdentityMerge'), entityId: z.uuid() })
      .strict(),
    target: revision,
  })
  .strict();
const json = (value: object) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const mergeRecord = (
  row: Prisma.IdentityMergeGetPayload<object>,
): IdentityMerge =>
  identityMergeDtoSchema.parse({
    ...row,
    recordedAt: row.recordedAt.toISOString(),
  });
const instant = (value: string | null | undefined) =>
  value === undefined ? undefined : value === null ? null : new Date(value);

function readerPorts(tx: Transaction): IdentityMergeReaderPorts {
  const registration = registrationTransactionPorts(tx);
  async function issues({ entityType, sourceId, targetId }: MergeIdentities) {
    const rows = await tx.dataQualityIssue.findMany({
      where: {
        entityType,
        kind: 'POSSIBLE_DUPLICATE',
        resolvedAt: null,
        OR: [
          { entityId: sourceId, candidateIds: { has: targetId } },
          { entityId: targetId, candidateIds: { has: sourceId } },
        ],
      },
      orderBy: { id: 'asc' },
    });
    return rows.map((row) =>
      dataQualityIssueSchema.parse({
        ...row,
        identifiedAt: row.identifiedAt.toISOString(),
        resolvedAt: null,
      }),
    );
  }
  async function facts(where: Prisma.AttendanceWhereInput) {
    const attendances = (
      await tx.attendance.findMany({
        where: { ...where, supersededById: null },
        select: attendanceSelect,
        orderBy: { id: 'asc' },
      })
    ).map(attendanceRecord);
    const sessions = (
      await tx.activitySession.findMany({
        where: { id: { in: attendances.map((row) => row.sessionId) } },
        select: sessionSelect,
        orderBy: { id: 'asc' },
      })
    ).map(sessionRecord);
    return { attendances, sessions };
  }
  return {
    async sources(identities): Promise<MergeSources | null> {
      const { sourceId, targetId } = identities;
      if (identities.entityType === 'FAMILY') {
        const source = await registration.findFamily(sourceId);
        const target = await registration.findFamily(targetId);
        if (!source || !target) return null;
        return {
          entityType: 'FAMILY',
          source,
          target,
          memberships: (
            await registration.memberships([sourceId, targetId])
          ).sort((a, b) => a.id.localeCompare(b.id)),
          ...(await facts({ familyId: sourceId })),
          issues: await issues(identities),
          preserved: {
            socialForms: await tx.socialForm.count({
              where: { familyId: sourceId },
            }),
            eligibilityAssessments: await tx.eligibilityAssessment.count({
              where: { familyId: sourceId },
            }),
          },
        };
      }
      const source = await registration.findPerson(sourceId);
      const target = await registration.findPerson(targetId);
      if (!source || !target) return null;
      const personIds = [sourceId, targetId];
      const memberships = (await registration.memberships([], personIds)).sort(
        (a, b) => a.id.localeCompare(b.id),
      );
      const families = [];
      for (const id of [
        ...new Set(memberships.map((row) => row.familyId)),
      ].sort()) {
        const family = await registration.findFamily(id);
        if (family) families.push(family);
      }
      return {
        entityType: 'PERSON',
        source,
        target,
        memberships,
        families,
        enrollments: (
          await tx.participantEnrollment.findMany({
            where: { personId: { in: personIds }, supersededById: null },
            select: enrollmentSelect,
            orderBy: { id: 'asc' },
          })
        ).map(enrollmentRecord),
        ...(await facts({ personId: { in: personIds } })),
        sizeProfiles: {
          source: await registration.sizeProfile(sourceId),
          target: await registration.sizeProfile(targetId),
        },
        issues: await issues(identities),
        preserved: {
          socialForms: await tx.socialForm.count({
            where: { members: { some: { personId: sourceId } } },
          }),
          eligibilityAssessments: await tx.eligibilityAssessment.count({
            where: { evidences: { some: { personId: sourceId } } },
          }),
        },
      };
    },
  };
}

function transactionPorts(tx: Transaction): IdentityMergeTransaction {
  const registration = registrationTransactionPorts(tx);
  const attendance = attendanceTransactionPorts(tx, false);
  return {
    ...readerPorts(tx),
    actor: registration.findActor,
    createOperation: registration.createOperation,
    coverage: registration.coverage,
    personCoverage: registration.personCoverage,
    membershipMarkings: registration.membershipMarkings,
    reviseFamily: registration.reviseFamily,
    saveSizes: registration.saveSizes,
    reviseSession: (id) => attendance.updateSession(id, {}),
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
    async completeOperation(id, reference) {
      await tx.operationRecord.update({
        where: { id },
        data: {
          completedAt: new Date(),
          resultReference: referenceSchema.parse(reference),
        },
      });
    },
    async restore(reference) {
      const merge = await tx.identityMerge.findUnique({
        where: { id: reference.merge.entityId },
      });
      if (!merge) throw new ResourceNotFoundError();
      const { entityType, entityId, revision } = reference.target;
      return {
        merge: mergeRecord(merge),
        target:
          entityType === 'Person'
            ? await registration.readPersonRevision(entityId, revision)
            : await registration.readFamilyRevision(entityId, revision),
      };
    },
    updateTarget: ({ entityType, targetId }, changes) =>
      entityType === 'PERSON'
        ? registration.updatePerson(targetId, changes)
        : registration.updateFamily(targetId, changes),
    async updateMembership(id, changes) {
      await tx.familyMembership.update({
        where: { id },
        data: {
          personId: changes.personId,
          familyId: changes.familyId,
          supersededById: changes.supersededById,
          validFrom: instant(changes.validFrom) ?? undefined,
          validUntil: instant(changes.validUntil),
          revision: { increment: 1 },
        },
      });
      const membership = await registration.findMembership(id);
      if (!membership) throw new ResourceNotFoundError();
      return membership;
    },
    async updateEnrollment(id, changes, actorId) {
      return enrollmentRecord(
        await tx.participantEnrollment.update({
          where: { id },
          data: {
            personId: changes.personId,
            supersededById: changes.supersededById,
            validFrom: instant(changes.validFrom) ?? undefined,
            validUntil: instant(changes.validUntil),
            revision: { increment: 1 },
            updatedBy: actorId,
          },
          select: enrollmentSelect,
        }),
      );
    },
    async updateAttendance(id, changes) {
      return attendanceRecord(
        await tx.attendance.update({
          where: { id },
          data: { ...changes, revision: { increment: 1 } },
          select: attendanceSelect,
        }),
      );
    },
    async resolveIssue(id, actorId, reason) {
      const row = await tx.dataQualityIssue.update({
        where: { id },
        data: {
          resolution: 'MERGED',
          reason,
          resolvedBy: actorId,
          resolvedAt: new Date(),
          revision: { increment: 1 },
        },
      });
      return dataQualityIssueSchema.parse({
        ...row,
        identifiedAt: row.identifiedAt.toISOString(),
        resolvedAt: row.resolvedAt?.toISOString() ?? null,
      });
    },
    async markMerged({ entityType, sourceId, targetId }) {
      const data = { mergedIntoId: targetId };
      if (entityType === 'PERSON')
        await tx.person.update({ where: { id: sourceId }, data });
      else await tx.family.update({ where: { id: sourceId }, data });
    },
    async createMerge(input) {
      return mergeRecord(
        await tx.identityMerge.create({
          data: { ...input, resolution: json(input.resolution) },
        }),
      );
    },
    async audit(entry) {
      await tx.auditEntry.create({
        data: {
          operationId: entry.operationId,
          actorId: entry.actorId,
          actorType: 'USER',
          classification: entry.classification,
          entityType: entry.entityType,
          entityId: entry.entityId,
          revision: entry.revision,
          action: 'MERGE',
          before: entry.before ? json(entry.before) : Prisma.DbNull,
          after: json(entry.after),
          reason: entry.reason,
          occurredAt: entry.occurredAt ? new Date(entry.occurredAt) : null,
        },
      });
    },
  };
}

export class PrismaIdentityMerge
  implements IdentityMergeReader, IdentityMergeUnitOfWork
{
  constructor(private readonly database: Database) {}
  read<T>(work: (ports: IdentityMergeReaderPorts) => Promise<T>) {
    return databaseOperation(() =>
      this.database.$transaction((tx) => work(readerPorts(tx)), {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 10000,
      }),
    );
  }
  run<T>(
    actorId: string,
    { entityType, sourceId, targetId }: MergeIdentities,
    work: (ports: IdentityMergeTransaction) => Promise<T>,
  ) {
    return serializable(this.database, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "UserAccount" WHERE id = ${actorId}::uuid FOR UPDATE`;
      const ids = Prisma.join(
        [sourceId, targetId].sort().map((id) => Prisma.sql`${id}::uuid`),
      );
      // Both identities are locked in a stable order so two merges cannot cross.
      if (entityType === 'PERSON')
        await tx.$queryRaw`SELECT id FROM "Person" WHERE id IN (${ids}) ORDER BY id FOR UPDATE`;
      else
        await tx.$queryRaw`SELECT id FROM "Family" WHERE id IN (${ids}) ORDER BY id FOR UPDATE`;
      return work(transactionPorts(tx));
    });
  }
}
