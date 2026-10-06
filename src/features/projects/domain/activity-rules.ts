import { ProjectsRuleError, ProjectsConflictError } from './project-errors.js';
import type { Enrollment } from './projects.js';
import type { Activity, ActivityNature } from './projects.js';
import type { ActivitySession } from '../../attendance/domain/attendance.js';

export function civilDateAt(instant: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instant));
}
export function assertEnrollmentAvailability(
  enrollments: readonly Pick<
    Enrollment,
    'id' | 'personId' | 'validFrom' | 'validUntil' | 'supersededById'
  >[],
  personId: string,
  validFrom: string,
  validUntil: string | null,
  excludedId?: string,
) {
  const conflicts = enrollments.filter(
    (row) =>
      row.supersededById === null &&
      row.id !== excludedId &&
      row.personId === personId &&
      Date.parse(row.validFrom) <
        (validUntil === null ? Infinity : Date.parse(validUntil)) &&
      Date.parse(validFrom) <
        (row.validUntil === null ? Infinity : Date.parse(row.validUntil)),
  );
  if (conflicts.length)
    throw new ProjectsConflictError(
      'ENROLLMENT_OVERLAP',
      conflicts.map((row) => row.id),
    );
}
export function assertClosurePlan(
  activities: readonly Pick<Activity, 'id' | 'closedAt'>[],
  enrollments: readonly Pick<
    Enrollment,
    'id' | 'validFrom' | 'supersededById'
  >[],
  effectiveAt: string,
  now: string,
  sessions: readonly Pick<
    ActivitySession,
    'id' | 'occurredAt' | 'status'
  >[] = [],
) {
  const cut = Date.parse(effectiveAt);
  if (cut > Date.parse(now))
    throw new ProjectsRuleError('FUTURE_EFFECTIVE_DATE');
  const ids = [
    ...sessions
      .filter(
        (row) =>
          row.status === 'COMPLETED' && Date.parse(row.occurredAt) >= cut,
      )
      .map((row) => row.id),
    ...activities
      .filter((row) => row.closedAt !== null && Date.parse(row.closedAt) > cut)
      .map((row) => row.id),
    ...enrollments
      .filter(
        (row) =>
          row.supersededById === null && Date.parse(row.validFrom) >= cut,
      )
      .map((row) => row.id),
  ];
  if (ids.length) throw new ProjectsConflictError('CLOSURE_CONFLICT', ids);
}
export function assertProjectPeriod(
  startsOn: string | null,
  endsOn: string | null,
) {
  if (startsOn && endsOn && startsOn > endsOn)
    throw new ProjectsRuleError('INVALID_PROJECT_PERIOD');
}
export function assertActivityNature(
  nature: ActivityNature,
  serviceTypeId: string | null,
) {
  if (
    (nature === 'PERIODIC' && serviceTypeId !== null) ||
    (nature === 'ONE_OFF' && serviceTypeId === null)
  )
    throw new ProjectsRuleError('INVALID_ACTIVITY_TYPE');
}
export function assertEnrollmentInterval(
  activity: { nature: 'PERIODIC' | 'ONE_OFF'; closedAt: string | null },
  project: {
    startsOn: string | null;
    endsOn: string | null;
    closedAt: string | null;
  },
  validFrom: string,
  validUntil: string | null,
  now: string,
  timeZone: string,
) {
  if (activity.nature !== 'PERIODIC')
    throw new ProjectsRuleError('INVALID_ACTIVITY_TYPE');
  const start = Date.parse(validFrom);
  const end = validUntil === null ? Infinity : Date.parse(validUntil);
  if (start >= end) throw new ProjectsRuleError('INVALID_ENROLLMENT_INTERVAL');
  if (start > Date.parse(now))
    throw new ProjectsRuleError('FUTURE_EFFECTIVE_DATE');
  const day = civilDateAt(validFrom, timeZone);
  const lastDay = Number.isFinite(end)
    ? civilDateAt(new Date(end - 1).toISOString(), timeZone)
    : null;
  const closures = [activity.closedAt, project.closedAt].filter(
    (value): value is string => value !== null,
  );
  if (
    (project.startsOn && day < project.startsOn) ||
    (project.endsOn &&
      (day > project.endsOn ||
        (lastDay !== null && lastDay > project.endsOn))) ||
    closures.some((cut) => start >= Date.parse(cut) || end > Date.parse(cut))
  ) {
    throw new ProjectsRuleError(
      'ENROLLMENT_OUTSIDE_VALIDITY',
      'Enrollment falls outside activity validity',
    );
  }
}
