import { describe, expect, it, vi } from 'vitest';
import { HttpReports } from '../../../../src/reports';
import { ApiClient } from '../../../../src/shared/api-client';

const personId = '00000000-0000-4000-8000-000000000001';
const familyId = '00000000-0000-4000-8000-000000000002';
const activityId = '00000000-0000-4000-8000-000000000003';
const sessionId = '00000000-0000-4000-8000-000000000004';
const fingerprint = 'b'.repeat(64);
const period = { from: '2026-09-01', toExclusive: '2026-10-01' };
const generatedAt = '2026-10-05T12:00:00.000Z';
const pagination = { page: 1, pageSize: 20, total: 1 };
const reachReport = {
  generatedAt,
  filters: { ...period, instituteId: null, projectId: null, activityId: null },
  units: ['PERSON', 'FAMILY', 'SESSION', 'PRESENCE'],
  method: 'PRESENT_MARKINGS_IN_COMPLETED_SESSIONS',
  queryFingerprint: fingerprint,
  totals: { people: 1, families: 1, sessions: 1, presences: 1 },
  groups: [],
};
const frequencyReport = {
  generatedAt,
  filters: { ...period, activityId, personId: null, familyId: null },
  units: ['OPPORTUNITY', 'SESSION'],
  denominator: 'ENROLLMENT_OR_RECORDED',
  queryFingerprint: fingerprint,
  totals: {
    participants: 1,
    sessionCount: 1,
    presenceCount: 0,
    absenceCount: 0,
    unrecordedCount: 1,
    attendanceRate: null,
    markingsComplete: false,
    contextComplete: true,
    coverageComplete: false,
    isComplete: false,
    completedSessions: 1,
    canceledSessions: 0,
  },
  coverage: { confirmedPeriods: [], gaps: [period] },
};
const eligibilityReport = {
  generatedAt,
  filters: { referenceDate: '2026-10-05', familyId: null, status: null },
  unit: 'FAMILY',
  method: 'CALCULATED_ON_REQUEST',
  policyId: null,
  queryFingerprint: fingerprint,
  totals: { total: 1, ELIGIBLE: 0, INELIGIBLE: 0, PENDING: 1 },
  data: [
    {
      family: { id: familyId, code: '1001' },
      status: 'PENDING',
      pendingReasons: ['POLICY_UNDEFINED'],
      policyId: null,
      explanation: {
        rule: 'POLICY_UNDEFINED',
        period: null,
        minimum: null,
        activityIds: [],
        activityCombination: null,
        membershipScope: null,
        opportunityRule: null,
        qualifyingPersonIds: [],
      },
      evidences: [],
    },
  ],
  pagination,
};
const qualityReport = {
  generatedAt,
  filters: { ...period, dateBasis: 'IDENTIFICATION', kind: null, status: null },
  unit: 'ISSUE',
  queryFingerprint: fingerprint,
  totals: {
    total: 1,
    open: 1,
    resolved: 0,
    byKind: { POSSIBLE_DUPLICATE: 0, MISSING_DATA: 1 },
    byResolution: { DISTINCT: 0, MERGED: 0, COMPLETED: 0, NOT_TRACKED: 0 },
  },
  data: [
    {
      id: personId,
      entityType: 'FAMILY',
      entityId: familyId,
      kind: 'MISSING_DATA',
      candidateIds: [],
      fieldKeys: ['contactPhone'],
      identifiedAt: generatedAt,
      resolvedAt: null,
      resolution: null,
      resolvedBy: null,
      reason: null,
      revision: 1,
    },
  ],
  pagination,
};

describe('HTTP reports', () => {
  it('unwraps reach totals and sends the civil interval without adding unsupported filters', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: reachReport }));
    const result = await new HttpReports(new ApiClient(fetcher)).reach(period);
    expect(result).toEqual(reachReport);
    const url = new URL(String(fetcher.mock.calls[0]?.[0]), 'http://localhost');
    expect(url.pathname).toBe('/api/v1/reports/reach');
    expect(Object.fromEntries(url.searchParams)).toEqual(period);
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe('GET');
  });

  it('preserves the direct reach detail envelope and fingerprint with the selected counting unit', async () => {
    const records = {
      report: {
        generatedAt,
        filters: reachReport.filters,
        unit: 'PERSON',
        queryFingerprint: fingerprint,
      },
      data: [{ personId, personName: 'Synthetic person', presences: 1 }],
      pagination,
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(records));
    const result = await new HttpReports(new ApiClient(fetcher)).reachRecords({
      ...period,
      unit: 'PERSON',
      expectedQueryFingerprint: fingerprint,
    });
    expect(result).toEqual(records);
    const url = new URL(String(fetcher.mock.calls[0]?.[0]), 'http://localhost');
    expect(url.pathname).toBe('/api/v1/reports/reach/records');
    expect(url.searchParams.get('expectedQueryFingerprint')).toBe(fingerprint);
    expect(url.searchParams.get('unit')).toBe('PERSON');
  });

  it('keeps incomplete frequency totals and rates unknown rather than deriving a percentage', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: frequencyReport }));
    expect(
      await new HttpReports(new ApiClient(fetcher)).frequency({
        ...period,
        activityId,
      }),
    ).toEqual(frequencyReport);
    const url = new URL(String(fetcher.mock.calls[0]?.[0]), 'http://localhost');
    expect(url.pathname).toBe('/api/v1/reports/frequency');
    expect(url.searchParams.get('activityId')).toBe(activityId);
  });

  it('retrieves frequency opportunities with unknown markings and the historical family filter', async () => {
    const records = {
      report: {
        generatedAt,
        filters: { ...frequencyReport.filters, familyId },
        unit: 'OPPORTUNITY',
        queryFingerprint: fingerprint,
      },
      data: [
        {
          personId,
          personName: 'Synthetic person',
          sessionId,
          occurredAt: generatedAt,
          familyId,
          status: null,
          attendanceId: null,
          relevance: 'ENROLLMENT',
          contextResolved: true,
        },
      ],
      pagination,
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(records));
    expect(
      await new HttpReports(new ApiClient(fetcher)).frequencyRecords({
        ...period,
        activityId,
        familyId,
        unit: 'OPPORTUNITY',
        expectedQueryFingerprint: fingerprint,
      }),
    ).toEqual(records);
    const url = new URL(String(fetcher.mock.calls[0]?.[0]), 'http://localhost');
    expect(url.pathname).toBe('/api/v1/reports/frequency/records');
    expect(url.searchParams.get('familyId')).toBe(familyId);
    expect(url.searchParams.get('expectedQueryFingerprint')).toBe(fingerprint);
  });

  it('preserves eligibility totals independently from pagination and unknown policy data', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: eligibilityReport }));
    expect(
      await new HttpReports(new ApiClient(fetcher)).eligibility({
        referenceDate: '2026-10-05',
        status: 'PENDING',
      }),
    ).toEqual(eligibilityReport);
    const url = new URL(String(fetcher.mock.calls[0]?.[0]), 'http://localhost');
    expect(url.pathname).toBe('/api/v1/reports/eligibility');
    expect(url.searchParams.get('status')).toBe('PENDING');
    expect(url.searchParams.get('referenceDate')).toBe('2026-10-05');
  });

  it('requests eligibility components with an explicit status and the same total fingerprint', async () => {
    const records = {
      report: {
        generatedAt,
        filters: { ...eligibilityReport.filters, status: 'PENDING' },
        unit: 'FAMILY',
        queryFingerprint: fingerprint,
      },
      data: eligibilityReport.data,
      pagination,
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(records));
    expect(
      await new HttpReports(new ApiClient(fetcher)).eligibilityRecords({
        referenceDate: '2026-10-05',
        status: 'PENDING',
        expectedQueryFingerprint: fingerprint,
      }),
    ).toEqual(records);
    const url = new URL(String(fetcher.mock.calls[0]?.[0]), 'http://localhost');
    expect(url.pathname).toBe('/api/v1/reports/eligibility/records');
    expect(url.searchParams.get('status')).toBe('PENDING');
    expect(url.searchParams.get('expectedQueryFingerprint')).toBe(fingerprint);
  });

  it('retrieves quality issues with an explicit identification or resolution date basis', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: qualityReport }));
    expect(
      await new HttpReports(new ApiClient(fetcher)).quality(period),
    ).toEqual(qualityReport);
    const url = new URL(String(fetcher.mock.calls[0]?.[0]), 'http://localhost');
    expect(url.pathname).toBe('/api/v1/reports/data-quality');
    expect(url.searchParams.get('dateBasis')).toBe('IDENTIFICATION');
  });

  it('preserves quality detail pagination and resolution filters', async () => {
    const records = {
      report: {
        generatedAt,
        filters: {
          ...qualityReport.filters,
          dateBasis: 'RESOLUTION',
          status: 'RESOLVED',
        },
        unit: 'ISSUE',
        queryFingerprint: fingerprint,
      },
      data: [],
      pagination: { ...pagination, total: 0 },
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(records));
    expect(
      await new HttpReports(new ApiClient(fetcher)).qualityRecords({
        ...period,
        dateBasis: 'RESOLUTION',
        status: 'RESOLVED',
        expectedQueryFingerprint: fingerprint,
      }),
    ).toEqual(records);
    const url = new URL(String(fetcher.mock.calls[0]?.[0]), 'http://localhost');
    expect(url.pathname).toBe('/api/v1/reports/data-quality/records');
    expect(url.searchParams.get('dateBasis')).toBe('RESOLUTION');
    expect(url.searchParams.get('status')).toBe('RESOLVED');
  });

  it('retrieves the direct family history with dates and canceled facts preserved', async () => {
    const history = {
      report: {
        generatedAt,
        order: 'asc',
        eventTypes: ['ATTENDANCE'],
        ...period,
        familyId,
      },
      data: [
        {
          type: 'ATTENDANCE',
          occurredAt: generatedAt,
          referenceDate: null,
          recordedAt: generatedAt,
          sourceType: 'Attendance',
          sourceId: personId,
          familyId,
          personId,
          activityId,
          valid: false,
          invalidReason: 'SESSION_CANCELED',
          details: { status: 'PRESENT' },
        },
      ],
      pagination,
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(history));
    expect(
      await new HttpReports(new ApiClient(fetcher)).familyHistory(familyId, {
        ...period,
        order: 'asc',
        eventTypes: ['ATTENDANCE'],
      }),
    ).toEqual(history);
    const url = new URL(String(fetcher.mock.calls[0]?.[0]), 'http://localhost');
    expect(url.pathname).toBe(`/api/v1/families/${familyId}/history`);
    expect(url.searchParams.get('eventTypes')).toBe('ATTENDANCE');
    expect(url.searchParams.get('order')).toBe('asc');
  });
});
