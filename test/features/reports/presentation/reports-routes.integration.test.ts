import { describe, expect, it } from 'vitest';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
import { createPeriodicActivity } from '../../../support/projects-fixture.js';
import {
  confirmCall,
  enrollPerson,
} from '../../../support/attendance-fixture.js';
import { personRegistrationSchema } from '@erp/contracts/registration-api';
import {
  eligibilityReportSchema,
  frequencyRecordsSchema,
  frequencyReportSchema,
  historySchema,
  qualityRecordsSchema,
  qualityReportSchema,
  reachRecordsSchema,
  reachReportSchema,
} from '@erp/contracts/reports-api';

type Fixture = ReturnType<typeof setupIntegrationFixture>;
const jan = '2026-01-01T03:00:00.000Z';
const january = 'from=2026-01-01&toExclusive=2026-02-01';

function api(fixture: Fixture, cookie: string) {
  const send = (
    method: 'GET' | 'POST' | 'PATCH',
    url: string,
    payload?: object,
  ) =>
    fixture.runtime.app.inject({
      method,
      url: `/api/v1${url}`,
      headers: fixture.headers(cookie),
      ...(payload ? { payload } : {}),
    });
  const get = async (url: string) => {
    const response = await send('GET', url);
    expect(response.statusCode, `${url} ${response.body}`).toBe(200);
    return response.json();
  };
  async function family() {
    const response = await send('POST', '/families', {});
    expect(response.statusCode, response.body).toBe(201);
    return response.json().data as {
      id: string;
      code: string;
      revision: number;
    };
  }
  async function person(name: string, familyId: string) {
    const current = await send('GET', `/families/${familyId}`);
    const response = await send('POST', '/people', {
      name,
      familyId,
      expectedFamilyRevision: current.json().data.family.revision,
      validFrom: jan,
    });
    expect(response.statusCode, response.body).toBe(201);
    return personRegistrationSchema.parse(response.json().data);
  }
  return { send, get, family, person };
}
async function scenario(fixture: Fixture) {
  const operator = await fixture.operator('synthetic.coordinator', [
    'COORDINATION',
  ]);
  const http = api(fixture, operator.cookie);
  const first = await createPeriodicActivity(
    fixture,
    operator.cookie,
    'Synthetic Project One',
  );
  const second = await createPeriodicActivity(
    fixture,
    operator.cookie,
    'Synthetic Project Two',
  );
  const home = await http.family();
  const ana = await http.person('Ana Alpha', home.id);
  const bia = await http.person('Bia Beta', home.id);
  const caio = await http.person('Caio Gamma', home.id);
  await enrollPerson(
    fixture,
    operator.cookie,
    first.activity.id,
    ana.person.id,
  );
  await enrollPerson(
    fixture,
    operator.cookie,
    first.activity.id,
    caio.person.id,
  );
  const call = (activityId: string, day: string, personId: string) =>
    confirmCall(
      fixture,
      operator.cookie,
      activityId,
      operator.user.id,
      `2026-01-${day}T13:00:00Z`,
      [{ personId, status: 'PRESENT' }],
    );
  const opening = await call(first.activity.id, '05', ana.person.id);
  await call(first.activity.id, '12', ana.person.id);
  await call(second.activity.id, '06', bia.person.id);
  return { operator, http, first, second, home, ana, bia, caio, opening };
}

describe('Reach and frequency reports', () => {
  const fixture = setupIntegrationFixture();
  it('counts people, families, sessions and presences as separate units and proves each total', async () => {
    const { http, first, second, home, ana, bia } = await scenario(fixture);
    const report = reachReportSchema.parse(
      (await http.get(`/reports/reach?${january}`)).data,
    );
    // Caio is enrolled but never attended: enrollment is not reach.
    expect(report.totals).toEqual({
      people: 2,
      families: 1,
      sessions: 3,
      presences: 3,
    });
    expect(report.groups).toEqual(
      expect.arrayContaining([
        {
          activityId: first.activity.id,
          people: 1,
          families: 1,
          sessions: 2,
          presences: 2,
        },
        {
          activityId: second.activity.id,
          people: 1,
          families: 1,
          sessions: 1,
          presences: 1,
        },
      ]),
    );
    const records = async (unit: string, filters = january) =>
      reachRecordsSchema.parse(
        await http.get(
          `/reports/reach/records?${filters}&unit=${unit}&expectedQueryFingerprint=${report.queryFingerprint}`,
        ),
      );
    expect((await records('PERSON')).data).toEqual([
      { personId: ana.person.id, personName: 'Ana Alpha', presences: 2 },
      { personId: bia.person.id, personName: 'Bia Beta', presences: 1 },
    ]);
    expect((await records('FAMILY')).data).toEqual([
      { familyId: home.id, familyCode: home.code, people: 2, presences: 3 },
    ]);
    expect((await records('SESSION')).pagination.total).toBe(3);
    expect((await records('PRESENCE')).pagination.total).toBe(3);
    const narrowed = reachReportSchema.parse(
      (
        await http.get(
          `/reports/reach?${january}&projectId=${second.project.id}`,
        )
      ).data,
    );
    expect(narrowed.totals).toMatchObject({ people: 1, presences: 1 });
    const conflict = await http.send(
      'GET',
      `/reports/reach?${january}&projectId=${second.project.id}&activityId=${first.activity.id}`,
    );
    expect(conflict.statusCode, conflict.body).toBe(422);
    expect(conflict.json().error.details.rule).toBe('REPORT_FILTER_CONFLICT');
  });
  it('answers REPORT_CHANGED after a cancellation and keeps the canceled fact in the history', async () => {
    const { http, ana, opening } = await scenario(fixture);
    const report = reachReportSchema.parse(
      (await http.get(`/reports/reach?${january}`)).data,
    );
    const canceled = await http.send(
      'POST',
      `/sessions/${opening.session.id}/cancellation`,
      { expectedSessionRevision: 1, reason: 'Synthetic cancellation' },
    );
    expect(canceled.statusCode, canceled.body).toBe(200);
    const stale = await http.send(
      'GET',
      `/reports/reach/records?${january}&unit=PRESENCE&expectedQueryFingerprint=${report.queryFingerprint}`,
    );
    expect(stale.statusCode, stale.body).toBe(409);
    expect(stale.json().error.code).toBe('REPORT_CHANGED');
    const after = reachReportSchema.parse(
      (await http.get(`/reports/reach?${january}`)).data,
    );
    expect(after.totals).toMatchObject({ sessions: 2, presences: 2 });
    const history = historySchema.parse(
      await http.get(
        `/people/${ana.person.id}/history?eventTypes=ATTENDANCE&order=asc`,
      ),
    );
    expect(
      history.data.map((row) => [
        row.valid,
        row.invalidReason,
        row.details.status,
      ]),
    ).toEqual([
      [false, 'SESSION_CANCELED', 'PRESENT'],
      [true, null, 'PRESENT'],
    ]);
  });
  it('keeps the factual family after a transfer in totals, filters and histories', async () => {
    const { http, first, home, ana } = await scenario(fixture);
    const next = await http.family();
    const current = (await http.get(`/families/${home.id}`)).data.family;
    const moved = await http.send(
      'POST',
      `/people/${ana.person.id}/membership-transfers`,
      {
        membershipId: ana.membership.id,
        targetFamilyId: next.id,
        effectiveAt: '2026-01-20T03:00:00Z',
        expectedMembershipRevision: 1,
        expectedSourceFamilyRevision: current.revision,
        expectedTargetFamilyRevision: next.revision,
        reason: 'Synthetic move',
      },
    );
    expect(moved.statusCode, moved.body).toBe(200);
    const frequency = (familyId: string) =>
      http
        .get(
          `/reports/frequency?${january}&activityId=${first.activity.id}&familyId=${familyId}`,
        )
        .then((body) => frequencyReportSchema.parse(body.data));
    // Both presences happened before the move and stay with the family of the fact.
    expect((await frequency(home.id)).totals).toMatchObject({
      presenceCount: 2,
    });
    expect((await frequency(next.id)).totals).toMatchObject({
      presenceCount: 0,
      sessionCount: 0,
    });
    const types = async (familyId: string) =>
      historySchema
        .parse(await http.get(`/families/${familyId}/history?order=asc`))
        .data.map((row) => row.type);
    expect(await types(next.id)).toEqual(['MEMBERSHIP_STARTED']);
    expect(
      (await types(home.id)).filter((type) => type === 'ATTENDANCE'),
    ).toHaveLength(3);
    expect(await types(home.id)).toContain('MEMBERSHIP_ENDED');
  });
  it('reports known counts with an unknown rate until coverage and markings are complete', async () => {
    const { http, first, caio } = await scenario(fixture);
    const url = `/reports/frequency?${january}&activityId=${first.activity.id}`;
    const report = frequencyReportSchema.parse((await http.get(url)).data);
    // Ana: 2 presences. Caio: enrolled, 2 unrecorded opportunities.
    expect(report.totals).toMatchObject({
      participants: 2,
      sessionCount: 4,
      presenceCount: 2,
      unrecordedCount: 2,
      attendanceRate: null,
      coverageComplete: false,
      completedSessions: 2,
      canceledSessions: 0,
    });
    const detail = frequencyRecordsSchema.parse(
      await http.get(
        `/reports/frequency/records?${january}&activityId=${first.activity.id}&unit=OPPORTUNITY&expectedQueryFingerprint=${report.queryFingerprint}`,
      ),
    );
    expect(detail.pagination.total).toBe(report.totals.sessionCount);
    expect(
      detail.data.filter(
        (row) => 'personId' in row && row.personId === caio.person.id,
      ),
    ).toHaveLength(2);
    const single = frequencyReportSchema.parse(
      (await http.get(`${url}&personId=${caio.person.id}`)).data,
    );
    expect(single.totals).toMatchObject({ participants: 1, sessionCount: 2 });
  });
});

describe('Eligibility, data quality and report authorization', () => {
  const fixture = setupIntegrationFixture();
  it('keeps every family pending without a policy, with totals independent from the page, and writes nothing', async () => {
    const { http } = await scenario(fixture);
    await http.family();
    const database = fixture.runtime.database;
    const before = {
      audit: await database.auditEntry.count(),
      operations: await database.operationRecord.count(),
    };
    const report = eligibilityReportSchema.parse(
      await http
        .get('/reports/eligibility?referenceDate=2026-01-31&pageSize=1&page=2')
        .then((body) => body.data),
    );
    expect(report).toMatchObject({
      policyId: null,
      method: 'CALCULATED_ON_REQUEST',
      totals: { total: 2, ELIGIBLE: 0, INELIGIBLE: 0, PENDING: 2 },
      pagination: { page: 2, pageSize: 1, total: 2 },
    });
    expect(report.data).toHaveLength(1);
    expect(report.data[0]!.pendingReasons).toEqual(['POLICY_UNDEFINED']);
    const none = eligibilityReportSchema.parse(
      (
        await http.get(
          '/reports/eligibility?referenceDate=2026-01-31&status=INELIGIBLE',
        )
      ).data,
    );
    expect(none.totals.PENDING).toBe(2);
    expect(none.data).toEqual([]);
    const records = await http.get(
      `/reports/eligibility/records?referenceDate=2026-01-31&status=PENDING&expectedQueryFingerprint=${report.queryFingerprint}`,
    );
    expect(records.pagination.total).toBe(2);
    expect(await database.eligibilityAssessment.count()).toBe(0);
    expect(await database.auditEntry.count()).toBe(before.audit);
    expect(await database.operationRecord.count()).toBe(before.operations);
  });
  it('lists the three situations with the same policy and evidences as the family preview', async () => {
    const { http, first, home } = await scenario(fixture);
    const empty = await http.family();
    const policy = await http.send('POST', '/eligibility-policies', {
      definition: {
        schemaVersion: 1,
        period: {
          type: 'FIXED_PERIOD',
          start: '2026-01-01',
          endExclusive: '2026-02-01',
        },
        minimum: { type: 'PRESENCE_COUNT', value: 2 },
        activityIds: [first.activity.id],
        activityCombination: 'ANY_ACTIVITY',
        membershipScope: 'CURRENT_ON_REFERENCE',
        opportunityRule: 'ENROLLMENT_OR_RECORDED',
        justificationRule: 'NOT_SUPPORTED',
        recessRule: 'RECORDED_SESSIONS_ONLY',
        newParticipantRule: 'OPPORTUNITY_RULE',
        toleranceRule: 'NONE',
        incompleteEvidenceRule: 'THREE_VALUED',
      },
      effectiveFrom: '2026-01-01',
      expectedLatestPolicyId: null,
      decisionReference: 'Synthetic decision reference',
      reason: 'Synthetic publication',
      retroactive: true,
    });
    expect(policy.statusCode, policy.body).toBe(201);
    const report = eligibilityReportSchema.parse(
      (await http.get('/reports/eligibility?referenceDate=2026-01-31')).data,
    );
    expect(report).toMatchObject({
      policyId: policy.json().data.id,
      totals: { total: 2, ELIGIBLE: 1, INELIGIBLE: 0, PENDING: 1 },
    });
    const preview = (
      await http.get(
        `/families/${home.id}/eligibility-preview?referenceDate=2026-01-31`,
      )
    ).data;
    const row = report.data.find((item) => item.family.id === home.id)!;
    expect(row).toMatchObject({
      status: 'ELIGIBLE',
      explanation: preview.explanation,
      evidences: preview.evidences,
    });
    expect(
      report.data.find((item) => item.family.id === empty.id),
    ).toMatchObject({
      status: 'PENDING',
      pendingReasons: ['MEMBERSHIP_UNRESOLVED'],
    });
    const eligible = eligibilityReportSchema.parse(
      (
        await http.get(
          '/reports/eligibility?referenceDate=2026-01-31&status=ELIGIBLE',
        )
      ).data,
    );
    expect(eligible.data.map((item) => item.family.id)).toEqual([home.id]);
    expect(eligible.totals).toEqual(report.totals);
  });
  it('selects data quality issues by identification or resolution date and says which one', async () => {
    const { http, ana, bia } = await scenario(fixture);
    const renamed = await http.send('PATCH', `/people/${bia.person.id}`, {
      expectedRevision: 1,
      name: 'Ana Alpha',
    });
    expect(renamed.statusCode, renamed.body).toBe(200);
    const year = 'from=2026-01-01&toExclusive=2100-01-01';
    const open = qualityReportSchema.parse(
      (await http.get(`/reports/data-quality?${year}`)).data,
    );
    expect(open).toMatchObject({
      filters: { dateBasis: 'IDENTIFICATION' },
      totals: { total: 1, open: 1, resolved: 0 },
    });
    expect(open.data[0]).toMatchObject({
      entityId: bia.person.id,
      candidateIds: [ana.person.id],
    });
    const unresolved = qualityReportSchema.parse(
      (await http.get(`/reports/data-quality?${year}&dateBasis=RESOLUTION`))
        .data,
    );
    expect(unresolved.totals.total).toBe(0);
    const resolved = await http.send(
      'POST',
      `/data-quality-issues/${open.data[0]!.id}/resolution`,
      {
        expectedRevision: 1,
        resolution: 'DISTINCT',
        reason: 'Synthetic distinct people',
      },
    );
    expect(resolved.statusCode, resolved.body).toBe(200);
    const stale = await http.send(
      'GET',
      `/reports/data-quality/records?${year}&expectedQueryFingerprint=${open.queryFingerprint}`,
    );
    expect(stale.statusCode, stale.body).toBe(409);
    const byResolution = qualityReportSchema.parse(
      (await http.get(`/reports/data-quality?${year}&dateBasis=RESOLUTION`))
        .data,
    );
    expect(byResolution).toMatchObject({
      filters: { dateBasis: 'RESOLUTION' },
      totals: { total: 1, resolved: 1, byResolution: { DISTINCT: 1 } },
    });
    const detail = qualityRecordsSchema.parse(
      await http.get(
        `/reports/data-quality/records?${year}&dateBasis=RESOLUTION&expectedQueryFingerprint=${byResolution.queryFingerprint}`,
      ),
    );
    expect(detail.data[0]).toMatchObject({
      resolution: 'DISTINCT',
      reason: 'Synthetic distinct people',
    });
    const conflict = await http.send(
      'GET',
      `/reports/data-quality?${year}&dateBasis=RESOLUTION&status=OPEN`,
    );
    expect(conflict.statusCode, conflict.body).toBe(422);
  });
  it('gives an activity manager attendance facts only, through totals, details and histories', async () => {
    const { http, first, home, ana } = await scenario(fixture);
    const manager = await fixture.operator('synthetic.manager', [
      'ACTIVITY_MANAGER',
    ]);
    const limited = api(fixture, manager.cookie);
    const reach = reachReportSchema.parse(
      (await limited.get(`/reports/reach?${january}`)).data,
    );
    expect(reach.totals.people).toBe(2);
    await limited.get(
      `/reports/frequency?${january}&activityId=${first.activity.id}`,
    );
    const history = historySchema.parse(
      await limited.get(`/people/${ana.person.id}/history`),
    );
    expect(history.report.eventTypes).toEqual([
      'ATTENDANCE',
      'ENROLLMENT_ENDED',
      'ENROLLMENT_STARTED',
    ]);
    expect(new Set(history.data.map((row) => row.type))).toEqual(
      new Set(['ATTENDANCE', 'ENROLLMENT_STARTED']),
    );
    const full = historySchema.parse(
      await http.get(`/people/${ana.person.id}/history`),
    );
    expect(full.data.map((row) => row.type)).toContain('MEMBERSHIP_STARTED');
    for (const url of [
      '/reports/eligibility?referenceDate=2026-01-31',
      `/reports/data-quality?${january}`,
      `/families/${home.id}/history`,
    ])
      for (const cookie of [manager.cookie, fixture.adminCookie])
        expect(
          (await api(fixture, cookie).send('GET', url)).statusCode,
          url,
        ).toBe(403);
    expect(
      (
        await api(fixture, fixture.adminCookie).send(
          'GET',
          `/reports/reach?${january}`,
        )
      ).statusCode,
    ).toBe(403);
  });
  it('counts a merged person once and resolves the merged identity in histories', async () => {
    const { operator, http, first, home, ana } = await scenario(fixture);
    const twin = await http.person('Dora Delta', home.id);
    await confirmCall(
      fixture,
      operator.cookie,
      first.activity.id,
      operator.user.id,
      '2026-01-19T13:00:00Z',
      [{ personId: twin.person.id, status: 'PRESENT' }],
    );
    const before = reachReportSchema.parse(
      (await http.get(`/reports/reach?${january}`)).data,
    );
    expect(before.totals.people).toBe(3);
    const preview = (
      await http.send('POST', '/identity-merges/preview', {
        entityType: 'PERSON',
        sourceId: twin.person.id,
        targetId: ana.person.id,
      })
    ).json().data;
    const merged = await http.send('POST', '/identity-merges', {
      entityType: 'PERSON',
      sourceId: twin.person.id,
      targetId: ana.person.id,
      expectedSourceRevision: preview.expectedSourceRevision,
      expectedTargetRevision: preview.expectedTargetRevision,
      expectedSourceFingerprint: preview.sourceFingerprint,
      fieldSelections: { name: 'TARGET' },
      membershipResolutions: [
        {
          id: twin.membership.id,
          action: 'SUPERSEDE',
          supersededById: ana.membership.id,
        },
      ],
      reason: 'Synthetic duplicate registration',
    });
    expect(merged.statusCode, merged.body).toBe(201);
    const after = reachReportSchema.parse(
      (await http.get(`/reports/reach?${january}`)).data,
    );
    expect(after.totals).toMatchObject({ people: 2, presences: 4 });
    const alias = historySchema.parse(
      await http.get(`/people/${twin.person.id}/history?eventTypes=ATTENDANCE`),
    );
    expect(alias.report.personId).toBe(ana.person.id);
    expect(alias.pagination.total).toBe(3);
  });
});
