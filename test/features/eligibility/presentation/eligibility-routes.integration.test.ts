import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
import {
  createParticipant,
  createPeriodicActivity,
} from '../../../support/projects-fixture.js';
import {
  confirmCall,
  enrollPerson,
} from '../../../support/attendance-fixture.js';
import {
  assessmentDtoSchema,
  eligibilityPreviewSchema,
  policiesPageSchema,
  policyVersionSchema,
} from '@erp/contracts/eligibility-api';
import { auditPageSchema } from '@erp/contracts/audit-api';

type Fixture = ReturnType<typeof setupIntegrationFixture>;
const publication = (activityId: string, changes: object = {}) => ({
  definition: {
    schemaVersion: 1,
    period: {
      type: 'FIXED_PERIOD',
      start: '2026-01-01',
      endExclusive: '2026-02-01',
    },
    minimum: { type: 'PRESENCE_COUNT', value: 2 },
    activityIds: [activityId],
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
  expectedLatestPolicyId: null as string | null,
  decisionReference: 'Synthetic decision reference',
  reason: 'Synthetic publication',
  retroactive: true,
  ...changes,
});
const publish = (fixture: Fixture, cookie: string, payload: object) =>
  fixture.runtime.app.inject({
    method: 'POST',
    url: '/api/v1/eligibility-policies',
    headers: fixture.headers(cookie),
    payload,
  });
const preview = (
  fixture: Fixture,
  cookie: string,
  familyId: string,
  referenceDate = '2026-01-31',
) =>
  fixture.runtime.app.inject({
    method: 'GET',
    url: `/api/v1/families/${familyId}/eligibility-preview?referenceDate=${referenceDate}`,
    headers: fixture.headers(cookie),
  });

describe('Eligibility policies', () => {
  const fixture = setupIntegrationFixture();
  it('keeps every family pending and stores nothing while no policy exists', async () => {
    const social = await fixture.operator('synthetic.social', [
      'SOCIAL_ASSISTANCE',
    ]);
    const { family } = await createParticipant(fixture, social.cookie);
    const response = await preview(fixture, social.cookie, family.id);
    expect(response.statusCode, response.body).toBe(200);
    expect(eligibilityPreviewSchema.parse(response.json().data)).toMatchObject({
      status: 'PENDING',
      policyId: null,
      pendingReasons: ['POLICY_UNDEFINED'],
      evidences: [],
    });
    const database = fixture.runtime.database;
    expect(await database.eligibilityAssessment.count()).toBe(0);
    expect(await database.eligibilityPolicy.count()).toBe(0);
    const policies = await fixture.runtime.app.inject({
      method: 'GET',
      url: '/api/v1/eligibility-policies',
      headers: fixture.headers(social.cookie),
    });
    expect(policiesPageSchema.parse(policies.json())).toMatchObject({
      data: [],
      pagination: { total: 0 },
    });
  });
  it('reserves publication to coordination and rejects incomplete or unsupported definitions', async () => {
    const coordinator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const social = await fixture.operator('synthetic.social', [
      'SOCIAL_ASSISTANCE',
    ]);
    const { activity, project } = await createPeriodicActivity(
      fixture,
      coordinator.cookie,
    );
    const valid = publication(activity.id);
    expect((await publish(fixture, social.cookie, valid)).statusCode).toBe(403);
    const unsupported = await publish(fixture, coordinator.cookie, {
      ...valid,
      definition: { ...valid.definition, toleranceRule: 'ONE_ABSENCE' },
    });
    expect(unsupported.statusCode, unsupported.body).toBe(422);
    expect(unsupported.json().error.details.rule).toBe(
      'UNSUPPORTED_POLICY_MODALITY',
    );
    const withoutMinimum: Record<string, unknown> = { ...valid.definition };
    delete withoutMinimum.minimum;
    expect(
      (
        await publish(fixture, coordinator.cookie, {
          ...valid,
          definition: withoutMinimum,
        })
      ).statusCode,
    ).toBe(400);
    const notRetroactive = await publish(fixture, coordinator.cookie, {
      ...valid,
      retroactive: false,
    });
    expect(notRetroactive.json().error.details.rule).toBe(
      'RETROACTIVE_CONFIRMATION_REQUIRED',
    );
    const serviceType = await fixture.runtime.app.inject({
      method: 'POST',
      url: '/api/v1/service-types',
      headers: fixture.headers(coordinator.cookie),
      payload: { code: 'SYNTHETIC', name: 'Synthetic one-off type' },
    });
    expect(serviceType.statusCode, serviceType.body).toBe(201);
    const oneOff = await fixture.runtime.app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/activities`,
      headers: fixture.headers(coordinator.cookie),
      payload: {
        expectedProjectRevision: project.revision,
        name: 'Synthetic one-off activity',
        nature: 'ONE_OFF',
        serviceTypeId: serviceType.json().data.id,
      },
    });
    expect(oneOff.statusCode, oneOff.body).toBe(201);
    const pointwise = await publish(
      fixture,
      coordinator.cookie,
      publication(oneOff.json().data.id),
    );
    expect(pointwise.statusCode, pointwise.body).toBe(422);
    expect(pointwise.json().error.details.rule).toBe(
      'PERIODIC_ACTIVITY_REQUIRED',
    );
    expect(await fixture.runtime.database.eligibilityPolicy.count()).toBe(0);
  });
  it('publishes immutable versions, replays the same key and evaluates past dates with the version then in effect', async () => {
    const coordinator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const { activity } = await createPeriodicActivity(
      fixture,
      coordinator.cookie,
    );
    const { family } = await createParticipant(fixture, coordinator.cookie);
    const app = fixture.runtime.app;
    const key = randomUUID();
    const first = publication(activity.id, { effectiveFrom: '2026-02-01' });
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/eligibility-policies',
      headers: fixture.headers(coordinator.cookie, key),
      payload: first,
    });
    expect(created.statusCode, created.body).toBe(201);
    const policy = policyVersionSchema.parse(created.json().data);
    expect(policy).toMatchObject({
      effectiveFrom: '2026-02-01',
      effectiveUntilExclusive: null,
      recordedBy: coordinator.user.id,
    });
    const replay = await app.inject({
      method: 'POST',
      url: '/api/v1/eligibility-policies',
      headers: fixture.headers(coordinator.cookie, key),
      payload: first,
    });
    expect(replay.statusCode, replay.body).toBe(201);
    expect(replay.json().data).toEqual(created.json().data);
    const stale = await publish(
      fixture,
      coordinator.cookie,
      publication(activity.id, { effectiveFrom: '2026-03-01' }),
    );
    expect(stale.statusCode, stale.body).toBe(409);
    expect(stale.json().error.details).toEqual({
      rule: 'POLICY_CHANGED',
      ids: [policy.id],
    });
    const next = publication(activity.id, {
      effectiveFrom: '2026-03-01',
      expectedLatestPolicyId: policy.id,
    });
    const concurrent = await Promise.all([
      publish(fixture, coordinator.cookie, next),
      publish(fixture, coordinator.cookie, next),
    ]);
    expect(concurrent.map((row) => row.statusCode).sort()).toEqual([201, 409]);
    const second = policyVersionSchema.parse(
      concurrent.find((row) => row.statusCode === 201)!.json().data,
    );
    const listed = policiesPageSchema.parse(
      (
        await app.inject({
          method: 'GET',
          url: '/api/v1/eligibility-policies',
          headers: fixture.headers(coordinator.cookie),
        })
      ).json(),
    );
    expect(
      listed.data.map((row) => [
        row.id,
        row.effectiveFrom,
        row.effectiveUntilExclusive,
      ]),
    ).toEqual([
      [second.id, '2026-03-01', null],
      [policy.id, '2026-02-01', '2026-03-01'],
    ]);
    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/eligibility-policies/${policy.id}`,
      headers: fixture.headers(coordinator.cookie),
    });
    expect(policyVersionSchema.parse(detail.json().data)).toEqual(
      listed.data[1],
    );
    const policyIdOn = async (referenceDate: string) =>
      (
        await preview(fixture, coordinator.cookie, family.id, referenceDate)
      ).json().data.policyId;
    expect(await policyIdOn('2026-01-31')).toBeNull();
    expect(await policyIdOn('2026-02-28')).toBe(policy.id);
    expect(await policyIdOn('2026-03-01')).toBe(second.id);
    await expect(
      fixture.runtime.database.$executeRawUnsafe(
        `UPDATE "EligibilityPolicy" SET reason = 'Synthetic rewrite'`,
      ),
    ).rejects.toThrow();
    const history = auditPageSchema.parse(
      (
        await app.inject({
          method: 'GET',
          url: `/api/v1/audit-entries?entityType=EligibilityPolicy&entityId=${policy.id}`,
          headers: fixture.headers(coordinator.cookie),
        })
      ).json(),
    );
    expect(history.data).toHaveLength(1);
    expect(history.data[0]).toMatchObject({
      classification: 'ELIGIBILITY',
      action: 'CREATE',
      actorId: coordinator.user.id,
      reason: 'Synthetic publication',
    });
  });
});

describe('Eligibility assessments', () => {
  const fixture = setupIntegrationFixture();
  async function scenario() {
    const coordinator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const { activity } = await createPeriodicActivity(
      fixture,
      coordinator.cookie,
    );
    const { person, family } = await createParticipant(
      fixture,
      coordinator.cookie,
    );
    await enrollPerson(fixture, coordinator.cookie, activity.id, person.id);
    const published = await publish(
      fixture,
      coordinator.cookie,
      publication(activity.id),
    );
    expect(published.statusCode, published.body).toBe(201);
    const call = (day: string, status: 'PRESENT' | 'ABSENT') =>
      confirmCall(
        fixture,
        coordinator.cookie,
        activity.id,
        coordinator.user.id,
        `2026-01-${day}T13:00:00Z`,
        [{ personId: person.id, status }],
      );
    const assess = (cookie = coordinator.cookie, key = randomUUID()) =>
      fixture.runtime.app.inject({
        method: 'POST',
        url: `/api/v1/families/${family.id}/eligibility-assessments`,
        headers: fixture.headers(cookie, key),
        payload: { referenceDate: '2026-01-31' },
      });
    return {
      coordinator,
      activity,
      person,
      family,
      call,
      assess,
      policyId: published.json().data.id as string,
    };
  }
  it('persists an eligible assessment and keeps it after a later cancellation changes a new evaluation', async () => {
    const { coordinator, person, family, call, assess, policyId } =
      await scenario();
    const app = fixture.runtime.app;
    const enrolledOnly = await preview(fixture, coordinator.cookie, family.id);
    expect(enrolledOnly.json().data).toMatchObject({
      status: 'PENDING',
      pendingReasons: ['NO_OPPORTUNITIES'],
    });
    const firstCall = await call('05', 'PRESENT');
    await call('12', 'PRESENT');
    const key = randomUUID();
    const created = await assess(coordinator.cookie, key);
    expect(created.statusCode, created.body).toBe(201);
    const assessment = assessmentDtoSchema.parse(created.json().data);
    expect(assessment).toMatchObject({
      familyId: family.id,
      referenceDate: '2026-01-31',
      status: 'ELIGIBLE',
      policyId,
      requestedBy: coordinator.user.id,
      pendingReasons: [],
      explanation: {
        rule: 'MEMBER_MEETS_MINIMUM',
        qualifyingPersonIds: [person.id],
        period: { from: '2026-01-01', toExclusive: '2026-02-01' },
      },
      evidences: [{ personId: person.id, sessionCount: 2, presenceCount: 2 }],
    });
    const replay = await assess(coordinator.cookie, key);
    expect(replay.statusCode, replay.body).toBe(201);
    expect(replay.json().data).toEqual(created.json().data);
    expect(await fixture.runtime.database.eligibilityAssessment.count()).toBe(
      1,
    );
    const canceled = await app.inject({
      method: 'POST',
      url: `/api/v1/sessions/${firstCall.session.id}/cancellation`,
      headers: fixture.headers(coordinator.cookie),
      payload: {
        expectedSessionRevision: firstCall.session.revision,
        reason: 'Synthetic cancellation',
      },
    });
    expect(canceled.statusCode, canceled.body).toBe(200);
    const after = await preview(fixture, coordinator.cookie, family.id);
    expect(after.json().data).toMatchObject({
      status: 'PENDING',
      evidences: [{ sessionCount: 1, presenceCount: 1 }],
    });
    const saved = await app.inject({
      method: 'GET',
      url: `/api/v1/eligibility-assessments/${assessment.id}`,
      headers: fixture.headers(coordinator.cookie),
    });
    expect(saved.statusCode, saved.body).toBe(200);
    expect(saved.json().data).toEqual(created.json().data);
    expect(await fixture.runtime.database.eligibilityAssessment.count()).toBe(
      1,
    );
    await expect(
      fixture.runtime.database.$executeRawUnsafe(
        `UPDATE "EligibilityEvidence" SET "presenceCount" = 0`,
      ),
    ).rejects.toThrow();
  });
  it('concludes ineligible only after declared coverage proves the minimum is out of reach', async () => {
    const { coordinator, activity, family, call, assess } = await scenario();
    const app = fixture.runtime.app;
    await call('05', 'ABSENT');
    await call('12', 'PRESENT');
    await call('19', 'ABSENT');
    expect(
      (await preview(fixture, coordinator.cookie, family.id)).json().data,
    ).toMatchObject({
      status: 'PENDING',
      pendingReasons: ['COVERAGE_INCOMPLETE'],
    });
    const coverage = (
      await app.inject({
        method: 'GET',
        url: `/api/v1/activities/${activity.id}/coverage?periodStart=2026-01-01&periodEndExclusive=2026-02-01`,
        headers: fixture.headers(coordinator.cookie),
      })
    ).json().data;
    const declared = await app.inject({
      method: 'POST',
      url: `/api/v1/activities/${activity.id}/coverage-declarations`,
      headers: fixture.headers(coordinator.cookie),
      payload: {
        periodStart: coverage.periodStart,
        periodEndExclusive: coverage.periodEndExclusive,
        expectedActivityRevision: coverage.expectedActivityRevision,
        expectedSourceFingerprint: coverage.sourceFingerprint,
        confirmed: true,
        reason: 'Synthetic complete register',
      },
    });
    expect(declared.statusCode, declared.body).toBe(201);
    const created = await assess();
    expect(created.statusCode, created.body).toBe(201);
    expect(assessmentDtoSchema.parse(created.json().data)).toMatchObject({
      status: 'INELIGIBLE',
      pendingReasons: [],
      explanation: { rule: 'ALL_MEMBERS_BELOW_MINIMUM' },
      evidences: [
        {
          sessionCount: 3,
          presenceCount: 1,
          absenceCount: 2,
          coverageComplete: true,
          status: 'INELIGIBLE',
        },
      ],
    });
  });
  it('denies family results and their audit to activity managers and administrators', async () => {
    const { coordinator, family, call, assess } = await scenario();
    const manager = await fixture.operator('synthetic.manager', [
      'ACTIVITY_MANAGER',
    ]);
    const social = await fixture.operator('synthetic.social', [
      'SOCIAL_ASSISTANCE',
    ]);
    await call('05', 'PRESENT');
    const created = await assess(social.cookie);
    expect(created.statusCode, created.body).toBe(201);
    const assessment = assessmentDtoSchema.parse(created.json().data);
    expect(assessment.requestedBy).toBe(social.user.id);
    const app = fixture.runtime.app;
    const auditUrl = `/api/v1/audit-entries?entityType=EligibilityAssessment&entityId=${assessment.id}`;
    for (const cookie of [manager.cookie, fixture.adminCookie]) {
      expect((await preview(fixture, cookie, family.id)).statusCode).toBe(403);
      expect((await assess(cookie)).statusCode).toBe(403);
      for (const url of [
        `/api/v1/eligibility-assessments/${assessment.id}`,
        '/api/v1/eligibility-policies',
        auditUrl,
      ])
        expect(
          (
            await app.inject({
              method: 'GET',
              url,
              headers: fixture.headers(cookie),
            })
          ).statusCode,
          url,
        ).toBe(403);
    }
    const history = auditPageSchema.parse(
      (
        await app.inject({
          method: 'GET',
          url: auditUrl,
          headers: fixture.headers(coordinator.cookie),
        })
      ).json(),
    );
    expect(history.data).toHaveLength(1);
    expect(history.data[0]).toMatchObject({
      classification: 'ELIGIBILITY',
      actorId: social.user.id,
      reason: null,
      after: { id: assessment.id, status: 'PENDING' },
    });
    const hidden = await app.inject({
      method: 'GET',
      url: `/api/v1/audit-entries/${history.data[0]!.id}`,
      headers: fixture.headers(manager.cookie),
    });
    expect(hidden.statusCode, hidden.body).toBe(404);
  });
  it('rolls back the assessment, its evidences and the operation when audit fails, then accepts the same key', async () => {
    const { call, assess, coordinator } = await scenario();
    await call('05', 'PRESENT');
    const database = fixture.runtime.database;
    await database.$executeRawUnsafe(
      `CREATE FUNCTION fail_eligibility_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."entityType" = 'EligibilityAssessment' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$`,
    );
    await database.$executeRawUnsafe(
      `CREATE TRIGGER fail_eligibility_audit BEFORE INSERT ON "AuditEntry" FOR EACH ROW EXECUTE FUNCTION fail_eligibility_audit()`,
    );
    const key = randomUUID();
    try {
      const failed = await assess(coordinator.cookie, key);
      expect(failed.statusCode, failed.body).toBe(500);
    } finally {
      await database.$executeRawUnsafe(
        `DROP TRIGGER fail_eligibility_audit ON "AuditEntry"`,
      );
      await database.$executeRawUnsafe(
        `DROP FUNCTION fail_eligibility_audit()`,
      );
    }
    expect(await database.eligibilityAssessment.count()).toBe(0);
    expect(await database.eligibilityEvidence.count()).toBe(0);
    expect(await database.operationRecord.count({ where: { key } })).toBe(0);
    const retried = await assess(coordinator.cookie, key);
    expect(retried.statusCode, retried.body).toBe(201);
    expect(await database.eligibilityEvidence.count()).toBe(1);
  });
});
