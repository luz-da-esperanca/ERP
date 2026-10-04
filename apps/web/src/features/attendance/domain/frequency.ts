import type {
  ActivitySession,
  AttendanceStatus,
} from '@erp/contracts/attendance';
import type { Enrollment } from '@erp/contracts/projects';
import type { FamilyMembership } from '@erp/contracts/registration';
import { isWithin } from '../../../shared/time';
import { membershipAt } from '../../registration/domain/memberships';

export interface FrequencyData {
  sessions: readonly ActivitySession[];
  enrollments: readonly Enrollment[];
  memberships: readonly FamilyMembership[];
}
export interface Opportunity {
  sessionId: string;
  personId: string;
  familyId: string | null;
  status: AttendanceStatus | null;
}
export function frequencyOpportunities(
  data: FrequencyData,
  from: string,
  toExclusive: string,
  activityId?: string,
): Opportunity[] {
  return data.sessions
    .filter(
      (s) =>
        s.status === 'COMPLETED' &&
        isWithin(s.occurredAt, from, toExclusive) &&
        (!activityId || s.activityId === activityId),
    )
    .flatMap((session) => {
      const people = new Set([
        ...data.enrollments
          .filter(
            (e) =>
              e.activityId === session.activityId &&
              isWithin(session.occurredAt, e.validFrom, e.validUntil),
          )
          .map((e) => e.personId),
        ...session.entries.map((e) => e.personId),
      ]);
      return [...people].map((personId) => {
        const entry = session.entries.find((e) => e.personId === personId);
        return {
          sessionId: session.id,
          personId,
          familyId:
            entry?.familyId ??
            membershipAt(data.memberships, personId, session.occurredAt)
              ?.familyId ??
            null,
          status: entry?.status ?? null,
        };
      });
    });
}
export function summarizeFrequency(
  opportunities: readonly Opportunity[],
  coverageComplete = false,
) {
  const presenceCount = opportunities.filter(
    (o) => o.status === 'PRESENT',
  ).length;
  const absenceCount = opportunities.filter(
    (o) => o.status === 'ABSENT',
  ).length;
  const unrecordedCount = opportunities.filter((o) => o.status === null).length;
  const contextComplete = opportunities.every((o) => o.familyId !== null);
  const complete = coverageComplete && contextComplete && unrecordedCount === 0;
  return {
    sessionCount: opportunities.length,
    presenceCount,
    absenceCount,
    unrecordedCount,
    coverageComplete,
    contextComplete,
    attendanceRate:
      complete && opportunities.length > 0
        ? presenceCount / opportunities.length
        : null,
  };
}
