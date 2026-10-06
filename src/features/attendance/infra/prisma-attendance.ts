import { z } from 'zod';
import {
  sessionDtoSchema,
  attendanceDtoSchema,
  coverageDtoSchema,
  sourceVersionSchema,
} from '@erp/contracts/attendance-api';
import type { Role } from '@erp/contracts/access';
import { Prisma } from '../../../generated/prisma/client.js';
import {
  databaseOperation,
  serializable,
  type Database,
  type Transaction,
} from '../../../core/infra/database.js';
import { ResourceNotFoundError } from '../../../core/application/errors.js';
import {
  activitySelect,
  projectSelect,
  enrollmentSelect,
  activityRecord,
  projectRecord,
  enrollmentRecord,
} from '../../projects/infra/project-projections.js';
import type {
  AttendanceReader,
  AttendanceReaderPorts,
  AttendanceTransaction,
  AttendanceUnitOfWork,
} from '../application/attendance-ports.js';
import type {
  AttendanceReference,
  AttendanceSnapshot,
  ActivitySession,
  Attendance,
  AttendanceCoverage,
} from '../domain/attendance.js';

export const sessionSelect = {
  id: true,
  activityId: true,
  responsibleId: true,
  occurredAt: true,
  recordedAt: true,
  recordedBy: true,
  status: true,
  revision: true,
} satisfies Prisma.ActivitySessionSelect;
export const attendanceSelect = {
  id: true,
  sessionId: true,
  personId: true,
  familyId: true,
  membershipId: true,
  membershipRevision: true,
  status: true,
  recordedAt: true,
  recordedBy: true,
  revision: true,
  supersededById: true,
} satisfies Prisma.AttendanceSelect;
export const coverageSelect = {
  id: true,
  activityId: true,
  periodStart: true,
  periodEndExclusive: true,
  declaredBy: true,
  declaredAt: true,
  sourceVersions: true,
  revision: true,
  invalidatedPeriods: true,
} satisfies Prisma.AttendanceCoverageSelect;
export function sessionRecord(
  row: Prisma.ActivitySessionGetPayload<{ select: typeof sessionSelect }>,
): ActivitySession {
  return sessionDtoSchema.parse({
    ...row,
    occurredAt: row.occurredAt.toISOString(),
    recordedAt: row.recordedAt.toISOString(),
  });
}
export function attendanceRecord(
  row: Prisma.AttendanceGetPayload<{ select: typeof attendanceSelect }>,
): Attendance {
  return attendanceDtoSchema.parse({
    ...row,
    recordedAt: row.recordedAt.toISOString(),
  });
}
export function coverageRecord(
  row: Prisma.AttendanceCoverageGetPayload<{ select: typeof coverageSelect }>,
): AttendanceCoverage {
  return coverageDtoSchema.parse({
    ...row,
    periodStart: row.periodStart.toISOString().slice(0, 10),
    periodEndExclusive: row.periodEndExclusive.toISOString().slice(0, 10),
    declaredAt: row.declaredAt.toISOString(),
  });
}
const referenceSchema = z
  .object({
    kind: z.enum(['SESSION', 'COVERAGE']),
    primary: sourceVersionSchema,
    attendances: z.array(sourceVersionSchema),
  })
  .strict();
const snapshots = {
  ActivitySession: sessionDtoSchema,
  Attendance: attendanceDtoSchema,
  AttendanceCoverage: coverageDtoSchema,
};

export function attendanceTransactionPorts(
  tx: Transaction,
  locks = true,
): AttendanceTransaction {
  async function readRevision(ref: {
    entityType: string;
    entityId: string;
    revision: number;
  }): Promise<AttendanceSnapshot> {
    const schema = snapshots[ref.entityType as keyof typeof snapshots];
    if (!schema) throw new ResourceNotFoundError();
    const row = await tx.auditEntry.findUnique({
      where: { entityType_entityId_revision: ref },
      select: { after: true },
    });
    if (!row) throw new ResourceNotFoundError();
    return schema.parse(row.after);
  }
  return {
    async actor(id) {
      const row = await tx.userAccount.findUnique({
        where: { id },
        select: {
          id: true,
          login: true,
          displayName: true,
          active: true,
          mustChangePassword: true,
          authVersion: true,
          revision: true,
          createdAt: true,
          updatedAt: true,
          roles: { select: { roleCode: true } },
        },
      });
      return row
        ? {
            authVersion: row.authVersion,
            sessionId: '',
            user: {
              id: row.id,
              login: row.login,
              displayName: row.displayName,
              active: row.active,
              mustChangePassword: row.mustChangePassword,
              revision: row.revision,
              createdAt: row.createdAt.toISOString(),
              updatedAt: row.updatedAt.toISOString(),
              roleCodes: row.roles.map((role) => role.roleCode as Role),
            },
          }
        : null;
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
    async createOperation(type, key, actorId, requestFingerprint) {
      return (
        await tx.operationRecord.create({
          data: { type, key, actorId, actorType: 'USER', requestFingerprint },
          select: { id: true },
        })
      ).id;
    },
    async completeOperation(id, reference: AttendanceReference) {
      await tx.operationRecord.update({
        where: { id },
        data: {
          completedAt: new Date(),
          resultReference: referenceSchema.parse(reference),
        },
      });
    },
    restore: (ref) => readRevision(ref.primary),
    revision: readRevision,
    async session(id) {
      const row = await tx.activitySession.findUnique({
        where: { id },
        select: sessionSelect,
      });
      return row ? sessionRecord(row) : null;
    },
    async attendance(id) {
      const row = await tx.attendance.findUnique({
        where: { id },
        select: attendanceSelect,
      });
      return row ? attendanceRecord(row) : null;
    },
    async accountExists(id) {
      return (await tx.userAccount.count({ where: { id } })) > 0;
    },
    async sources(activityId, personIds = []) {
      const context = await tx.activity.findUnique({
        where: { id: activityId },
        select: { projectId: true },
      });
      if (!context) return null;
      if (locks) {
        await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${context.projectId}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "Activity" WHERE id = ${activityId}::uuid FOR UPDATE`;
      }
      const activity = await tx.activity.findUniqueOrThrow({
        where: { id: activityId },
        select: activitySelect,
      });
      const project = await tx.project.findUniqueOrThrow({
        where: { id: activity.projectId },
        select: projectSelect,
      });
      const enrollments = await tx.participantEnrollment.findMany({
        where: { activityId, supersededById: null },
        select: enrollmentSelect,
        orderBy: { id: 'asc' },
      });
      const sessions = await tx.activitySession.findMany({
        where: { activityId },
        select: sessionSelect,
        orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      });
      const attendances = await tx.attendance.findMany({
        where: { session: { activityId }, supersededById: null },
        select: attendanceSelect,
        orderBy: { id: 'asc' },
      });
      const ids = [
        ...new Set([
          ...personIds,
          ...enrollments.map((row) => row.personId),
          ...attendances.map((row) => row.personId),
        ]),
      ].sort();
      if (locks && ids.length)
        await tx.$queryRaw`SELECT id FROM "Person" WHERE id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`;
      const people = await tx.person.findMany({
        where: { id: { in: ids }, mergedIntoId: null },
        select: {
          id: true,
          name: true,
          revision: true,
          memberships: {
            where: { supersededById: null },
            select: {
              id: true,
              personId: true,
              familyId: true,
              revision: true,
              validFrom: true,
              validUntil: true,
              family: { select: { code: true, revision: true } },
            },
            orderBy: { id: 'asc' },
          },
        },
        orderBy: { id: 'asc' },
      });
      const familyIds = [
        ...new Set(
          people.flatMap((person) =>
            person.memberships.map((row) => row.familyId),
          ),
        ),
      ].sort();
      if (locks && familyIds.length)
        await tx.$queryRaw`SELECT id FROM "Family" WHERE id IN (${Prisma.join(familyIds.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`;
      const declarations = await tx.attendanceCoverage.findMany({
        where: { activityId },
        select: coverageSelect,
        orderBy: { id: 'asc' },
      });
      return {
        activity: activityRecord(activity),
        project: projectRecord(project),
        enrollments: enrollments.map(enrollmentRecord),
        sessions: sessions.map(sessionRecord),
        attendances: attendances.map(attendanceRecord),
        declarations: declarations.map(coverageRecord),
        people: people.map((person) => ({
          ...person,
          memberships: person.memberships.map(({ family, ...row }) => ({
            ...row,
            validFrom: row.validFrom.toISOString(),
            validUntil: row.validUntil?.toISOString() ?? null,
            familyCode: String(family.code),
            familyRevision: family.revision,
          })),
        })),
      };
    },
    async createSession(activityId, responsibleId, occurredAt, recordedBy) {
      return sessionRecord(
        await tx.activitySession.create({
          data: {
            activityId,
            responsibleId,
            occurredAt: new Date(occurredAt),
            recordedBy,
          },
          select: sessionSelect,
        }),
      );
    },
    async updateSession(id, changes) {
      return sessionRecord(
        await tx.activitySession.update({
          where: { id },
          data: {
            ...changes,
            occurredAt:
              changes.occurredAt === undefined
                ? undefined
                : new Date(changes.occurredAt),
            revision: { increment: 1 },
          },
          select: sessionSelect,
        }),
      );
    },
    async createAttendance(sessionId, entry, recordedBy) {
      return attendanceRecord(
        await tx.attendance.create({
          data: {
            sessionId,
            personId: entry.personId,
            familyId: entry.familyId,
            membershipId: entry.membershipId,
            membershipRevision: entry.expectedMembershipRevision,
            status: entry.status,
            recordedBy,
          },
          select: attendanceSelect,
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
    async createCoverage(input) {
      return coverageRecord(
        await tx.attendanceCoverage.create({
          data: {
            ...input,
            periodStart: new Date(input.periodStart),
            periodEndExclusive: new Date(input.periodEndExclusive),
            sourceVersions: input.sourceVersions.map((row) => ({ ...row })),
          },
          select: coverageSelect,
        }),
      );
    },
    async updateCoverage(id, invalidatedPeriods) {
      return coverageRecord(
        await tx.attendanceCoverage.update({
          where: { id },
          data: {
            invalidatedPeriods: invalidatedPeriods.map((row) => ({ ...row })),
            revision: { increment: 1 },
          },
          select: coverageSelect,
        }),
      );
    },
    async audit(
      operationId,
      actorId,
      entityType,
      before,
      after,
      action,
      reason,
      occurredAt,
    ) {
      await tx.auditEntry.create({
        data: {
          operationId,
          actorId,
          actorType: 'USER',
          entityType,
          entityId: after.id,
          revision: after.revision,
          classification: 'ATTENDANCE',
          action,
          before:
            before === null
              ? Prisma.DbNull
              : ({ ...before } as Prisma.InputJsonObject),
          after: { ...after } as Prisma.InputJsonObject,
          reason,
          occurredAt: occurredAt ? new Date(occurredAt) : null,
        },
      });
    },
  };
}
export class PrismaAttendance
  implements AttendanceReader, AttendanceUnitOfWork
{
  constructor(private readonly database: Database) {}
  read<T>(work: (ports: AttendanceReaderPorts) => Promise<T>): Promise<T> {
    return databaseOperation(() =>
      this.database.$transaction(
        (tx) => work(attendanceTransactionPorts(tx, false)),
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      ),
    );
  }
  run<T>(actorId: string, work: (ports: AttendanceTransaction) => Promise<T>) {
    return serializable(this.database, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "UserAccount" WHERE id = ${actorId}::uuid FOR UPDATE`;
      return work(attendanceTransactionPorts(tx));
    });
  }
}
