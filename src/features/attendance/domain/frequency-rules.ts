import { civilDateAt } from '../../projects/domain/activity-rules.js';
import { AttendanceRuleError } from './attendance-errors.js';
import type {
  AttendanceCoverage,
  CivilPeriod,
  FrequencyOpportunity,
} from './attendance.js';

export function civilBoundary(day: string, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  let low = Date.parse(day) - 36 * 3600000;
  let high = Date.parse(day) + 36 * 3600000;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (formatter.format(new Date(middle)) < day) low = middle;
    else high = middle;
  }
  return new Date(high).toISOString();
}
export function nextCivilDay(day: string) {
  return new Date(Date.parse(day) + 86400000).toISOString().slice(0, 10);
}
export function changedIntervalPeriods(
  before: { validFrom: string; validUntil: string | null } | null,
  after: { validFrom: string; validUntil: string | null } | null,
) {
  const numeric = (value: {
    validFrom: string;
    validUntil: string | null;
  }) => ({
    from: Date.parse(value.validFrom),
    to: value.validUntil === null ? Infinity : Date.parse(value.validUntil),
  });
  const subtract = (first: typeof before, second: typeof before) => {
    if (!first) return [];
    const left = numeric(first);
    if (!second) return [left];
    const right = numeric(second);
    if (left.to <= right.from || right.to <= left.from) return [left];
    return [
      { from: left.from, to: Math.min(left.to, right.from) },
      { from: Math.max(left.from, right.to), to: left.to },
    ].filter((row) => row.from < row.to);
  };
  return [...subtract(before, after), ...subtract(after, before)].map(
    (row) => ({
      from: new Date(row.from).toISOString(),
      toExclusive: Number.isFinite(row.to)
        ? new Date(row.to).toISOString()
        : null,
    }),
  );
}
export function assertSessionDate(
  activity: { nature: string; closedAt: string | null },
  project: {
    startsOn: string | null;
    endsOn: string | null;
    closedAt: string | null;
  },
  occurredAt: string,
  now: string,
  timeZone: string,
) {
  if (activity.nature !== 'PERIODIC')
    throw new AttendanceRuleError('PERIODIC_ACTIVITY_REQUIRED');
  if (Date.parse(occurredAt) > Date.parse(now))
    throw new AttendanceRuleError('FUTURE_SESSION');
  const day = civilDateAt(occurredAt, timeZone);
  if (
    (project.startsOn && day < project.startsOn) ||
    (project.endsOn && day > project.endsOn) ||
    [activity.closedAt, project.closedAt].some(
      (cut) => cut !== null && Date.parse(occurredAt) >= Date.parse(cut),
    )
  )
    throw new AttendanceRuleError('SESSION_OUTSIDE_VALIDITY');
}
export function coveredPeriods(
  from: string,
  toExclusive: string,
  declarations: readonly (Pick<
    AttendanceCoverage,
    'periodStart' | 'periodEndExclusive'
  > & { invalidatedPeriods: readonly CivilPeriod[] })[],
) {
  const segments: CivilPeriod[] = [];
  for (const declaration of declarations) {
    let parts = [
      {
        from: declaration.periodStart > from ? declaration.periodStart : from,
        toExclusive:
          declaration.periodEndExclusive < toExclusive
            ? declaration.periodEndExclusive
            : toExclusive,
      },
    ].filter((part) => part.from < part.toExclusive);
    for (const invalidation of declaration.invalidatedPeriods)
      parts = parts.flatMap((part) => {
        if (
          invalidation.toExclusive <= part.from ||
          invalidation.from >= part.toExclusive
        )
          return [part];
        return [
          { from: part.from, toExclusive: invalidation.from },
          { from: invalidation.toExclusive, toExclusive: part.toExclusive },
        ].filter((piece) => piece.from < piece.toExclusive);
      });
    segments.push(...parts);
  }
  segments.sort((a, b) => a.from.localeCompare(b.from));
  const confirmedPeriods: CivilPeriod[] = [];
  for (const segment of segments) {
    const last = confirmedPeriods.at(-1);
    if (last && segment.from <= last.toExclusive)
      last.toExclusive =
        segment.toExclusive > last.toExclusive
          ? segment.toExclusive
          : last.toExclusive;
    else confirmedPeriods.push({ ...segment });
  }
  const gaps: CivilPeriod[] = [];
  let cursor = from;
  for (const segment of confirmedPeriods) {
    if (cursor < segment.from)
      gaps.push({ from: cursor, toExclusive: segment.from });
    cursor = segment.toExclusive;
  }
  if (cursor < toExclusive) gaps.push({ from: cursor, toExclusive });
  return { confirmedPeriods, gaps, isComplete: gaps.length === 0 };
}
export function summarizeFrequency(
  rows: readonly FrequencyOpportunity[],
  coverageComplete: boolean,
  familyId?: string,
) {
  const opportunities = rows.filter(
    (row) => !familyId || row.familyId === familyId,
  );
  const unresolvedOpportunities = rows.filter((row) => !row.contextResolved);
  const presenceCount = opportunities.filter(
    (row) => row.attendance?.status === 'PRESENT',
  ).length;
  const absenceCount = opportunities.filter(
    (row) => row.attendance?.status === 'ABSENT',
  ).length;
  const unrecordedCount = opportunities.length - presenceCount - absenceCount;
  const markingsComplete = unrecordedCount === 0;
  const contextComplete = unresolvedOpportunities.length === 0;
  const isComplete = markingsComplete && contextComplete && coverageComplete;
  return {
    sessionCount: opportunities.length,
    presenceCount,
    absenceCount,
    unrecordedCount,
    attendanceRate:
      isComplete && opportunities.length
        ? (100 * presenceCount) / opportunities.length
        : null,
    markingsComplete,
    contextComplete,
    coverageComplete,
    isComplete,
    opportunities,
    unresolvedOpportunities,
  };
}
