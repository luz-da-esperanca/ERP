import type { EligibilityStatus } from '../../eligibility/domain/eligibility.js';
import { ReportChangedError, ReportRuleError } from './report-errors.js';
import type {
  EligibilityTotals,
  FrequencyCounts,
  HistoryEvent,
  HistoryOrder,
  Page,
  ReachCounts,
  ReachPresence,
  ReachRecord,
  ReachSession,
  ReachUnit,
  ReportCatalog,
  ScopeFilters,
} from './reports.js';

/** Activities selected by hierarchical filters; a contradiction is an error, not an empty total. */
export function resolveScope(catalog: ReportCatalog, filters: ScopeFilters) {
  const activity = catalog.activities.find(
    (row) => row.id === filters.activityId,
  );
  const project = catalog.projects.find(
    (row) => row.id === (filters.projectId ?? activity?.projectId),
  );
  if (
    (filters.activityId && !activity) ||
    (filters.projectId && !project) ||
    (filters.instituteId && !catalog.institutes.includes(filters.instituteId))
  )
    throw new ReportRuleError('REPORT_FILTER_UNKNOWN');
  if (
    (activity &&
      filters.projectId &&
      activity.projectId !== filters.projectId) ||
    (project &&
      filters.instituteId &&
      project.instituteId !== filters.instituteId)
  )
    throw new ReportRuleError('REPORT_FILTER_CONFLICT');
  const projects = new Set(
    catalog.projects
      .filter(
        (row) =>
          (!filters.instituteId || row.instituteId === filters.instituteId) &&
          (!filters.projectId || row.id === filters.projectId),
      )
      .map((row) => row.id),
  );
  return catalog.activities.filter(
    (row) =>
      projects.has(row.projectId) &&
      (!filters.activityId || row.id === filters.activityId),
  );
}

const distinct = <T>(values: readonly T[]) => new Set(values).size;
function reachCounts(
  sessions: readonly ReachSession[],
  presences: readonly ReachPresence[],
): ReachCounts {
  return {
    people: distinct(presences.map((row) => row.personId)),
    families: distinct(presences.map((row) => row.familyId)),
    sessions: sessions.length,
    presences: presences.length,
  };
}
export function summarizeReach(
  sessions: readonly ReachSession[],
  presences: readonly ReachPresence[],
) {
  return {
    ...reachCounts(sessions, presences),
    groups: [...new Set(sessions.map((row) => row.activityId))]
      .sort()
      .map((activityId) => ({
        activityId,
        ...reachCounts(
          sessions.filter((row) => row.activityId === activityId),
          presences.filter((row) => row.activityId === activityId),
        ),
      })),
  };
}
const byFact = (
  a: { occurredAt: string; id: string },
  b: { occurredAt: string; id: string },
) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id);

/** The units counted by a reach total, from the same sessions and presences. */
export function reachRecords(
  unit: ReachUnit,
  sessions: readonly ReachSession[],
  presences: readonly ReachPresence[],
): ReachRecord[] {
  if (unit === 'PRESENCE') return [...presences].sort(byFact);
  if (unit === 'SESSION')
    return [...sessions].sort(byFact).map((row) => ({
      ...row,
      presences: presences.filter((item) => item.sessionId === row.id).length,
    }));
  if (unit === 'PERSON')
    return [...new Map(presences.map((row) => [row.personId, row])).values()]
      .map((row) => ({
        personId: row.personId,
        personName: row.personName,
        presences: presences.filter((item) => item.personId === row.personId)
          .length,
      }))
      .sort(
        (a, b) =>
          a.personName.localeCompare(b.personName) ||
          a.personId.localeCompare(b.personId),
      );
  return [...new Map(presences.map((row) => [row.familyId, row])).values()]
    .map((row) => {
      const own = presences.filter((item) => item.familyId === row.familyId);
      return {
        familyId: row.familyId,
        familyCode: row.familyCode,
        people: distinct(own.map((item) => item.personId)),
        presences: own.length,
      };
    })
    .sort(
      (a, b) =>
        Number(a.familyCode) - Number(b.familyCode) ||
        a.familyId.localeCompare(b.familyId),
    );
}

/**
 * Activity totals over the participants' opportunities. Unknown markings stay
 * unknown: the rate exists only when every dimension of completeness holds.
 */
export function summarizeActivityFrequency(
  participants: readonly FrequencyCounts[],
  coverageComplete: boolean,
) {
  const sum = (key: Exclude<keyof FrequencyCounts, 'contextComplete'>) =>
    participants.reduce((total, row) => total + row[key], 0);
  const sessionCount = sum('sessionCount');
  const presenceCount = sum('presenceCount');
  const unrecordedCount = sum('unrecordedCount');
  const markingsComplete = unrecordedCount === 0;
  const contextComplete = participants.every((row) => row.contextComplete);
  const isComplete = markingsComplete && contextComplete && coverageComplete;
  return {
    participants: participants.length,
    sessionCount,
    presenceCount,
    absenceCount: sum('absenceCount'),
    unrecordedCount,
    attendanceRate:
      isComplete && sessionCount ? (100 * presenceCount) / sessionCount : null,
    markingsComplete,
    contextComplete,
    coverageComplete,
    isComplete,
  };
}

export function summarizeEligibility(
  statuses: readonly EligibilityStatus[],
): EligibilityTotals {
  const count = (status: EligibilityStatus) =>
    statuses.filter((row) => row === status).length;
  return {
    total: statuses.length,
    ELIGIBLE: count('ELIGIBLE'),
    INELIGIBLE: count('INELIGIBLE'),
    PENDING: count('PENDING'),
  };
}

export function summarizeQuality(
  issues: readonly {
    kind: string;
    resolution: string | null;
    resolvedAt: string | null;
  }[],
) {
  const count = (matches: (row: (typeof issues)[number]) => boolean) =>
    issues.filter(matches).length;
  return {
    total: issues.length,
    open: count((row) => row.resolvedAt === null),
    resolved: count((row) => row.resolvedAt !== null),
    byKind: {
      POSSIBLE_DUPLICATE: count((row) => row.kind === 'POSSIBLE_DUPLICATE'),
      MISSING_DATA: count((row) => row.kind === 'MISSING_DATA'),
    },
    byResolution: {
      DISTINCT: count((row) => row.resolution === 'DISTINCT'),
      MERGED: count((row) => row.resolution === 'MERGED'),
    },
  };
}

/** A detail is proof of a total only while the sources are the ones consulted. */
export function assertUnchanged(expected: string, current: string) {
  if (expected !== current) throw new ReportChangedError();
}

export function paginate<T>(rows: readonly T[], { page, pageSize }: Page) {
  return {
    data: rows.slice((page - 1) * pageSize, page * pageSize),
    pagination: { page, pageSize, total: rows.length },
  };
}

export function orderHistory(
  events: readonly HistoryEvent[],
  order: HistoryOrder,
) {
  const sorted = [...events].sort(
    (a, b) =>
      a.occurredAt.localeCompare(b.occurredAt) ||
      (a.recordedAt ?? '').localeCompare(b.recordedAt ?? '') ||
      a.sourceId.localeCompare(b.sourceId) ||
      a.type.localeCompare(b.type),
  );
  return order === 'asc' ? sorted : sorted.reverse();
}
