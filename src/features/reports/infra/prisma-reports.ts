import { dataQualityIssueSchema } from '@erp/contracts/data-quality-api';
import { Prisma } from '../../../generated/prisma/client.js';
import {
  databaseOperation,
  type Database,
  type Transaction,
} from '../../../core/infra/database.js';
import { civilBoundary } from '../../attendance/domain/frequency-rules.js';
import { attendanceTransactionPorts } from '../../attendance/infra/prisma-attendance.js';
import { canonicalId } from '../../registration/infra/prisma-registration.js';
import type {
  ReportsReader,
  ReportsReaderPorts,
} from '../application/reports-ports.js';
import type { HistoryEvent, HistoryEventType } from '../domain/reports.js';

type Event = Omit<
  HistoryEvent,
  'referenceDate' | 'recordedAt' | 'activityId' | 'valid' | 'invalidReason'
> &
  Partial<HistoryEvent>;
const event = (row: Event): HistoryEvent => ({
  referenceDate: null,
  recordedAt: null,
  activityId: null,
  valid: true,
  invalidReason: null,
  ...row,
});
const membershipSelect = {
  id: true,
  personId: true,
  familyId: true,
  isReference: true,
  relationshipToReference: true,
  validFrom: true,
  validUntil: true,
} satisfies Prisma.FamilyMembershipSelect;
const attendanceSelect = {
  id: true,
  personId: true,
  familyId: true,
  status: true,
  recordedAt: true,
  supersededById: true,
  session: {
    select: { id: true, activityId: true, occurredAt: true, status: true },
  },
} satisfies Prisma.AttendanceSelect;

function ports(tx: Transaction, timeZone: string): ReportsReaderPorts {
  const wants = (
    types: readonly HistoryEventType[],
    ...any: HistoryEventType[]
  ) => any.some((type) => types.includes(type));
  /** The canonical identity plus every identity merged into it, directly or not. */
  async function aliases(table: 'Person' | 'Family', id: string) {
    const name = Prisma.raw(`"${table}"`);
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`WITH RECURSIVE origins AS (SELECT id FROM ${name} WHERE id = ${id}::uuid UNION SELECT entity.id FROM ${name} entity JOIN origins ON entity."mergedIntoId" = origins.id) SELECT id FROM origins ORDER BY id`;
    return rows.map((row) => row.id);
  }
  function membershipEvents(
    rows: Prisma.FamilyMembershipGetPayload<{
      select: typeof membershipSelect;
    }>[],
    types: readonly HistoryEventType[],
  ) {
    return rows.flatMap((row) => {
      const base = {
        sourceType: 'FamilyMembership',
        sourceId: row.id,
        familyId: row.familyId,
        personId: row.personId,
        details: {
          isReference: row.isReference,
          relationshipToReference: row.relationshipToReference,
        },
      };
      return [
        ...(types.includes('MEMBERSHIP_STARTED')
          ? [
              event({
                ...base,
                type: 'MEMBERSHIP_STARTED',
                occurredAt: row.validFrom.toISOString(),
              }),
            ]
          : []),
        ...(row.validUntil && types.includes('MEMBERSHIP_ENDED')
          ? [
              event({
                ...base,
                type: 'MEMBERSHIP_ENDED',
                occurredAt: row.validUntil.toISOString(),
              }),
            ]
          : []),
      ];
    });
  }
  async function attendanceEvents(where: Prisma.AttendanceWhereInput) {
    const rows = await tx.attendance.findMany({
      where,
      select: attendanceSelect,
    });
    return rows.map((row) =>
      event({
        type: 'ATTENDANCE',
        occurredAt: row.session.occurredAt.toISOString(),
        recordedAt: row.recordedAt.toISOString(),
        sourceType: 'Attendance',
        sourceId: row.id,
        familyId: row.familyId,
        personId: row.personId,
        activityId: row.session.activityId,
        // Canceled sessions and superseded duplicates stay retrievable, apart from valid facts.
        valid: row.session.status === 'COMPLETED' && !row.supersededById,
        invalidReason: row.supersededById
          ? 'SUPERSEDED'
          : row.session.status === 'CANCELED'
            ? 'SESSION_CANCELED'
            : null,
        details: { status: row.status, sessionId: row.session.id },
      }),
    );
  }
  return {
    async catalog() {
      return {
        institutes: (await tx.institute.findMany({ select: { id: true } })).map(
          (row) => row.id,
        ),
        projects: await tx.project.findMany({
          select: { id: true, instituteId: true },
        }),
        activities: await tx.activity.findMany({
          select: { id: true, projectId: true, name: true },
          orderBy: { id: 'asc' },
        }),
      };
    },
    async reachFacts(activityIds, from, toExclusive) {
      const sessions = await tx.activitySession.findMany({
        where: {
          activityId: { in: [...activityIds] },
          status: 'COMPLETED',
          occurredAt: { gte: new Date(from), lt: new Date(toExclusive) },
        },
        select: {
          id: true,
          activityId: true,
          occurredAt: true,
          revision: true,
        },
        orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      });
      const presences = await tx.attendance.findMany({
        where: {
          sessionId: { in: sessions.map((row) => row.id) },
          status: 'PRESENT',
          supersededById: null,
        },
        select: {
          id: true,
          sessionId: true,
          personId: true,
          familyId: true,
          revision: true,
          // Minimal projection: nothing beyond the identification of person and family.
          person: { select: { name: true } },
          family: { select: { code: true } },
          session: { select: { activityId: true, occurredAt: true } },
        },
        orderBy: { id: 'asc' },
      });
      return {
        sessions: sessions.map((row) => ({
          ...row,
          occurredAt: row.occurredAt.toISOString(),
        })),
        presences: presences.map(({ person, family, session, ...row }) => ({
          ...row,
          activityId: session.activityId,
          occurredAt: session.occurredAt.toISOString(),
          personName: person.name,
          familyCode: String(family.code),
        })),
      };
    },
    attendanceSources: (activityId) =>
      attendanceTransactionPorts(tx, false).sources(activityId),
    async qualityIssues({ from, toExclusive, dateBasis, kind, status }) {
      const range = { gte: new Date(from), lt: new Date(toExclusive) };
      const rows = await tx.dataQualityIssue.findMany({
        where: {
          kind,
          AND: [
            dateBasis === 'RESOLUTION'
              ? { resolvedAt: range }
              : { identifiedAt: range },
            status === 'OPEN'
              ? { resolvedAt: null }
              : status === 'RESOLVED'
                ? { resolvedAt: { not: null } }
                : {},
          ],
        },
        orderBy: [{ identifiedAt: 'desc' }, { id: 'desc' }],
      });
      return rows.map((row) =>
        dataQualityIssueSchema.parse({
          ...row,
          identifiedAt: row.identifiedAt.toISOString(),
          resolvedAt: row.resolvedAt?.toISOString() ?? null,
        }),
      );
    },
    async canonicalFamily(id) {
      const family = await tx.family.findUnique({
        where: { id: await canonicalId(tx, 'family', id) },
        select: { id: true, code: true },
      });
      return family ? { id: family.id, code: String(family.code) } : null;
    },
    async canonicalPerson(id) {
      return tx.person.findUnique({
        where: { id: await canonicalId(tx, 'person', id) },
        select: { id: true, name: true },
      });
    },
    async familyEvents(familyId, types) {
      const events: HistoryEvent[] = [];
      const origins = await aliases('Family', familyId);
      if (wants(types, 'MEMBERSHIP_STARTED', 'MEMBERSHIP_ENDED'))
        events.push(
          ...membershipEvents(
            await tx.familyMembership.findMany({
              where: { familyId, supersededById: null },
              select: membershipSelect,
            }),
            types,
          ),
        );
      if (wants(types, 'ATTENDANCE'))
        events.push(...(await attendanceEvents({ familyId: { in: origins } })));
      if (wants(types, 'SOCIAL_FORM'))
        for (const row of await tx.socialForm.findMany({
          where: { familyId: { in: origins } },
          select: {
            id: true,
            familyId: true,
            version: true,
            occurredAt: true,
            recordedAt: true,
            correctionOfFormId: true,
          },
        }))
          // A published version is a snapshot of the form, never a service that was provided.
          events.push(
            event({
              type: 'SOCIAL_FORM',
              occurredAt: row.occurredAt.toISOString(),
              recordedAt: row.recordedAt.toISOString(),
              sourceType: 'SocialForm',
              sourceId: row.id,
              familyId,
              personId: null,
              details: {
                version: row.version,
                originFamilyId: row.familyId === familyId ? null : row.familyId,
                isCorrection: row.correctionOfFormId !== null,
              },
            }),
          );
      if (wants(types, 'ELIGIBILITY_ASSESSMENT'))
        for (const row of await tx.eligibilityAssessment.findMany({
          where: { familyId: { in: origins } },
          select: {
            id: true,
            familyId: true,
            referenceDate: true,
            evaluatedAt: true,
            status: true,
            policyId: true,
          },
        })) {
          const referenceDate = row.referenceDate.toISOString().slice(0, 10);
          events.push(
            event({
              type: 'ELIGIBILITY_ASSESSMENT',
              occurredAt: civilBoundary(referenceDate, timeZone),
              referenceDate,
              recordedAt: row.evaluatedAt.toISOString(),
              sourceType: 'EligibilityAssessment',
              sourceId: row.id,
              familyId: row.familyId,
              personId: null,
              details: { status: row.status, policyId: row.policyId },
            }),
          );
        }
      return events;
    },
    async personEvents(personId, types) {
      const events: HistoryEvent[] = [];
      const identities = await aliases('Person', personId);
      if (wants(types, 'MEMBERSHIP_STARTED', 'MEMBERSHIP_ENDED'))
        events.push(
          ...membershipEvents(
            await tx.familyMembership.findMany({
              where: { personId, supersededById: null },
              select: membershipSelect,
            }),
            types,
          ),
        );
      if (wants(types, 'ENROLLMENT_STARTED', 'ENROLLMENT_ENDED'))
        for (const row of await tx.participantEnrollment.findMany({
          where: { personId: { in: identities } },
          select: {
            id: true,
            activityId: true,
            personId: true,
            validFrom: true,
            validUntil: true,
            createdAt: true,
            supersededById: true,
          },
        })) {
          const base = {
            recordedAt: row.createdAt.toISOString(),
            sourceType: 'ParticipantEnrollment',
            sourceId: row.id,
            familyId: null,
            personId: row.personId,
            activityId: row.activityId,
            valid: !row.supersededById,
            invalidReason: row.supersededById ? ('SUPERSEDED' as const) : null,
            details: {},
          };
          if (types.includes('ENROLLMENT_STARTED'))
            events.push(
              event({
                ...base,
                type: 'ENROLLMENT_STARTED',
                occurredAt: row.validFrom.toISOString(),
              }),
            );
          if (row.validUntil && types.includes('ENROLLMENT_ENDED'))
            events.push(
              event({
                ...base,
                type: 'ENROLLMENT_ENDED',
                occurredAt: row.validUntil.toISOString(),
              }),
            );
        }
      if (wants(types, 'ATTENDANCE'))
        events.push(
          ...(await attendanceEvents({ personId: { in: identities } })),
        );
      if (wants(types, 'SOCIAL_FORM'))
        for (const row of await tx.formMember.findMany({
          where: { personId: { in: identities } },
          select: {
            personId: true,
            socialForm: {
              select: {
                id: true,
                familyId: true,
                version: true,
                occurredAt: true,
                recordedAt: true,
              },
            },
          },
        }))
          // Only the fact that the person integrates a version; no block of the form is read.
          events.push(
            event({
              type: 'SOCIAL_FORM',
              occurredAt: row.socialForm.occurredAt.toISOString(),
              recordedAt: row.socialForm.recordedAt.toISOString(),
              sourceType: 'SocialForm',
              sourceId: row.socialForm.id,
              familyId: row.socialForm.familyId,
              personId: row.personId,
              details: { version: row.socialForm.version },
            }),
          );
      return events;
    },
  };
}

export class PrismaReports implements ReportsReader {
  constructor(
    private readonly database: Database,
    private readonly timeZone: string,
  ) {}
  /** One repeatable-read snapshot per report, so totals and rows share a universe. */
  read<T>(work: (ports: ReportsReaderPorts) => Promise<T>): Promise<T> {
    return databaseOperation(() =>
      this.database.$transaction((tx) => work(ports(tx, this.timeZone)), {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 10000,
      }),
    );
  }
}
