import type {
  CommandContext,
  Principal,
} from '../../access/application/ports.js';
import type { OperationFingerprints } from '../../access/application/account-transactions.js';
import { assertPermission } from '../../access/domain/permissions.js';
import { AuthenticationRequiredError } from '../../access/application/access-errors.js';
import {
  ResourceNotFoundError,
  IdempotencyConflictError,
} from '../../../core/application/errors.js';
import {
  AttendanceConflictError,
  AttendanceRevisionConflictError,
} from '../../attendance/domain/attendance-errors.js';
import {
  isMembershipCurrent,
  assertMembershipPlan,
} from '../domain/membership-rules.js';
import {
  invalidateCoverage,
  changedCivilPeriods,
} from '../../attendance/application/coverage-invalidation.js';
import { nextCivilDay } from '../../attendance/domain/frequency-rules.js';
import { civilDateAt } from '../../projects/domain/activity-rules.js';
import type {
  ReconciliationPlan,
  ReconciliationCommand,
  ReconciliationSources,
  ReconciliationReference,
  ReconciliationResult,
  MembershipChange,
} from '../domain/membership-reconciliation.js';
import type { RegisteredMembership } from '../domain/registration.js';
import type { SourceVersion } from '../../attendance/domain/attendance.js';
import type {
  ReconciliationPorts,
  ReconciliationReader,
  ReconciliationUnitOfWork,
} from './membership-reconciliation-ports.js';

export class MembershipReconciliationService {
  constructor(
    private readonly reader: ReconciliationReader,
    private readonly unitOfWork: ReconciliationUnitOfWork,
    private readonly fingerprints: OperationFingerprints,
    private readonly now: () => string,
    private readonly timeZone: string,
  ) {}
  private require<T>(value: T | null | undefined): T {
    if (!value) throw new ResourceNotFoundError();
    return value;
  }
  private authorize(actor: Principal, plan: ReconciliationPlan) {
    assertPermission(
      actor.user.roleCodes,
      actor.user.mustChangePassword,
      'registration.write',
    );
    if (plan.attendanceContextChanges.length)
      assertPermission(
        actor.user.roleCodes,
        actor.user.mustChangePassword,
        'attendance.write',
      );
  }
  private revision(value: { revision: number }, expected: number) {
    if (value.revision !== expected)
      throw new AttendanceRevisionConflictError(value.revision);
  }
  private async sources(
    tx: ReconciliationPorts,
    personId: string,
    familyIds: string[],
  ): Promise<ReconciliationSources> {
    const person = this.require(await tx.registration.findPerson(personId));
    const memberships = await tx.registration.memberships(familyIds, [
      personId,
    ]);
    const ids = [
      ...new Set([
        ...familyIds,
        ...memberships
          .filter((row) => row.personId === personId)
          .map((row) => row.familyId),
      ]),
    ].sort();
    const families = [];
    for (const id of ids)
      families.push(this.require(await tx.registration.findFamily(id)));
    const activities = [];
    for (const id of await tx.activityIdsForPerson(personId))
      activities.push(
        this.require(await tx.attendance.sources(id, [personId])),
      );
    return { person, memberships, families, activities };
  }
  private changed(before: RegisteredMembership, change: MembershipChange) {
    return (
      before.validFrom !== change.validFrom ||
      before.validUntil !== change.validUntil ||
      before.isReference !== change.isReference ||
      before.relationshipToReference !== change.relationshipToReference
    );
  }
  private previewState(
    sources: ReconciliationSources,
    plan: ReconciliationPlan,
  ) {
    this.revision(sources.person, plan.expectedPersonRevision);
    const requiredFamilies = new Set(
      plan.membershipChanges.map((change) =>
        'membershipId' in change
          ? this.require(
              sources.memberships.find(
                (row) =>
                  row.id === change.membershipId &&
                  row.personId === sources.person.id,
              ),
            ).familyId
          : change.familyId,
      ),
    );
    for (const id of requiredFamilies) {
      const reference = plan.familyRevisions.find((row) => row.familyId === id);
      if (!reference)
        throw new AttendanceConflictError('FAMILY_REVISION_REQUIRED', [id]);
      this.revision(
        this.require(sources.families.find((row) => row.id === id)),
        reference.expectedRevision,
      );
    }
    for (const reference of plan.familyRevisions)
      this.revision(
        this.require(
          sources.families.find((row) => row.id === reference.familyId),
        ),
        reference.expectedRevision,
      );
    const proposedMemberships = sources.memberships.map((row) => ({ ...row }));
    for (const change of plan.membershipChanges) {
      if ('membershipId' in change) {
        const before = this.require(
          proposedMemberships.find(
            (row) =>
              row.id === change.membershipId &&
              row.personId === sources.person.id,
          ),
        );
        this.revision(before, change.expectedRevision);
        Object.assign(before, {
          validFrom: change.validFrom,
          validUntil: change.validUntil,
          isReference: change.isReference,
          relationshipToReference: change.relationshipToReference,
          revision: before.revision + (this.changed(before, change) ? 1 : 0),
        });
      } else
        proposedMemberships.push({
          id: `new:${change.clientRef}`,
          personId: sources.person.id,
          familyId: change.familyId,
          validFrom: change.validFrom,
          validUntil: change.validUntil,
          isReference: change.isReference,
          relationshipToReference: change.relationshipToReference,
          revision: 1,
        });
    }
    assertMembershipPlan(proposedMemberships, this.now());
    const attendances = sources.activities.flatMap((source) =>
      source.attendances.filter((row) => row.personId === sources.person.id),
    );
    const sessions = sources.activities.flatMap((source) => source.sessions);
    const effective = attendances.filter((row) =>
      sessions.some(
        (session) =>
          session.id === row.sessionId && session.status === 'COMPLETED',
      ),
    );
    const conflicts: string[] = [];
    const affectedAttendanceIds: string[] = [];
    for (const change of plan.attendanceContextChanges) {
      const marking = this.require(
        effective.find((row) => row.id === change.attendanceId),
      );
      if (marking.sessionId !== change.sessionId)
        throw new AttendanceConflictError('RECONCILIATION_CONTEXT_CHANGED', [
          marking.id,
        ]);
      this.revision(marking, change.expectedRevision);
      this.revision(
        this.require(sessions.find((row) => row.id === change.sessionId)),
        change.expectedSessionRevision,
      );
    }
    for (const marking of effective) {
      const session = this.require(
        sessions.find((row) => row.id === marking.sessionId),
      );
      const correction = plan.attendanceContextChanges.find(
        (row) => row.attendanceId === marking.id,
      );
      const key = correction
        ? 'id' in correction.membership
          ? correction.membership.id
          : `new:${correction.membership.clientRef}`
        : marking.membershipId;
      const membership = proposedMemberships.find(
        (row) => row.id === key && row.personId === marking.personId,
      );
      const valid =
        membership && isMembershipCurrent(membership, session.occurredAt);
      if (!valid || (!correction && membership.familyId !== marking.familyId))
        conflicts.push(marking.id);
      if (correction || !valid) affectedAttendanceIds.push(marking.id);
    }
    const sourceVersions: SourceVersion[] = [
      {
        entityType: 'Person',
        entityId: sources.person.id,
        revision: sources.person.revision,
      },
      ...sources.memberships.map((row) => ({
        entityType: 'FamilyMembership',
        entityId: row.id,
        revision: row.revision,
      })),
      ...sources.families.map((row) => ({
        entityType: 'Family',
        entityId: row.id,
        revision: row.revision,
      })),
      ...attendances.map((row) => ({
        entityType: 'Attendance',
        entityId: row.id,
        revision: row.revision,
      })),
      ...sessions.map((row) => ({
        entityType: 'ActivitySession',
        entityId: row.id,
        revision: row.revision,
      })),
      ...sources.activities.flatMap((source) => [
        ...source.enrollments
          .filter((row) => row.personId === sources.person.id)
          .map((row) => ({
            entityType: 'ParticipantEnrollment',
            entityId: row.id,
            revision: row.revision,
          })),
        ...source.declarations.map((row) => ({
          entityType: 'AttendanceCoverage',
          entityId: row.id,
          revision: row.revision,
        })),
      ]),
    ].sort(
      (a, b) =>
        a.entityType.localeCompare(b.entityType) ||
        a.entityId.localeCompare(b.entityId),
    );
    return {
      sourceFingerprint: this.fingerprints.calculate(
        { personId: sources.person.id, plan, sourceVersions },
        null,
      ),
      sourceVersions,
      conflicts,
      affectedAttendanceIds,
      proposedMemberships: proposedMemberships.filter(
        (row) => row.personId === sources.person.id,
      ),
    };
  }
  preview(actor: Principal, personId: string, plan: ReconciliationPlan) {
    this.authorize(actor, plan);
    return this.reader.read(async (tx) =>
      this.previewState(
        await this.sources(
          tx,
          personId,
          plan.familyRevisions.map((row) => row.familyId),
        ),
        plan,
      ),
    );
  }
  confirm(
    context: CommandContext,
    personId: string,
    input: ReconciliationCommand,
  ) {
    const { expectedSourceFingerprint, ...plan } = input;
    return this.unitOfWork.run(
      context.actor.user.id,
      personId,
      plan.familyRevisions.map((row) => row.familyId),
      async (tx) => {
        const actor = await tx.registration.findActor(context.actor.user.id);
        if (
          !actor?.user.active ||
          actor.authVersion !== context.actor.authVersion
        )
          throw new AuthenticationRequiredError();
        this.authorize(actor, plan);
        const type = 'registration.memberships.reconcile';
        const fingerprint = this.fingerprints.calculate(
          { type, personId, input },
          null,
        );
        const existing = await tx.operation(type, context.key);
        if (existing) {
          if (
            existing.actorId !== actor.user.id ||
            !this.fingerprints.matches(existing.fingerprint, fingerprint)
          )
            throw new IdempotencyConflictError();
          return tx.restore(existing.reference);
        }
        const sources = await this.sources(
          tx,
          personId,
          plan.familyRevisions.map((row) => row.familyId),
        );
        const preview = this.previewState(sources, plan);
        if (preview.sourceFingerprint !== expectedSourceFingerprint)
          throw new AttendanceConflictError('RECONCILIATION_SOURCES_CHANGED');
        if (preview.conflicts.length)
          throw new AttendanceConflictError(
            'MEMBERSHIP_ATTENDANCE_CONFLICT',
            preview.conflicts,
          );
        const operationId = await tx.registration.createOperation(
          type,
          context.key,
          actor.user.id,
          fingerprint,
        );
        const memberships = sources.memberships
          .filter((row) => row.personId === personId)
          .map((row) => ({ ...row }));
        const familyIds = new Set<string>();
        const createdMemberships: ReconciliationResult['createdMemberships'] =
          [];
        const periods: { from: string | null; toExclusive: string | null }[] =
          [];
        for (const change of plan.membershipChanges) {
          if ('membershipId' in change) {
            const index = memberships.findIndex(
              (row) => row.id === change.membershipId,
            );
            const before = memberships[index]!;
            if (!this.changed(before, change)) continue;
            const after = await tx.registration.updateMembership(before.id, {
              validFrom: change.validFrom,
              validUntil: change.validUntil,
              isReference: change.isReference,
              relationshipToReference: change.relationshipToReference,
            });
            await tx.registration.appendMembershipUpdateAudit(
              operationId,
              actor.user.id,
              before,
              after,
              plan.reason,
              'CORRECT',
              change.validFrom,
            );
            periods.push(...changedCivilPeriods(before, after, this.timeZone));
            memberships[index] = after;
            familyIds.add(before.familyId);
          } else {
            const after = await tx.registration.createMembership({
              personId,
              familyId: change.familyId,
              validFrom: change.validFrom,
              validUntil: change.validUntil,
              isReference: change.isReference,
              relationshipToReference: change.relationshipToReference,
            });
            await tx.registration.appendMembershipAudit(
              operationId,
              actor.user.id,
              after,
            );
            createdMemberships.push({
              clientRef: change.clientRef,
              membershipId: after.id,
            });
            periods.push(...changedCivilPeriods(null, after, this.timeZone));
            memberships.push(after);
            familyIds.add(after.familyId);
          }
        }
        const attendances = sources.activities.flatMap((source) =>
          source.attendances.filter((row) => row.personId === personId),
        );
        const changedSessions = new Set<string>();
        for (const change of plan.attendanceContextChanges) {
          const index = attendances.findIndex(
            (row) => row.id === change.attendanceId,
          );
          const before = attendances[index]!;
          const chosen = change.membership;
          const id =
            'id' in chosen
              ? chosen.id
              : this.require(
                  createdMemberships.find(
                    (row) => row.clientRef === chosen.clientRef,
                  ),
                ).membershipId;
          const membership = this.require(
            memberships.find((row) => row.id === id),
          );
          if (
            before.membershipId === id &&
            before.familyId === membership.familyId &&
            before.membershipRevision === membership.revision
          )
            continue;
          const after = await tx.attendance.updateAttendance(before.id, {
            membershipId: id,
            membershipRevision: membership.revision,
            familyId: membership.familyId,
          });
          const session = this.require(
            sources.activities
              .flatMap((source) => source.sessions)
              .find((row) => row.id === before.sessionId),
          );
          await tx.attendance.audit(
            operationId,
            actor.user.id,
            'Attendance',
            before,
            after,
            'CORRECT',
            change.reason,
            session.occurredAt,
          );
          const day = civilDateAt(session.occurredAt, this.timeZone);
          periods.push({ from: day, toExclusive: nextCivilDay(day) });
          attendances[index] = after;
          changedSessions.add(session.id);
        }
        const sessions = [];
        for (const id of [...changedSessions].sort()) {
          const before = this.require(
            sources.activities
              .flatMap((source) => source.sessions)
              .find((row) => row.id === id),
          );
          const after = await tx.attendance.updateSession(id, {});
          await tx.attendance.audit(
            operationId,
            actor.user.id,
            'ActivitySession',
            before,
            after,
            'CORRECT',
            plan.reason,
            before.occurredAt,
          );
          sessions.push(after);
        }
        const families = [];
        for (const before of sources.families) {
          const after = familyIds.has(before.id)
            ? await tx.registration.reviseFamily(before.id)
            : before;
          if (after !== before)
            await tx.registration.appendFamilyUpdateAudit(
              operationId,
              actor.user.id,
              before,
              after,
            );
          families.push(after);
        }
        await invalidateCoverage(
          tx.attendance,
          await tx.registration.personCoverage(personId),
          periods,
          operationId,
          actor.user.id,
          this.now(),
          'MEMBERSHIP_RECONCILED',
        );
        const result = {
          person: sources.person,
          memberships: memberships.sort((a, b) => a.id.localeCompare(b.id)),
          families,
          sessions,
          attendances: attendances.sort((a, b) => a.id.localeCompare(b.id)),
          createdMemberships,
        };
        const ref = (
          entityType: string,
          row: { id: string; revision: number },
        ): SourceVersion => ({
          entityType,
          entityId: row.id,
          revision: row.revision,
        });
        const reference: ReconciliationReference = {
          person: ref('Person', result.person),
          memberships: result.memberships.map((row) =>
            ref('FamilyMembership', row),
          ),
          families: result.families.map((row) => ref('Family', row)),
          sessions: result.sessions.map((row) => ref('ActivitySession', row)),
          attendances: result.attendances.map((row) => ref('Attendance', row)),
          createdMemberships,
        };
        await tx.completeOperation(operationId, reference);
        return result;
      },
    );
  }
}
