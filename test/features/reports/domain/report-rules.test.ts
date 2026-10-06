import { describe, expect, it } from 'vitest';
import {
  assertUnchanged,
  orderHistory,
  paginate,
  reachRecords,
  resolveScope,
  summarizeActivityFrequency,
  summarizeEligibility,
  summarizeQuality,
  summarizeReach,
} from '../../../../src/features/reports/domain/report-rules.js';
import type {
  HistoryEvent,
  ReachPresence,
  ReachSession,
} from '../../../../src/features/reports/domain/reports.js';

const catalog = {
  institutes: ['institute-a', 'institute-b'],
  projects: [
    { id: 'project-a', instituteId: 'institute-a' },
    { id: 'project-b', instituteId: 'institute-b' },
  ],
  activities: [
    { id: 'activity-1', projectId: 'project-a', name: 'One' },
    { id: 'activity-2', projectId: 'project-a', name: 'Two' },
    { id: 'activity-3', projectId: 'project-b', name: 'Three' },
  ],
};
const session = (
  id: string,
  activityId: string,
  day: string,
): ReachSession => ({
  id,
  activityId,
  occurredAt: `2026-01-${day}T13:00:00.000Z`,
  revision: 1,
});
const presence = (
  id: string,
  from: ReachSession,
  person: string,
  family: string,
): ReachPresence => ({
  id,
  sessionId: from.id,
  activityId: from.activityId,
  occurredAt: from.occurredAt,
  personId: person,
  personName: `Synthetic ${person}`,
  familyId: family,
  familyCode: family.replace('family-', ''),
  revision: 1,
});

describe('Report activity scope', () => {
  it('narrows the hierarchy from institute to project to activity', () => {
    const ids = (filters: object) =>
      resolveScope(catalog, filters).map((row) => row.id);
    expect(ids({})).toEqual(['activity-1', 'activity-2', 'activity-3']);
    expect(ids({ instituteId: 'institute-a' })).toEqual([
      'activity-1',
      'activity-2',
    ]);
    expect(ids({ projectId: 'project-b' })).toEqual(['activity-3']);
    expect(
      ids({ instituteId: 'institute-a', activityId: 'activity-2' }),
    ).toEqual(['activity-2']);
  });
  it.each([
    [{ projectId: 'project-a', activityId: 'activity-3' }],
    [{ instituteId: 'institute-b', projectId: 'project-a' }],
    [{ instituteId: 'institute-b', activityId: 'activity-1' }],
  ])(
    'rejects conflicting filters instead of returning an empty total: %j',
    (filters) => {
      expect(() => resolveScope(catalog, filters)).toThrow(
        expect.objectContaining({ rule: 'REPORT_FILTER_CONFLICT' }),
      );
    },
  );
  it('rejects unknown references', () => {
    expect(() => resolveScope(catalog, { activityId: 'missing' })).toThrow(
      expect.objectContaining({ rule: 'REPORT_FILTER_UNKNOWN' }),
    );
  });
});

describe('Reach report', () => {
  const first = session('s1', 'activity-1', '05');
  const second = session('s2', 'activity-2', '06');
  const empty = session('s3', 'activity-1', '07');
  const sessions = [first, second, empty];
  const presences = [
    presence('p1', first, 'ana', 'family-1'),
    presence('p2', second, 'ana', 'family-1'),
    presence('p3', second, 'bia', 'family-1'),
    presence('p4', first, 'caio', 'family-2'),
  ];
  it('counts unique people and families separately from sessions and presences', () => {
    expect(summarizeReach(sessions, presences)).toEqual({
      people: 3,
      families: 2,
      sessions: 3,
      presences: 4,
      groups: [
        {
          activityId: 'activity-1',
          people: 2,
          families: 2,
          sessions: 2,
          presences: 2,
        },
        {
          activityId: 'activity-2',
          people: 2,
          families: 1,
          sessions: 1,
          presences: 2,
        },
      ],
    });
  });
  it('lists exactly the units behind each total', () => {
    const totals = summarizeReach(sessions, presences);
    expect(reachRecords('PERSON', sessions, presences)).toEqual([
      { personId: 'ana', personName: 'Synthetic ana', presences: 2 },
      { personId: 'bia', personName: 'Synthetic bia', presences: 1 },
      { personId: 'caio', personName: 'Synthetic caio', presences: 1 },
    ]);
    expect(reachRecords('FAMILY', sessions, presences)).toEqual([
      { familyId: 'family-1', familyCode: '1', people: 2, presences: 3 },
      { familyId: 'family-2', familyCode: '2', people: 1, presences: 1 },
    ]);
    expect(reachRecords('SESSION', sessions, presences)).toHaveLength(
      totals.sessions,
    );
    expect(
      reachRecords('SESSION', sessions, presences).map((row) =>
        'presences' in row ? row.presences : null,
      ),
    ).toEqual([2, 2, 0]);
    expect(reachRecords('PRESENCE', sessions, presences)).toHaveLength(
      totals.presences,
    );
  });
});

describe('Frequency report', () => {
  const summary = (
    presenceCount: number,
    absenceCount: number,
    unrecordedCount: number,
    contextComplete = true,
  ) => ({
    sessionCount: presenceCount + absenceCount + unrecordedCount,
    presenceCount,
    absenceCount,
    unrecordedCount,
    contextComplete,
  });
  it('derives the rate from opportunities, never from an average of individual percentages', () => {
    expect(
      summarizeActivityFrequency([summary(1, 0, 0), summary(1, 3, 0)], true),
    ).toMatchObject({
      participants: 2,
      sessionCount: 5,
      presenceCount: 2,
      absenceCount: 3,
      unrecordedCount: 0,
      attendanceRate: 40,
      isComplete: true,
    });
  });
  it.each([
    ['unrecorded markings', [summary(1, 0, 1)], true],
    ['missing coverage', [summary(2, 0, 0)], false],
    ['an unresolved context', [summary(2, 0, 0, false)], true],
    ['no opportunities', [], true],
  ] as const)(
    'keeps known counts and an unknown rate with %s',
    (_name, rows, coverageComplete) => {
      const totals = summarizeActivityFrequency([...rows], coverageComplete);
      expect(totals.attendanceRate).toBeNull();
      expect(totals.presenceCount).toBe(
        rows.reduce((sum, row) => sum + row.presenceCount, 0),
      );
    },
  );
});

describe('Eligibility and data quality totals', () => {
  it('keeps pending families apart from ineligible ones', () => {
    expect(
      summarizeEligibility(['PENDING', 'ELIGIBLE', 'PENDING', 'INELIGIBLE']),
    ).toEqual({ total: 4, ELIGIBLE: 1, INELIGIBLE: 1, PENDING: 2 });
  });
  it('separates open issues, kinds and resolutions', () => {
    const issue = (kind: string, resolution: string | null) => ({
      kind,
      resolution,
      resolvedAt: resolution ? '2026-01-02T00:00:00.000Z' : null,
    });
    expect(
      summarizeQuality([
        issue('POSSIBLE_DUPLICATE', null),
        issue('POSSIBLE_DUPLICATE', 'MERGED'),
        issue('POSSIBLE_DUPLICATE', 'DISTINCT'),
        issue('MISSING_DATA', null),
      ]),
    ).toEqual({
      total: 4,
      open: 2,
      resolved: 2,
      byKind: { POSSIBLE_DUPLICATE: 3, MISSING_DATA: 1 },
      byResolution: { DISTINCT: 1, MERGED: 1 },
    });
  });
});

describe('Report detail consistency', () => {
  it('refuses a detail whose sources no longer match the consulted total', () => {
    expect(() => assertUnchanged('a', 'a')).not.toThrow();
    expect(() => assertUnchanged('a', 'b')).toThrow('Report sources changed');
  });
  it('paginates after the whole universe is known', () => {
    expect(paginate([1, 2, 3, 4, 5], { page: 2, pageSize: 2 })).toEqual({
      data: [3, 4],
      pagination: { page: 2, pageSize: 2, total: 5 },
    });
  });
});

describe('History ordering', () => {
  const event = (
    sourceId: string,
    occurredAt: string,
    recordedAt: string | null = null,
  ) => ({ sourceId, occurredAt, recordedAt }) as HistoryEvent;
  it('orders by fact date, then recording date, then source id in the requested direction', () => {
    const events = [
      event('c', '2026-01-02T00:00:00.000Z'),
      event('b', '2026-01-01T00:00:00.000Z', '2026-01-05T00:00:00.000Z'),
      event('a', '2026-01-01T00:00:00.000Z', '2026-01-05T00:00:00.000Z'),
      event('d', '2026-01-01T00:00:00.000Z', '2026-01-03T00:00:00.000Z'),
    ];
    expect(orderHistory(events, 'asc').map((row) => row.sourceId)).toEqual([
      'd',
      'a',
      'b',
      'c',
    ]);
    expect(orderHistory(events, 'desc').map((row) => row.sourceId)).toEqual([
      'c',
      'b',
      'a',
      'd',
    ]);
  });
});
