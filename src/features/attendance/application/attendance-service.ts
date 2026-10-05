import type {
  Principal,
  CommandContext,
} from '../../access/application/ports.js';
import type { OperationFingerprints } from '../../access/application/account-transactions.js';
import { assertPermission } from '../../access/domain/permissions.js';
import { AuthenticationRequiredError } from '../../access/application/access-errors.js';
import {
  IdempotencyConflictError,
  ResourceNotFoundError,
} from '../../../core/application/errors.js';
import { isMembershipCurrent } from '../../registration/domain/membership-rules.js';
import { civilDateAt } from '../../projects/domain/activity-rules.js';
import {
  AttendanceConflictError,
  AttendanceRevisionConflictError,
  AttendanceRuleError,
} from '../domain/attendance-errors.js';
import {
  assertSessionDate,
  coveredPeriods,
  civilBoundary,
  nextCivilDay,
  summarizeFrequency,
} from '../domain/frequency-rules.js';
import { invalidateCoverage } from './coverage-invalidation.js';
import type {
  AttendanceSources,
  AttendanceContext,
  AttendanceQuery,
  CreateSession,
  MarkingContext,
  SessionResult,
  AttendanceCoverage,
  AttendanceReference,
  FrequencyQuery,
  FrequencyOpportunity,
  SessionsQuery,
  UpdateAttendance,
  CoverageDeclaration,
  SourceVersion,
  SessionCorrection,
  ContextCorrection,
} from '../domain/attendance.js';
import type {
  AttendanceReader,
  AttendanceReaderPorts,
  AttendanceUnitOfWork,
  AttendanceTransaction,
} from './attendance-ports.js';

export class AttendanceService {
  constructor(
    private readonly reader: AttendanceReader,
    private readonly unitOfWork: AttendanceUnitOfWork,
    private readonly fingerprints: OperationFingerprints,
    private readonly now: () => string,
    private readonly timeZone: string,
  ) {}
  private require<T>(value: T | null | undefined): T {
    if (!value) throw new ResourceNotFoundError();
    return value;
  }
  private revision(value: { revision: number }, expected: number) {
    if (value.revision !== expected)
      throw new AttendanceRevisionConflictError(value.revision);
  }
  private read<T>(
    actor: Principal,
    work: (ports: AttendanceReaderPorts) => Promise<T>,
  ) {
    assertPermission(
      actor.user.roleCodes,
      actor.user.mustChangePassword,
      'attendance.read',
    );
    return this.reader.read(work);
  }
  private command(
    context: CommandContext,
    type: string,
    input: unknown,
    kind: AttendanceReference['kind'],
    work: (
      tx: AttendanceTransaction,
      operationId: string,
    ) => Promise<SessionResult | AttendanceCoverage>,
  ) {
    return this.unitOfWork.run(context.actor.user.id, async (tx) => {
      const actor = await tx.actor(context.actor.user.id);
      if (
        !actor?.user.active ||
        actor.authVersion !== context.actor.authVersion
      )
        throw new AuthenticationRequiredError();
      assertPermission(
        actor.user.roleCodes,
        actor.user.mustChangePassword,
        'attendance.write',
      );
      const fingerprint = this.fingerprints.calculate({ type, input }, null);
      const existing = await tx.operation(type, context.key);
      if (existing) {
        if (
          existing.actorId !== actor.user.id ||
          existing.reference.kind !== kind ||
          !this.fingerprints.matches(fingerprint, existing.fingerprint)
        )
          throw new IdempotencyConflictError();
        const primary = await tx.restore(existing.reference);
        if (kind === 'COVERAGE' && 'periodStart' in primary) return primary;
        if (!('occurredAt' in primary)) throw new ResourceNotFoundError();
        const attendances = await Promise.all(
          existing.reference.attendances.map(async (ref) => {
            const record = await tx.revision(ref);
            if (!('membershipId' in record)) throw new ResourceNotFoundError();
            return record;
          }),
        );
        return { session: primary, attendances };
      }
      const operationId = await tx.createOperation(
        type,
        context.key,
        actor.user.id,
        fingerprint,
      );
      const result = await work(tx, operationId);
      const primary = 'session' in result ? result.session : result;
      await tx.completeOperation(operationId, {
        kind,
        primary: {
          entityType:
            kind === 'SESSION' ? 'ActivitySession' : 'AttendanceCoverage',
          entityId: primary.id,
          revision: primary.revision,
        },
        attendances:
          'session' in result
            ? result.attendances.map((row) => ({
                entityType: 'Attendance',
                entityId: row.id,
                revision: row.revision,
              }))
            : [],
      });
      return result;
    });
  }
  private roster(
    sources: AttendanceSources,
    query: AttendanceQuery,
  ): AttendanceContext {
    const session = query.sessionId
      ? this.require(sources.sessions.find((row) => row.id === query.sessionId))
      : null;
    const enrollments = sources.enrollments.filter((row) =>
      isMembershipCurrent(row, query.occurredAt),
    );
    const marked = session
      ? sources.attendances.filter((row) => row.sessionId === session.id)
      : [];
    const ids = [
      ...new Set([
        ...enrollments.map((row) => row.personId),
        ...marked.map((row) => row.personId),
        ...query.guestPersonIds,
      ]),
    ].sort();
    const rows = ids.map((id) => {
      const person = this.require(sources.people.find((row) => row.id === id));
      const membership = person.memberships.find((row) =>
        isMembershipCurrent(row, query.occurredAt),
      );
      return {
        personId: id,
        name: person.name,
        expectedPersonRevision: person.revision,
        familyId: membership?.familyId ?? null,
        familyCode: membership?.familyCode ?? null,
        expectedFamilyRevision: membership?.familyRevision ?? null,
        membershipId: membership?.id ?? null,
        expectedMembershipRevision: membership?.revision ?? null,
        enrollmentIds: enrollments
          .filter((row) => row.personId === id)
          .map((row) => row.id)
          .sort(),
        attendance: marked.find((row) => row.personId === id) ?? null,
      };
    });
    const value = {
      activityId: sources.activity.id,
      projectId: sources.project.id,
      occurredAt: query.occurredAt,
      expectedActivityRevision: sources.activity.revision,
      expectedProjectRevision: sources.project.revision,
      session,
      rows,
    };
    return {
      ...value,
      rosterFingerprint: this.fingerprints.calculate(
        {
          context: value,
          enrollments: enrollments
            .map((row) => ({ id: row.id, revision: row.revision }))
            .sort((a, b) => a.id.localeCompare(b.id)),
        },
        null,
      ),
    };
  }
  private marking(context: AttendanceContext, entry: MarkingContext) {
    const row = context.rows.find((row) => row.personId === entry.personId);
    if (!row || row.membershipId === null)
      throw new AttendanceRuleError('PERSON_WITHOUT_MEMBERSHIP');
    if (
      row.expectedPersonRevision !== entry.expectedPersonRevision ||
      row.familyId !== entry.familyId ||
      row.expectedFamilyRevision !== entry.expectedFamilyRevision ||
      row.membershipId !== entry.membershipId ||
      row.expectedMembershipRevision !== entry.expectedMembershipRevision
    )
      throw new AttendanceConflictError('MARKING_CONTEXT_CHANGED', [
        entry.personId,
      ]);
  }
  context(actor: Principal, activityId: string, query: AttendanceQuery) {
    return this.read<AttendanceContext>(actor, async (tx) => {
      const sources = this.require(
        await tx.sources(activityId, query.guestPersonIds),
      );
      assertSessionDate(
        sources.activity,
        sources.project,
        query.occurredAt,
        this.now(),
        this.timeZone,
      );
      return this.roster(sources, query);
    });
  }
  createSession(
    context: CommandContext,
    activityId: string,
    input: CreateSession,
  ) {
    return this.command(
      context,
      'attendance.sessions.create',
      { activityId, ...input },
      'SESSION',
      async (tx, operationId) => {
        const guestPersonIds = [
          ...new Set([
            ...(input.guestPersonIds ?? []),
            ...input.entries.map((row) => row.personId),
          ]),
        ].sort();
        const sources = this.require(
          await tx.sources(activityId, guestPersonIds),
        );
        this.revision(sources.activity, input.expectedActivityRevision);
        assertSessionDate(
          sources.activity,
          sources.project,
          input.occurredAt,
          this.now(),
          this.timeZone,
        );
        if (!(await tx.accountExists(input.responsibleId)))
          throw new ResourceNotFoundError();
        const preview = this.roster(sources, {
          occurredAt: input.occurredAt,
          guestPersonIds,
        });
        if (preview.rosterFingerprint !== input.expectedRosterFingerprint)
          throw new AttendanceConflictError('ROSTER_CHANGED');
        for (const entry of input.entries) this.marking(preview, entry);
        const session = await tx.createSession(
          activityId,
          input.responsibleId,
          input.occurredAt,
          context.actor.user.id,
        );
        await tx.audit(
          operationId,
          context.actor.user.id,
          'ActivitySession',
          null,
          session,
          'CREATE',
          undefined,
          input.occurredAt,
        );
        const attendances = [];
        for (const entry of input.entries) {
          const attendance = await tx.createAttendance(
            session.id,
            entry,
            context.actor.user.id,
          );
          await tx.audit(
            operationId,
            context.actor.user.id,
            'Attendance',
            null,
            attendance,
            'CREATE',
            undefined,
            input.occurredAt,
          );
          attendances.push(attendance);
        }
        await this.invalidateDays(
          tx,
          sources,
          operationId,
          context.actor.user.id,
          [session.occurredAt],
          'SESSION_CREATED',
        );
        return { session, attendances };
      },
    );
  }
  session(actor: Principal, id: string) {
    return this.read(actor, async (tx) => {
      const session = this.require(await tx.session(id));
      const sources = this.require(await tx.sources(session.activityId));
      return {
        session,
        attendances: sources.attendances.filter((row) => row.sessionId === id),
        context: this.roster(sources, {
          occurredAt: session.occurredAt,
          sessionId: id,
          guestPersonIds: [],
        }),
      };
    });
  }
  updateAttendance(
    context: CommandContext,
    id: string,
    input: UpdateAttendance,
  ) {
    return this.command(
      context,
      'attendance.markings.update',
      { id, ...input },
      'SESSION',
      async (tx, operationId) => {
        const initial = this.require(await tx.session(id));
        const sources = this.require(
          await tx.sources(initial.activityId, [
            ...(input.guestPersonIds ?? []),
            ...input.entries.map((row) => row.personId),
          ]),
        );
        const before = this.require(
          sources.sessions.find((row) => row.id === id),
        );
        this.revision(before, input.expectedSessionRevision);
        if (before.status === 'CANCELED')
          throw new AttendanceRuleError('SESSION_CANCELED');
        const preview = this.roster(sources, {
          occurredAt: before.occurredAt,
          sessionId: id,
          guestPersonIds: [
            ...new Set([
              ...(input.guestPersonIds ?? []),
              ...input.entries.map((row) => row.personId),
            ]),
          ].sort(),
        });
        if (preview.rosterFingerprint !== input.expectedRosterFingerprint)
          throw new AttendanceConflictError('ROSTER_CHANGED');
        const attendances = sources.attendances.filter(
          (row) => row.sessionId === id,
        );
        for (const entry of input.entries) {
          const current = attendances.find(
            (row) => row.personId === entry.personId,
          );
          if (entry.expectedRevision === null) {
            if (current)
              throw new AttendanceRevisionConflictError(current.revision);
            this.marking(preview, entry);
          } else {
            if (!current)
              throw new AttendanceConflictError('MARKING_MISSING', [
                entry.personId,
              ]);
            this.revision(current, entry.expectedRevision);
          }
        }
        let changed = false;
        for (const entry of input.entries) {
          const index = attendances.findIndex(
            (row) => row.personId === entry.personId,
          );
          const current = attendances[index];
          if (current?.status === entry.status) continue;
          const after =
            entry.expectedRevision === null
              ? await tx.createAttendance(id, entry, context.actor.user.id)
              : await tx.updateAttendance(this.require(current).id, {
                  status: entry.status,
                });
          await tx.audit(
            operationId,
            context.actor.user.id,
            'Attendance',
            current ?? null,
            after,
            current ? 'CORRECT' : 'CREATE',
            input.reason,
            before.occurredAt,
          );
          if (index < 0) attendances.push(after);
          else attendances[index] = after;
          changed = true;
        }
        const session = changed ? await tx.updateSession(id, {}) : before;
        if (changed) {
          await tx.audit(
            operationId,
            context.actor.user.id,
            'ActivitySession',
            before,
            session,
            'CORRECT',
            input.reason,
            before.occurredAt,
          );
          await this.invalidateDays(
            tx,
            sources,
            operationId,
            context.actor.user.id,
            [session.occurredAt],
            'ATTENDANCE_CORRECTED',
          );
        }
        return {
          session,
          attendances: attendances.sort((a, b) => a.id.localeCompare(b.id)),
        };
      },
    );
  }
  cancelSession(
    context: CommandContext,
    id: string,
    input: { expectedSessionRevision: number; reason: string },
  ) {
    return this.command(
      context,
      'attendance.sessions.cancel',
      { id, ...input },
      'SESSION',
      async (tx, operationId) => {
        const initial = this.require(await tx.session(id));
        const sources = this.require(await tx.sources(initial.activityId));
        const before = this.require(
          sources.sessions.find((row) => row.id === id),
        );
        this.revision(before, input.expectedSessionRevision);
        if (before.status === 'CANCELED')
          throw new AttendanceRuleError('SESSION_CANCELED');
        const session = await tx.updateSession(id, { status: 'CANCELED' });
        await tx.audit(
          operationId,
          context.actor.user.id,
          'ActivitySession',
          before,
          session,
          'CANCEL',
          input.reason,
          before.occurredAt,
        );
        await this.invalidateDays(
          tx,
          sources,
          operationId,
          context.actor.user.id,
          [session.occurredAt],
          'SESSION_CANCELED',
        );
        return {
          session,
          attendances: sources.attendances.filter(
            (row) => row.sessionId === id,
          ),
        };
      },
    );
  }
  correctSession(
    context: CommandContext,
    id: string,
    input: SessionCorrection,
  ) {
    return this.command(
      context,
      'attendance.sessions.correct',
      { id, ...input },
      'SESSION',
      async (tx, operationId) => {
        const initial = this.require(await tx.session(id));
        const sources = this.require(await tx.sources(initial.activityId));
        const before = this.require(
          sources.sessions.find((row) => row.id === id),
        );
        this.revision(before, input.expectedSessionRevision);
        if (before.status === 'CANCELED')
          throw new AttendanceRuleError('SESSION_CANCELED');
        const occurredAt = input.occurredAt ?? before.occurredAt;
        const responsibleId = input.responsibleId ?? before.responsibleId;
        assertSessionDate(
          sources.activity,
          sources.project,
          occurredAt,
          this.now(),
          this.timeZone,
        );
        if (!(await tx.accountExists(responsibleId)))
          throw new ResourceNotFoundError();
        const attendances = sources.attendances.filter(
          (row) => row.sessionId === id,
        );
        const preview = this.roster(sources, {
          occurredAt,
          sessionId: id,
          guestPersonIds: [],
        });
        const affected = attendances.filter((row) => {
          const next = preview.rows.find(
            (item) => item.personId === row.personId,
          );
          return (
            next?.membershipId !== row.membershipId ||
            next.familyId !== row.familyId
          );
        });
        const previousPreview = this.roster(sources, {
          occurredAt: before.occurredAt,
          sessionId: id,
          guestPersonIds: [],
        });
        const rosterIdentity = (value: AttendanceContext) =>
          value.rows.map((row) => ({
            personId: row.personId,
            enrollmentIds: row.enrollmentIds,
            familyId: row.familyId,
            membershipId: row.membershipId,
          }));
        const rosterChanged =
          this.fingerprints.calculate(rosterIdentity(preview), null) !==
          this.fingerprints.calculate(rosterIdentity(previousPreview), null);
        if (
          (affected.length || rosterChanged) &&
          input.expectedRosterFingerprint === undefined
        )
          throw new AttendanceConflictError(
            'SESSION_CONTEXT_RECONCILIATION_REQUIRED',
            affected.map((row) => row.id),
          );
        if (
          input.expectedRosterFingerprint !== undefined &&
          input.expectedRosterFingerprint !== preview.rosterFingerprint
        )
          throw new AttendanceConflictError('ROSTER_CHANGED');
        const corrections = input.contextCorrections ?? [];
        if (
          affected.some(
            (row) =>
              !corrections.some((item) => item.personId === row.personId),
          )
        )
          throw new AttendanceConflictError(
            'SESSION_CONTEXT_RECONCILIATION_REQUIRED',
            affected.map((row) => row.id),
          );
        for (const correction of corrections) {
          const current = this.require(
            attendances.find((row) => row.personId === correction.personId),
          );
          this.revision(current, correction.expectedRevision);
          this.marking(preview, correction);
        }
        let changed =
          occurredAt !== before.occurredAt ||
          responsibleId !== before.responsibleId;
        for (const correction of corrections) {
          const index = attendances.findIndex(
            (row) => row.personId === correction.personId,
          );
          const current = attendances[index]!;
          if (
            current.familyId === correction.familyId &&
            current.membershipId === correction.membershipId &&
            current.membershipRevision === correction.expectedMembershipRevision
          )
            continue;
          const after = await tx.updateAttendance(current.id, {
            familyId: correction.familyId,
            membershipId: correction.membershipId,
            membershipRevision: correction.expectedMembershipRevision,
          });
          await tx.audit(
            operationId,
            context.actor.user.id,
            'Attendance',
            current,
            after,
            'CORRECT',
            input.reason,
            occurredAt,
          );
          attendances[index] = after;
          changed = true;
        }
        const session = changed
          ? await tx.updateSession(id, { occurredAt, responsibleId })
          : before;
        if (changed) {
          await tx.audit(
            operationId,
            context.actor.user.id,
            'ActivitySession',
            before,
            session,
            'CORRECT',
            input.reason,
            occurredAt,
          );
          await this.invalidateDays(
            tx,
            sources,
            operationId,
            context.actor.user.id,
            [before.occurredAt, occurredAt],
            'SESSION_CORRECTED',
          );
        }
        return { session, attendances };
      },
    );
  }
  correctContext(
    context: CommandContext,
    id: string,
    input: ContextCorrection,
  ) {
    return this.command(
      context,
      'attendance.context.correct',
      { id, ...input },
      'SESSION',
      async (tx, operationId) => {
        const initial = this.require(await tx.attendance(id));
        const initialSession = this.require(
          await tx.session(initial.sessionId),
        );
        const sources = this.require(
          await tx.sources(initialSession.activityId, [initial.personId]),
        );
        const before = this.require(
          sources.attendances.find((row) => row.id === id),
        );
        const sessionBefore = this.require(
          sources.sessions.find((row) => row.id === before.sessionId),
        );
        this.revision(before, input.expectedRevision);
        this.revision(sessionBefore, input.expectedSessionRevision);
        if (sessionBefore.status === 'CANCELED')
          throw new AttendanceRuleError('SESSION_CANCELED');
        const preview = this.roster(sources, {
          occurredAt: sessionBefore.occurredAt,
          sessionId: sessionBefore.id,
          guestPersonIds: [],
        });
        this.marking(preview, { personId: before.personId, ...input });
        const unchanged =
          before.familyId === input.familyId &&
          before.membershipId === input.membershipId &&
          before.membershipRevision === input.expectedMembershipRevision;
        const after = unchanged
          ? before
          : await tx.updateAttendance(id, {
              familyId: input.familyId,
              membershipId: input.membershipId,
              membershipRevision: input.expectedMembershipRevision,
            });
        const session = unchanged
          ? sessionBefore
          : await tx.updateSession(sessionBefore.id, {});
        if (!unchanged) {
          await tx.audit(
            operationId,
            context.actor.user.id,
            'Attendance',
            before,
            after,
            'CORRECT',
            input.reason,
            session.occurredAt,
          );
          await tx.audit(
            operationId,
            context.actor.user.id,
            'ActivitySession',
            sessionBefore,
            session,
            'CORRECT',
            input.reason,
            session.occurredAt,
          );
          await this.invalidateDays(
            tx,
            sources,
            operationId,
            context.actor.user.id,
            [session.occurredAt],
            'ATTENDANCE_CONTEXT_CORRECTED',
          );
        }
        return {
          session,
          attendances: sources.attendances
            .filter((row) => row.sessionId === session.id)
            .map((row) => (row.id === id ? after : row)),
        };
      },
    );
  }
  sessions(actor: Principal, activityId: string, query: SessionsQuery) {
    return this.read(actor, async (tx) => {
      const sources = this.require(await tx.sources(activityId));
      const rows = sources.sessions
        .filter(
          (row) =>
            (!query.status || row.status === query.status) &&
            (!query.from || row.occurredAt >= query.from) &&
            (!query.toExclusive || row.occurredAt < query.toExclusive),
        )
        .sort(
          (a, b) =>
            b.occurredAt.localeCompare(a.occurredAt) ||
            a.id.localeCompare(b.id),
        );
      return {
        data: rows.slice(
          (query.page - 1) * query.pageSize,
          query.page * query.pageSize,
        ),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total: rows.length,
        },
      };
    });
  }
  frequency(actor: Principal, query: FrequencyQuery) {
    assertPermission(
      actor.user.roleCodes,
      actor.user.mustChangePassword,
      'attendance.read',
    );
    return this.queryFrequency(query);
  }
  queryFrequency(query: FrequencyQuery) {
    if (
      !Number.isFinite(Date.parse(query.from)) ||
      !Number.isFinite(Date.parse(query.toExclusive)) ||
      Date.parse(query.from) >= Date.parse(query.toExclusive)
    )
      throw new AttendanceRuleError('INVALID_FREQUENCY_PERIOD');
    query = {
      ...query,
      from: new Date(query.from).toISOString(),
      toExclusive: new Date(query.toExclusive).toISOString(),
    };
    return this.reader.read(async (tx) => {
      const sources = this.require(
        await tx.sources(query.activityId, [query.personId]),
      );
      if (sources.activity.nature !== 'PERIODIC')
        throw new AttendanceRuleError('PERIODIC_ACTIVITY_REQUIRED');
      const person = this.require(
        sources.people.find((row) => row.id === query.personId),
      );
      const opportunities: FrequencyOpportunity[] = [];
      for (const session of sources.sessions.filter(
        (row) =>
          row.status === 'COMPLETED' &&
          row.occurredAt >= query.from &&
          row.occurredAt < query.toExclusive,
      )) {
        const enrolled = sources.enrollments.filter(
          (row) =>
            row.personId === query.personId &&
            isMembershipCurrent(row, session.occurredAt),
        );
        const attendance =
          sources.attendances.find(
            (row) =>
              row.sessionId === session.id && row.personId === query.personId,
          ) ?? null;
        if (!enrolled.length && !attendance) continue;
        const membership = person.memberships.find((row) =>
          isMembershipCurrent(row, session.occurredAt),
        );
        opportunities.push({
          personId: query.personId,
          sessionId: session.id,
          occurredAt: session.occurredAt,
          familyId: attendance?.familyId ?? membership?.familyId ?? null,
          membershipId: attendance?.membershipId ?? membership?.id ?? null,
          membershipRevision:
            attendance?.membershipRevision ?? membership?.revision ?? null,
          relevance: attendance
            ? enrolled.length
              ? 'BOTH'
              : 'RECORDED'
            : 'ENROLLMENT',
          attendance,
          sessionRevision: session.revision,
          enrollmentRevisions: enrolled.map((row) => ({
            entityType: 'ParticipantEnrollment',
            entityId: row.id,
            revision: row.revision,
          })),
          contextResolved: attendance !== null || membership !== undefined,
        });
      }
      const periodStart = civilDateAt(query.from, this.timeZone);
      const periodEndExclusive = nextCivilDay(
        civilDateAt(
          new Date(Date.parse(query.toExclusive) - 1).toISOString(),
          this.timeZone,
        ),
      );
      const coverage = coveredPeriods(
        periodStart,
        periodEndExclusive,
        sources.declarations,
      );
      return {
        personId: query.personId,
        activityId: query.activityId,
        from: query.from,
        toExclusive: query.toExclusive,
        familyId: query.familyId ?? null,
        denominator: 'ENROLLMENT_OR_RECORDED' as const,
        ...summarizeFrequency(
          opportunities,
          coverage.isComplete,
          query.familyId,
        ),
        coverageRevisions: sources.declarations
          .filter(
            (row) =>
              row.periodStart < periodEndExclusive &&
              row.periodEndExclusive > periodStart,
          )
          .map((row) => ({
            entityType: 'AttendanceCoverage',
            entityId: row.id,
            revision: row.revision,
          })),
      };
    });
  }
  private invalidateDays(
    tx: AttendanceTransaction,
    sources: AttendanceSources,
    operationId: string,
    actorId: string,
    instants: string[],
    reason: string,
  ) {
    const days = [
      ...new Set(instants.map((at) => civilDateAt(at, this.timeZone))),
    ];
    return invalidateCoverage(
      tx,
      sources.declarations,
      days.map((day) => ({ from: day, toExclusive: nextCivilDay(day) })),
      operationId,
      actorId,
      this.now(),
      reason,
    );
  }
  private coverageView(
    sources: AttendanceSources,
    periodStart: string,
    periodEndExclusive: string,
  ) {
    const from = civilBoundary(periodStart, this.timeZone);
    const toExclusive = civilBoundary(periodEndExclusive, this.timeZone);
    const sessions = sources.sessions.filter(
      (row) => row.occurredAt >= from && row.occurredAt < toExclusive,
    );
    const sessionIds = new Set(sessions.map((row) => row.id));
    const sourceVersions: SourceVersion[] = [
      ...sessions.map((row) => ({
        entityType: 'ActivitySession',
        entityId: row.id,
        revision: row.revision,
      })),
      ...sources.attendances
        .filter((row) => sessionIds.has(row.sessionId))
        .map((row) => ({
          entityType: 'Attendance',
          entityId: row.id,
          revision: row.revision,
        })),
      ...sources.enrollments
        .filter(
          (row) =>
            row.validFrom < toExclusive &&
            (row.validUntil === null || row.validUntil > from),
        )
        .map((row) => ({
          entityType: 'ParticipantEnrollment',
          entityId: row.id,
          revision: row.revision,
        })),
    ].sort(
      (a, b) =>
        a.entityType.localeCompare(b.entityType) ||
        a.entityId.localeCompare(b.entityId),
    );
    const declarations = sources.declarations.filter(
      (row) =>
        row.periodStart < periodEndExclusive &&
        row.periodEndExclusive > periodStart,
    );
    return {
      activityId: sources.activity.id,
      periodStart,
      periodEndExclusive,
      expectedActivityRevision: sources.activity.revision,
      sourceFingerprint: this.fingerprints.calculate(
        {
          activityId: sources.activity.id,
          periodStart,
          periodEndExclusive,
          sourceVersions,
        },
        null,
      ),
      sourceVersions,
      declarations,
      ...coveredPeriods(periodStart, periodEndExclusive, declarations),
    };
  }
  coverage(
    actor: Principal,
    activityId: string,
    query: { periodStart: string; periodEndExclusive: string },
  ) {
    return this.read(actor, async (tx) =>
      this.coverageView(
        this.require(await tx.sources(activityId)),
        query.periodStart,
        query.periodEndExclusive,
      ),
    );
  }
  declareCoverage(
    context: CommandContext,
    activityId: string,
    input: CoverageDeclaration,
  ) {
    return this.command(
      context,
      'attendance.coverage.declare',
      { activityId, ...input },
      'COVERAGE',
      async (tx, operationId) => {
        if (input.periodEndExclusive > civilDateAt(this.now(), this.timeZone))
          throw new AttendanceRuleError('COVERAGE_PERIOD_NOT_CLOSED');
        const sources = this.require(await tx.sources(activityId));
        if (sources.activity.nature !== 'PERIODIC')
          throw new AttendanceRuleError('PERIODIC_ACTIVITY_REQUIRED');
        this.revision(sources.activity, input.expectedActivityRevision);
        const view = this.coverageView(
          sources,
          input.periodStart,
          input.periodEndExclusive,
        );
        if (view.sourceFingerprint !== input.expectedSourceFingerprint)
          throw new AttendanceConflictError('COVERAGE_SOURCES_CHANGED');
        const after = await tx.createCoverage({
          activityId,
          periodStart: input.periodStart,
          periodEndExclusive: input.periodEndExclusive,
          declaredBy: context.actor.user.id,
          sourceVersions: view.sourceVersions,
        });
        await tx.audit(
          operationId,
          context.actor.user.id,
          'AttendanceCoverage',
          null,
          after,
          'CREATE',
          input.reason,
        );
        return after;
      },
    );
  }
}
