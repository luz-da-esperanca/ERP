import { describe, expect, it, vi } from 'vitest';
import { ReportsService } from '../../../../src/features/reports/application/reports-service.js';
import type { ReportsReaderPorts } from '../../../../src/features/reports/application/reports-ports.js';
import type {
  EligibilityRow,
  HistoryEvent,
  HistoryEventType,
  ReachPresence,
  ReachSession,
} from '../../../../src/features/reports/domain/reports.js';
import type { AttendanceSources } from '../../../../src/features/attendance/domain/attendance.js';
import type { Principal } from '../../../../src/features/access/application/ports.js';
import type { Role } from '@erp/contracts/access';
import { createAccessServiceFixture } from '../../../support/access-service-fixture.js';

const period = { from: '2026-01-01', toExclusive: '2026-02-01' };
const page = { page: 1, pageSize: 20 };
const at = (day: string) => `2026-01-${day}T13:00:00.000Z`;

function fixture(roles: Role[] = ['SOCIAL_ASSISTANCE']) {
  const { principal: original } = createAccessServiceFixture();
  const actor: Principal = {
    ...original,
    user: { ...original.user, roleCodes: roles },
  };
  const sessions: ReachSession[] = [
    { id: 's1', activityId: 'activity', occurredAt: at('05'), revision: 1 },
  ];
  const presences: ReachPresence[] = [
    {
      id: 'p1',
      sessionId: 's1',
      activityId: 'activity',
      occurredAt: at('05'),
      personId: 'ana',
      personName: 'Synthetic Ana',
      familyId: 'family-1',
      familyCode: '1',
      revision: 1,
    },
  ];
  const sources = {
    activity: { id: 'activity', nature: 'PERIODIC' },
    sessions: [
      { id: 's1', occurredAt: at('05'), status: 'COMPLETED', revision: 1 },
      { id: 's2', occurredAt: at('12'), status: 'COMPLETED', revision: 1 },
      { id: 's3', occurredAt: at('19'), status: 'CANCELED', revision: 2 },
    ],
    enrollments: [
      {
        id: 'e1',
        personId: 'ana',
        validFrom: '2026-01-01T03:00:00.000Z',
        validUntil: null,
        revision: 1,
      },
    ],
    attendances: [
      {
        id: 'p1',
        sessionId: 's1',
        personId: 'ana',
        familyId: 'family-1',
        membershipId: 'm1',
        membershipRevision: 1,
        status: 'PRESENT',
        revision: 1,
      },
    ],
    people: [
      {
        id: 'ana',
        name: 'Synthetic Ana',
        revision: 1,
        memberships: [
          {
            id: 'm1',
            familyId: 'family-1',
            validFrom: '2026-01-01T03:00:00.000Z',
            validUntil: null,
            revision: 1,
          },
        ],
      },
    ],
    declarations: [],
  } as unknown as AttendanceSources;
  const eligibility: EligibilityRow[] = (
    ['ELIGIBLE', 'PENDING', 'PENDING', 'INELIGIBLE'] as const
  ).map((status, index) => ({
    family: { id: `family-${index + 1}`, code: String(index + 1) },
    preview: {
      familyId: `family-${index + 1}`,
      referenceDate: '2026-01-31',
      evaluatedAt: '2026-10-05T12:00:00.000Z',
      policyId: 'policy',
      status,
      pendingReasons: status === 'PENDING' ? ['COVERAGE_INCOMPLETE'] : [],
      explanation: {} as EligibilityRow['preview']['explanation'],
      evidences: [],
      sourceFingerprint: `fingerprint-${index}`,
    },
  }));
  const event = (type: HistoryEventType, day: string): HistoryEvent => ({
    type,
    occurredAt: at(day),
    referenceDate: null,
    recordedAt: null,
    sourceType: type,
    sourceId: `${type}-${day}`,
    familyId: 'family-1',
    personId: 'ana',
    activityId: null,
    valid: true,
    invalidReason: null,
    details: {},
  });
  const ports = {
    catalog: vi.fn<ReportsReaderPorts['catalog']>().mockResolvedValue({
      institutes: ['institute'],
      projects: [{ id: 'project', instituteId: 'institute' }],
      activities: [{ id: 'activity', projectId: 'project', name: 'Synthetic' }],
    }),
    reachFacts: vi
      .fn<ReportsReaderPorts['reachFacts']>()
      .mockImplementation(async () => ({ sessions, presences })),
    attendanceSources: vi
      .fn<ReportsReaderPorts['attendanceSources']>()
      .mockImplementation(async (id) => (id === 'activity' ? sources : null)),
    qualityIssues: vi
      .fn<ReportsReaderPorts['qualityIssues']>()
      .mockResolvedValue([]),
    canonicalFamily: vi
      .fn<ReportsReaderPorts['canonicalFamily']>()
      .mockResolvedValue({ id: 'family-1', code: '1' }),
    canonicalPerson: vi
      .fn<ReportsReaderPorts['canonicalPerson']>()
      .mockResolvedValue({ id: 'ana', name: 'Synthetic Ana' }),
    familyEvents: vi
      .fn<ReportsReaderPorts['familyEvents']>()
      .mockImplementation(async (_id, types) =>
        types.map((type, index) => event(type, String(10 + index))),
      ),
    personEvents: vi
      .fn<ReportsReaderPorts['personEvents']>()
      .mockImplementation(async (_id, types) =>
        types.map((type, index) => event(type, String(10 + index))),
      ),
  };
  const evaluateAll = vi.fn(async (_date: string, familyId?: string) =>
    eligibility.filter((row) => !familyId || row.family.id === familyId),
  );
  const service = new ReportsService(
    { read: (work) => work(ports) },
    { evaluateAll },
    {
      currentKeyId: 'v1',
      calculate: (content) => JSON.stringify(content),
      matches: (first, second) => first === second,
    },
    () => '2026-10-05T12:00:00.000Z',
    'America/Fortaleza',
  );
  return { service, actor, ports, sessions, presences, sources, evaluateAll };
}

describe('Report authorization', () => {
  it('adds the domain permission to the report permission for every query', async () => {
    const calls = (service: ReportsService, actor: Principal) => ({
      reach: () => service.reach(actor, period),
      frequency: () =>
        service.frequency(actor, { ...period, activityId: 'activity' }),
      eligibility: () =>
        service.eligibility(actor, { referenceDate: '2026-01-31', ...page }),
      dataQuality: () =>
        service.dataQuality(actor, {
          ...period,
          dateBasis: 'IDENTIFICATION',
          ...page,
        }),
      familyHistory: () =>
        service.familyHistory(actor, 'family-1', { ...page, order: 'desc' }),
      personHistory: () =>
        service.personHistory(actor, 'ana', { ...page, order: 'desc' }),
    });
    const allowed = async (roles: Role[]) => {
      const { service, actor } = fixture(roles);
      const outcome: Record<string, boolean> = {};
      for (const [name, call] of Object.entries(calls(service, actor)))
        outcome[name] = await call().then(
          () => true,
          (error: Error) => {
            expect(error.message).toBe('Operation not permitted');
            return false;
          },
        );
      return outcome;
    };
    const all = {
      reach: true,
      frequency: true,
      eligibility: true,
      dataQuality: true,
      familyHistory: true,
      personHistory: true,
    };
    expect(await allowed(['COORDINATION'])).toEqual(all);
    expect(await allowed(['SOCIAL_ASSISTANCE'])).toEqual(all);
    expect(await allowed(['ACTIVITY_MANAGER'])).toEqual({
      ...all,
      eligibility: false,
      dataQuality: false,
      familyHistory: false,
    });
    expect(await allowed(['ADMINISTRATOR'])).toEqual(
      Object.fromEntries(Object.keys(all).map((key) => [key, false])),
    );
  });
  it('never loads social or eligibility events for a profile limited to attendance', async () => {
    const { service, actor, ports } = fixture(['ACTIVITY_MANAGER']);
    const history = await service.personHistory(actor, 'ana', {
      ...page,
      order: 'asc',
      eventTypes: ['SOCIAL_FORM', 'ATTENDANCE', 'MEMBERSHIP_STARTED'],
    });
    expect(ports.personEvents).toHaveBeenCalledWith('ana', ['ATTENDANCE']);
    expect(history.data.map((row) => row.type)).toEqual(['ATTENDANCE']);
    expect(history.report.eventTypes).toEqual(['ATTENDANCE']);
    const everything = await service.personHistory(actor, 'ana', {
      ...page,
      order: 'asc',
    });
    expect(everything.report.eventTypes).toEqual([
      'ATTENDANCE',
      'ENROLLMENT_ENDED',
      'ENROLLMENT_STARTED',
    ]);
  });
});

describe('Reach report', () => {
  it('states period, units and method and proves each total with its own records', async () => {
    const { service, actor, ports } = fixture(['ACTIVITY_MANAGER']);
    const report = await service.reach(actor, period);
    expect(report).toMatchObject({
      generatedAt: '2026-10-05T12:00:00.000Z',
      filters: {
        ...period,
        instituteId: null,
        projectId: null,
        activityId: null,
      },
      method: 'PRESENT_MARKINGS_IN_COMPLETED_SESSIONS',
      totals: { people: 1, families: 1, sessions: 1, presences: 1 },
    });
    expect(ports.reachFacts).toHaveBeenCalledWith(
      ['activity'],
      '2026-01-01T03:00:00.000Z',
      '2026-02-01T03:00:00.000Z',
    );
    const records = await service.reachRecords(actor, {
      ...period,
      ...page,
      unit: 'PERSON',
      expectedQueryFingerprint: report.queryFingerprint,
    });
    expect(records).toMatchObject({
      report: { unit: 'PERSON', queryFingerprint: report.queryFingerprint },
      data: [{ personId: 'ana', presences: 1 }],
      pagination: { total: report.totals.people },
    });
  });
  it('answers REPORT_CHANGED when a source changed between the total and its detail', async () => {
    const { service, actor, presences } = fixture();
    const report = await service.reach(actor, period);
    presences[0] = { ...presences[0]!, revision: 2 };
    await expect(
      service.reachRecords(actor, {
        ...period,
        ...page,
        unit: 'PRESENCE',
        expectedQueryFingerprint: report.queryFingerprint,
      }),
    ).rejects.toMatchObject({ message: 'Report sources changed' });
    await expect(
      service.reachRecords(actor, {
        ...period,
        activityId: 'activity',
        ...page,
        unit: 'PRESENCE',
        expectedQueryFingerprint: report.queryFingerprint,
      }),
    ).rejects.toMatchObject({ message: 'Report sources changed' });
  });
});

describe('Frequency report', () => {
  it('shows known counts with an unknown rate while coverage is missing and identifies canceled sessions apart', async () => {
    const { service, actor } = fixture(['ACTIVITY_MANAGER']);
    const report = await service.frequency(actor, {
      ...period,
      activityId: 'activity',
    });
    expect(report).toMatchObject({
      denominator: 'ENROLLMENT_OR_RECORDED',
      totals: {
        participants: 1,
        sessionCount: 2,
        presenceCount: 1,
        unrecordedCount: 1,
        attendanceRate: null,
        coverageComplete: false,
        completedSessions: 2,
        canceledSessions: 1,
      },
    });
    const opportunities = await service.frequencyRecords(actor, {
      ...period,
      activityId: 'activity',
      ...page,
      unit: 'OPPORTUNITY',
      expectedQueryFingerprint: report.queryFingerprint,
    });
    expect(
      opportunities.data.map((row) => ('status' in row ? row.status : 'x')),
    ).toEqual(['PRESENT', null]);
    expect(opportunities.pagination.total).toBe(report.totals.sessionCount);
    const sessions = await service.frequencyRecords(actor, {
      ...period,
      activityId: 'activity',
      ...page,
      unit: 'SESSION',
      expectedQueryFingerprint: report.queryFingerprint,
    });
    expect(sessions.pagination.total).toBe(3);
  });
  it('filters by the historical family of each opportunity', async () => {
    const { service, actor } = fixture();
    const other = await service.frequency(actor, {
      ...period,
      activityId: 'activity',
      familyId: 'family-2',
    });
    expect(other.totals).toMatchObject({ participants: 0, sessionCount: 0 });
  });
  it('rejects an unknown activity instead of reporting an empty total', async () => {
    const { service, actor } = fixture();
    await expect(
      service.frequency(actor, { ...period, activityId: 'missing' }),
    ).rejects.toMatchObject({ rule: 'REPORT_FILTER_UNKNOWN' });
  });
});

describe('Eligibility report', () => {
  it('classifies every family before filtering and paginating', async () => {
    const { service, actor } = fixture();
    const report = await service.eligibility(actor, {
      referenceDate: '2026-01-31',
      status: 'PENDING',
      page: 2,
      pageSize: 1,
    });
    expect(report).toMatchObject({
      method: 'CALCULATED_ON_REQUEST',
      policyId: 'policy',
      totals: { total: 4, ELIGIBLE: 1, INELIGIBLE: 1, PENDING: 2 },
      data: [{ family: { id: 'family-3' }, status: 'PENDING' }],
      pagination: { page: 2, pageSize: 1, total: 2 },
    });
    const records = await service.eligibilityRecords(actor, {
      referenceDate: '2026-01-31',
      status: 'INELIGIBLE',
      ...page,
      expectedQueryFingerprint: report.queryFingerprint,
    });
    expect(records.data.map((row) => row.family.id)).toEqual(['family-4']);
    expect(records.pagination.total).toBe(report.totals.INELIGIBLE);
  });
  it('answers not found for an unknown family filter', async () => {
    const { service, actor } = fixture();
    await expect(
      service.eligibility(actor, {
        referenceDate: '2026-01-31',
        familyId: 'missing',
        ...page,
      }),
    ).rejects.toMatchObject({ message: 'Resource not found' });
  });
});

describe('Data quality report and histories', () => {
  it('rejects a resolution period for issues that are still open', async () => {
    const { service, actor, ports } = fixture();
    await expect(
      service.dataQuality(actor, {
        ...period,
        dateBasis: 'RESOLUTION',
        status: 'OPEN',
        ...page,
      }),
    ).rejects.toMatchObject({ rule: 'REPORT_FILTER_CONFLICT' });
    expect(ports.qualityIssues).not.toHaveBeenCalled();
  });
  it('limits a family history to the requested civil period in the requested order', async () => {
    const { service, actor, ports } = fixture();
    ports.familyEvents.mockResolvedValue(
      ['02', '10', '20'].map((day) => ({
        type: 'ATTENDANCE',
        occurredAt: at(day),
        referenceDate: null,
        recordedAt: null,
        sourceType: 'Attendance',
        sourceId: day,
        familyId: 'family-1',
        personId: 'ana',
        activityId: 'activity',
        valid: true,
        invalidReason: null,
        details: {},
      })),
    );
    const history = await service.familyHistory(actor, 'alias-of-family-1', {
      ...page,
      order: 'desc',
      from: '2026-01-05',
      toExclusive: '2026-01-21',
    });
    expect(history.report.familyId).toBe('family-1');
    expect(history.data.map((row) => row.sourceId)).toEqual(['20', '10']);
  });
});
