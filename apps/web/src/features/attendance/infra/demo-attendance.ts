import {
  confirmSessionSchema,
  attendanceStatusSchema,
} from '@erp/contracts/attendance';
import type {
  ActivitySession,
  AttendanceContext,
} from '@erp/contracts/attendance';
import {
  ApplicationError,
  idSchema,
  instantSchema,
  reasonSchema,
} from '@erp/contracts/common';
import type { AttendanceGateway } from '../application/attendance-gateway';
import type { DemoRuntime } from '../../../demo/runtime';
import { requireFound, requireRevision } from '../../../demo/runtime';
import type { DemoState } from '../../../demo/state';
import { membershipAt } from '../../registration/domain/memberships';
import { validateActivityFact } from '../../projects/domain/activity-rules';
import { validateCorrection } from '../domain/attendance-rules';
import { isWithin } from '../../../shared/time';

function context(
  state: Readonly<DemoState>,
  activityId: string,
  occurredAt: string,
): AttendanceContext {
  const activity = requireFound(
    state.activities.find((a) => a.id === activityId),
  );
  const enrollments = state.enrollments.filter(
    (e) =>
      e.activityId === activityId &&
      isWithin(occurredAt, e.validFrom, e.validUntil),
  );
  const participants = state.people.map((p) => {
    const membership = membershipAt(state.memberships, p.id, occurredAt);
    const family = state.families.find((f) => f.id === membership?.familyId);
    return {
      id: p.id,
      name: p.name,
      familyCode: family?.code ?? null,
      personRevision: p.revision,
      membership,
      familyRevision: family?.revision,
    };
  });
  return {
    fingerprint: JSON.stringify([
      occurredAt,
      activity.revision,
      enrollments,
      participants,
    ]),
    activityRevision: activity.revision,
    participants: participants
      .filter((p) => enrollments.some((e) => e.personId === p.id))
      .map(({ id, name, familyCode }) => ({ id, name, familyCode })),
    operators: state.accounts
      .filter((a) => a.active)
      .map((a) => ({ id: a.id, name: a.displayName })),
  };
}
export function createDemoAttendance(runtime: DemoRuntime): AttendanceGateway {
  const completedOperations = new Map<
    string,
    { actorId: string; fingerprint: string; result: ActivitySession }
  >();
  return {
    async context(activityId, occurredAt) {
      instantSchema.parse(occurredAt);
      return runtime.read('attendance.read', (s) =>
        context(s, activityId, occurredAt),
      );
    },
    async list(activityId) {
      return runtime.read('attendance.read', (s) =>
        s.sessions
          .filter((session) => session.activityId === activityId)
          .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
      );
    },
    async get(id) {
      return runtime.read('attendance.read', (s) => {
        const session = requireFound(s.sessions.find((item) => item.id === id));
        const roster = context(
          s,
          session.activityId,
          session.occurredAt,
        ).participants;
        const ids = new Set([
          ...roster.map((p) => p.id),
          ...session.entries.map((e) => e.personId),
        ]);
        return {
          session,
          activityName: requireFound(
            s.activities.find((a) => a.id === session.activityId),
          ).name,
          participants: [...ids].map((personId) => ({
            id: personId,
            name: requireFound(s.people.find((p) => p.id === personId)).name,
            status:
              session.entries.find((e) => e.personId === personId)?.status ??
              null,
          })),
        };
      });
    },
    async confirm(raw, key) {
      const actor = runtime.authorize('attendance.write');
      const input = confirmSessionSchema.parse(raw);
      idSchema.parse(key);
      const fingerprint = JSON.stringify({
        ...input,
        entries: [...input.entries].sort((a, b) =>
          a.personId.localeCompare(b.personId),
        ),
      });
      const completed = completedOperations.get(key);
      if (completed) {
        if (
          completed.actorId !== actor.id ||
          completed.fingerprint !== fingerprint
        )
          throw new ApplicationError(
            'DOMAIN_CONFLICT',
            'The operation key was used with different content',
          );
        return structuredClone(completed.result);
      }
      const result = runtime.execute('attendance.write', (s) => {
        const activity = requireFound(
          s.activities.find((a) => a.id === input.activityId),
        );
        const project = requireFound(
          s.projects.find((p) => p.id === activity.projectId),
        );
        requireRevision(activity.revision, input.expectedRevision);
        validateActivityFact(
          activity,
          project,
          input.occurredAt,
          runtime.now(),
        );
        requireFound(
          s.accounts.find((a) => a.id === input.responsibleId && a.active),
        );
        if (
          context(s, activity.id, input.occurredAt).fingerprint !==
          input.expectedContext
        )
          throw new ApplicationError(
            'REVISION_CONFLICT',
            'The attendance context has changed',
          );
        if (
          new Set(input.entries.map((e) => e.personId)).size !==
          input.entries.length
        )
          throw new ApplicationError(
            'DOMAIN_CONFLICT',
            'Duplicate attendance entries',
          );
        const entries = input.entries.map((entry) => {
          const membership = requireFound(
            membershipAt(s.memberships, entry.personId, input.occurredAt),
          );
          requireFound(s.people.find((p) => p.id === entry.personId));
          return {
            ...entry,
            familyId: membership.familyId,
            membershipId: membership.id,
          };
        });
        const session: ActivitySession = {
          id: runtime.id(),
          activityId: activity.id,
          responsibleId: input.responsibleId,
          occurredAt: input.occurredAt,
          recordedAt: runtime.now(),
          recordedBy: actor.id,
          status: 'COMPLETED',
          entries,
          revision: 1,
        };
        s.sessions.push(session);
        return {
          result: session,
          change: {
            entityId: session.id,
            entityLabel: activity.name,
            action: 'CREATE',
            occurredAt: session.occurredAt,
            reason: null,
            readCapability: 'attendance.read',
            before: null,
            after: { ...session },
          },
        };
      });
      completedOperations.set(key, {
        actorId: actor.id,
        fingerprint,
        result: structuredClone(result),
      });
      return result;
    },
    async correct(id, revision, entries, rawReason) {
      const reason = reasonSchema.parse(rawReason);
      entries.forEach((e) => {
        idSchema.parse(e.personId);
        attendanceStatusSchema.parse(e.status);
      });
      runtime.execute('attendance.write', (s) => {
        const session = requireFound(s.sessions.find((item) => item.id === id));
        requireRevision(session.revision, revision);
        validateCorrection(
          session,
          entries.map((e) => e.personId),
        );
        const before = structuredClone(session);
        for (const update of entries) {
          const entry = session.entries.find(
            (e) => e.personId === update.personId,
          );
          if (!entry)
            throw new ApplicationError(
              'FEATURE_NOT_ENABLED',
              'First markings require the attendance context workflow',
            );
          entry.status = update.status;
        }
        session.revision += 1;
        return {
          result: undefined,
          change: {
            entityId: id,
            entityLabel: requireFound(
              s.activities.find((a) => a.id === session.activityId),
            ).name,
            action: 'CORRECT',
            occurredAt: session.occurredAt,
            reason,
            readCapability: 'attendance.read',
            before: { ...before },
            after: { ...session },
          },
        };
      });
    },
    async cancel(id, revision, rawReason) {
      const reason = reasonSchema.parse(rawReason);
      runtime.execute('attendance.write', (s) => {
        const session = requireFound(s.sessions.find((item) => item.id === id));
        requireRevision(session.revision, revision);
        validateCorrection(session, []);
        const before = structuredClone(session);
        session.status = 'CANCELED';
        session.revision += 1;
        return {
          result: undefined,
          change: {
            entityId: id,
            entityLabel: requireFound(
              s.activities.find((a) => a.id === session.activityId),
            ).name,
            action: 'CANCEL',
            occurredAt: session.occurredAt,
            reason,
            readCapability: 'attendance.read',
            before: { ...before },
            after: { ...session },
          },
        };
      });
    },
  };
}
