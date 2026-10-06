import { z } from 'zod';
import {
  assessmentDtoSchema,
  policyDtoSchema,
} from '@erp/contracts/eligibility-api';
import {
  attendanceStatusSchema,
  sessionStatusSchema,
} from '@erp/contracts/attendance-api';
import { Prisma } from '../../../generated/prisma/client.js';
import {
  databaseOperation,
  serializable,
  type Database,
  type Transaction,
} from '../../../core/infra/database.js';
import {
  attendanceTransactionPorts,
  coverageRecord,
  coverageSelect,
} from '../../attendance/infra/prisma-attendance.js';
import type {
  EligibilityReader,
  EligibilityReaderPorts,
  EligibilityTransaction,
  EligibilityUnitOfWork,
} from '../application/eligibility-ports.js';
import { EligibilityConflictError } from '../domain/eligibility-errors.js';
import type {
  EligibilityAssessment,
  EligibilityPolicy,
} from '../domain/eligibility.js';

const policySelect = {
  id: true,
  effectiveFrom: true,
  definition: true,
  decisionReference: true,
  reason: true,
  recordedAt: true,
  recordedBy: true,
} satisfies Prisma.EligibilityPolicySelect;
const evidenceSelect = {
  personId: true,
  membershipIds: true,
  activityIds: true,
  periodStart: true,
  periodEndExclusive: true,
  sessionCount: true,
  presenceCount: true,
  absenceCount: true,
  unrecordedCount: true,
  rateLowerBasisPoints: true,
  rateUpperBasisPoints: true,
  coverageComplete: true,
  status: true,
  pendingReason: true,
  sourceVersions: true,
} satisfies Prisma.EligibilityEvidenceSelect;
const assessmentSelect = {
  id: true,
  familyId: true,
  referenceDate: true,
  evaluatedAt: true,
  policyId: true,
  status: true,
  pendingReasons: true,
  explanation: true,
  sourceFingerprint: true,
  requestedBy: true,
  evidences: { select: evidenceSelect, orderBy: { position: 'asc' } },
} satisfies Prisma.EligibilityAssessmentSelect;
const civilDate = (value: Date) => value.toISOString().slice(0, 10);
const json = (value: object) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

function policyRecord(
  row: Prisma.EligibilityPolicyGetPayload<{ select: typeof policySelect }>,
): EligibilityPolicy {
  return policyDtoSchema.parse({
    ...row,
    effectiveFrom: civilDate(row.effectiveFrom),
    recordedAt: row.recordedAt.toISOString(),
  });
}
function assessmentRecord(
  row: Prisma.EligibilityAssessmentGetPayload<{
    select: typeof assessmentSelect;
  }>,
): EligibilityAssessment {
  return assessmentDtoSchema.parse({
    ...row,
    referenceDate: civilDate(row.referenceDate),
    evaluatedAt: row.evaluatedAt.toISOString(),
    evidences: row.evidences.map((evidence) => ({
      ...evidence,
      periodStart: civilDate(evidence.periodStart),
      periodEndExclusive: civilDate(evidence.periodEndExclusive),
    })),
  });
}
const referenceSchema = z
  .object({
    entityType: z.enum(['EligibilityPolicy', 'EligibilityAssessment']),
    entityId: z.uuid(),
  })
  .strict();

function readerPorts(tx: Transaction): EligibilityReaderPorts {
  return {
    async policies() {
      const rows = await tx.eligibilityPolicy.findMany({
        select: policySelect,
        orderBy: [{ effectiveFrom: 'asc' }, { id: 'asc' }],
      });
      return rows.map(policyRecord);
    },
    async assessment(id) {
      const row = await tx.eligibilityAssessment.findUnique({
        where: { id },
        select: assessmentSelect,
      });
      return row ? assessmentRecord(row) : null;
    },
    async familyExists(id) {
      return (await tx.family.count({ where: { id, mergedIntoId: null } })) > 0;
    },
    async activities(ids) {
      const rows = await tx.activity.findMany({
        where: { id: { in: [...ids] } },
        select: { id: true, nature: true },
      });
      return rows.map((row) => ({
        id: row.id,
        nature: z.enum(['PERIODIC', 'ONE_OFF']).parse(row.nature),
      }));
    },
    async evidence(familyId, activityIds) {
      const memberships = await tx.familyMembership.findMany({
        where: {
          familyId,
          supersededById: null,
          person: { mergedIntoId: null },
        },
        select: {
          id: true,
          personId: true,
          familyId: true,
          validFrom: true,
          validUntil: true,
          revision: true,
        },
        orderBy: { id: 'asc' },
      });
      const personIds = [...new Set(memberships.map((row) => row.personId))];
      const activities = [];
      for (const activityId of activityIds) {
        const sessions = await tx.activitySession.findMany({
          where: { activityId },
          select: { id: true, occurredAt: true, status: true, revision: true },
          orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
        });
        const attendances = await tx.attendance.findMany({
          where: {
            session: { activityId },
            personId: { in: personIds },
            supersededById: null,
          },
          select: {
            id: true,
            sessionId: true,
            personId: true,
            familyId: true,
            membershipId: true,
            status: true,
            revision: true,
          },
          orderBy: { id: 'asc' },
        });
        const enrollments = await tx.participantEnrollment.findMany({
          where: {
            activityId,
            personId: { in: personIds },
            supersededById: null,
          },
          select: {
            id: true,
            personId: true,
            validFrom: true,
            validUntil: true,
            revision: true,
          },
          orderBy: { id: 'asc' },
        });
        const declarations = await tx.attendanceCoverage.findMany({
          where: { activityId },
          select: coverageSelect,
          orderBy: { id: 'asc' },
        });
        activities.push({
          activityId,
          sessions: sessions.map((row) => ({
            ...row,
            occurredAt: row.occurredAt.toISOString(),
            status: sessionStatusSchema.parse(row.status),
          })),
          attendances: attendances.map((row) => ({
            ...row,
            status: attendanceStatusSchema.parse(row.status),
          })),
          enrollments: enrollments.map((row) => ({
            ...row,
            validFrom: row.validFrom.toISOString(),
            validUntil: row.validUntil?.toISOString() ?? null,
          })),
          declarations: declarations.map(coverageRecord),
        });
      }
      return {
        memberships: memberships.map((row) => ({
          ...row,
          validFrom: row.validFrom.toISOString(),
          validUntil: row.validUntil?.toISOString() ?? null,
        })),
        activities,
      };
    },
  };
}

function transactionPorts(tx: Transaction): EligibilityTransaction {
  const shared = attendanceTransactionPorts(tx, false);
  return {
    ...readerPorts(tx),
    actor: shared.actor,
    createOperation: shared.createOperation,
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
    async createPolicy(input) {
      return policyRecord(
        await tx.eligibilityPolicy.create({
          data: {
            ...input,
            effectiveFrom: new Date(input.effectiveFrom),
            definition: json(input.definition),
          },
          select: policySelect,
        }),
      );
    },
    async createAssessment({ evidences, ...input }) {
      return assessmentRecord(
        await tx.eligibilityAssessment.create({
          data: {
            ...input,
            referenceDate: new Date(input.referenceDate),
            evaluatedAt: new Date(input.evaluatedAt),
            explanation: json(input.explanation),
            evidences: {
              create: evidences.map((evidence, position) => ({
                ...evidence,
                position,
                periodStart: new Date(evidence.periodStart),
                periodEndExclusive: new Date(evidence.periodEndExclusive),
                sourceVersions: json(evidence.sourceVersions),
              })),
            },
          },
          select: assessmentSelect,
        }),
      );
    },
    async audit(operationId, actorId, entityType, after, reason) {
      await tx.auditEntry.create({
        data: {
          operationId,
          actorId,
          actorType: 'USER',
          entityType,
          entityId: after.id,
          // Both entities are immutable versions: their only revision is the creation.
          revision: 1,
          classification: 'ELIGIBILITY',
          action: 'CREATE',
          before: Prisma.DbNull,
          after: json(after),
          reason,
        },
      });
    },
  };
}

export class PrismaEligibility
  implements EligibilityReader, EligibilityUnitOfWork
{
  constructor(private readonly database: Database) {}
  read<T>(work: (ports: EligibilityReaderPorts) => Promise<T>): Promise<T> {
    return databaseOperation(() =>
      this.database.$transaction((tx) => work(readerPorts(tx)), {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 10000,
      }),
    );
  }
  async run<T>(
    actorId: string,
    work: (ports: EligibilityTransaction) => Promise<T>,
  ) {
    try {
      return await serializable(this.database, async (tx) => {
        await tx.$queryRaw`SELECT id FROM "UserAccount" WHERE id = ${actorId}::uuid FOR UPDATE`;
        return work(transactionPorts(tx));
      });
    } catch (error) {
      // The unique start date is the last guard against two concurrent versions.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        String(error.meta?.modelName) === 'EligibilityPolicy'
      )
        throw new EligibilityConflictError('POLICY_EFFECTIVE_DATE_TAKEN');
      throw error;
    }
  }
}
