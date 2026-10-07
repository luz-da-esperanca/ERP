import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
import { createPeriodicActivity } from '../../../support/projects-fixture.js';
import {
  confirmCall,
  enrollPerson,
} from '../../../support/attendance-fixture.js';
import {
  mergePreviewSchema,
  mergeResultSchema,
} from '@erp/contracts/identity-merge-api';
import type { MergePreviewDto } from '@erp/contracts/identity-merge-api';
import { personRegistrationSchema } from '@erp/contracts/registration-api';
import { auditPageSchema } from '@erp/contracts/audit-api';
import {
  configureSocialFields,
  createSocialFamily,
  previewSocialForm,
  socialPublicationInput,
} from '../../../support/social-forms-fixture.js';

type Fixture = ReturnType<typeof setupIntegrationFixture>;
const jan = '2026-01-01T03:00:00.000Z';
const day = (month: number, date = 1) =>
  `2026-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}T03:00:00.000Z`;

function api(fixture: Fixture, cookie: string) {
  const send = (
    method: 'GET' | 'POST' | 'PATCH' | 'PUT',
    url: string,
    payload?: object,
    key = randomUUID(),
  ) =>
    fixture.runtime.app.inject({
      method,
      url: `/api/v1${url}`,
      headers: fixture.headers(cookie, key),
      ...(payload ? { payload } : {}),
    });
  async function family(fields: object = {}) {
    const response = await send('POST', '/families', fields);
    expect(response.statusCode, response.body).toBe(201);
    return response.json().data as {
      id: string;
      code: string;
      revision: number;
    };
  }
  async function person(
    name: string,
    familyId: string,
    fields: object = {},
    validFrom = jan,
  ) {
    const current = await send('GET', `/families/${familyId}`);
    const response = await send('POST', '/people', {
      name,
      familyId,
      expectedFamilyRevision: current.json().data.family.revision,
      validFrom,
      ...fields,
    });
    expect(response.statusCode, response.body).toBe(201);
    return personRegistrationSchema.parse(response.json().data);
  }
  async function preview(
    entityType: 'PERSON' | 'FAMILY',
    sourceId: string,
    targetId: string,
  ) {
    const response = await send('POST', '/identity-merges/preview', {
      entityType,
      sourceId,
      targetId,
    });
    expect(response.statusCode, response.body).toBe(200);
    return mergePreviewSchema.parse(response.json().data);
  }
  const command = (view: MergePreviewDto, changes: object = {}) => ({
    entityType: view.entityType,
    sourceId: view.sourceId,
    targetId: view.targetId,
    expectedSourceRevision: view.expectedSourceRevision,
    expectedTargetRevision: view.expectedTargetRevision,
    expectedSourceFingerprint: view.sourceFingerprint,
    fieldSelections: Object.fromEntries(
      view.fieldConflicts.map((row) => [row.field, 'TARGET']),
    ),
    reason: 'Synthetic duplicate registration',
    ...changes,
  });
  const merge = (
    view: MergePreviewDto,
    changes: object = {},
    key?: ReturnType<typeof randomUUID>,
  ) => send('POST', '/identity-merges', command(view, changes), key);
  const frequency = async (
    personId: string,
    activityId: string,
    familyId?: string,
  ) =>
    (
      await send(
        'GET',
        `/people/${personId}/frequency?activityId=${activityId}&from=${jan}&toExclusive=${day(7)}${familyId ? `&familyId=${familyId}` : ''}`,
      )
    ).json().data;
  return { send, family, person, preview, merge, frequency };
}

describe('Person identity merge', () => {
  const fixture = setupIntegrationFixture();
  const coordinator = () =>
    fixture.operator('synthetic.coordinator', ['COORDINATION']);

  it('adopts a source CPF while preserving a single canonical identity under the unique index', async () => {
    const operator = await coordinator();
    const http = api(fixture, operator.cookie);
    const family = await http.family();
    const source = await http.person('Synthetic source', family.id, {
      cpf: '12345678909',
    });
    const target = await http.person('Synthetic target', family.id);
    const response = await http.merge(
      await http.preview('PERSON', source.person.id, target.person.id),
    );
    expect(response.statusCode, response.body).toBe(201);
    expect(response.json().data.target).toMatchObject({ cpf: '12345678909' });
    expect(
      await fixture.runtime.database.person.count({
        where: { cpf: '12345678909', mergedIntoId: null },
      }),
    ).toBe(1);
  });

  it('completes adopted fields, retires source occurrences and keeps only canonical missing data after a merge', async () => {
    const operator = await coordinator();
    const http = api(fixture, operator.cookie);
    expect(
      (
        await http.send('POST', '/registration-field-selections', {
          expectedVersion: null,
          personFields: ['cpf', 'contactPhone'],
          familyFields: [],
          decisionReference: 'Synthetic demo selection',
        })
      ).statusCode,
    ).toBe(201);
    const family = await http.family();
    const source = await http.person('Synthetic Source', family.id, {
      cpf: '11144477735',
    });
    const target = await http.person('Synthetic Target', family.id);
    const view = await http.preview(
      'PERSON',
      source.person.id,
      target.person.id,
    );
    const key = randomUUID();
    const changes = {
      membershipResolutions: [
        {
          id: source.membership.id,
          action: 'SUPERSEDE',
          supersededById: target.membership.id,
        },
      ],
    };
    const result = await http.merge(view, changes, key);
    expect(result.statusCode, result.body).toBe(201);
    const issues = (
      await http.send('GET', '/data-quality-issues?kind=MISSING_DATA')
    ).json().data;
    expect(issues).toHaveLength(3);
    expect(
      issues.filter(
        (row: { resolvedAt: string | null }) => row.resolvedAt === null,
      ),
    ).toEqual([
      expect.objectContaining({
        entityId: target.person.id,
        fieldKeys: ['contactPhone'],
      }),
    ]);
    expect(issues).toContainEqual(
      expect.objectContaining({
        entityId: source.person.id,
        resolution: 'MERGED',
        reason: 'Synthetic duplicate registration',
      }),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        entityId: target.person.id,
        fieldKeys: ['cpf'],
        resolution: 'COMPLETED',
      }),
    );
    expect((await http.merge(view, changes, key)).json().data).toEqual(
      result.json().data,
    );
    expect(
      (
        await http.send('POST', '/registration-field-selections', {
          expectedVersion: 1,
          personFields: ['cpf', 'contactPhone'],
          familyFields: [],
          decisionReference: 'Synthetic canonical reconciliation',
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (await http.send('GET', '/data-quality-issues?kind=MISSING_DATA')).json()
        .pagination.total,
    ).toBe(3);
  });

  it('unites histories without conflicts, keeps the factual family and replays without duplicating', async () => {
    const operator = await coordinator();
    const http = api(fixture, operator.cookie);
    const { activity } = await createPeriodicActivity(fixture, operator.cookie);
    const first = await http.family();
    const second = await http.family();
    const source = await http.person('Alpha Uno', first.id, {
      cpf: '11144477735',
    });
    const closed = await http.send(
      'POST',
      `/memberships/${source.membership.id}/closure`,
      {
        expectedRevision: 1,
        expectedFamilyRevision: source.family.revision,
        validUntil: day(2),
        reason: 'Synthetic closure',
      },
    );
    expect(closed.statusCode, closed.body).toBe(200);
    const target = await http.person('Beta Dois', second.id, {}, day(2));
    await enrollPerson(fixture, operator.cookie, activity.id, source.person.id);
    await confirmCall(
      fixture,
      operator.cookie,
      activity.id,
      operator.user.id,
      '2026-01-05T13:00:00Z',
      [{ personId: source.person.id, status: 'PRESENT' }],
    );
    await confirmCall(
      fixture,
      operator.cookie,
      activity.id,
      operator.user.id,
      '2026-02-10T13:00:00Z',
      [{ personId: target.person.id, status: 'PRESENT' }],
    );
    // Renaming the target after the source creates an open duplicate issue.
    const renamed = await http.send('PATCH', `/people/${target.person.id}`, {
      expectedRevision: 1,
      name: 'Alpha Uno',
    });
    expect(renamed.statusCode, renamed.body).toBe(200);

    const view = await http.preview(
      'PERSON',
      source.person.id,
      target.person.id,
    );
    expect(view).toMatchObject({
      fieldConflicts: [],
      adoptedFields: ['cpf'],
      membershipConflicts: [],
      attendanceConflicts: [],
      enrollmentConflicts: [],
      sizeProfileConflict: null,
    });
    expect(view.issueIds).toHaveLength(1);
    const database = fixture.runtime.database;
    expect(await database.identityMerge.count()).toBe(0);

    const key = randomUUID();
    const confirmed = await http.merge(view, {}, key);
    expect(confirmed.statusCode, confirmed.body).toBe(201);
    const result = mergeResultSchema.parse(confirmed.json().data);
    expect(result).toMatchObject({
      merge: {
        entityType: 'PERSON',
        sourceId: source.person.id,
        targetId: target.person.id,
        recordedBy: operator.user.id,
        reason: 'Synthetic duplicate registration',
        resolution: { adoptedFields: ['cpf'], resolvedIssueIds: view.issueIds },
      },
      target: { id: target.person.id, cpf: '11144477735', revision: 3 },
    });
    const replay = await http.merge(view, {}, key);
    expect(replay.statusCode, replay.body).toBe(201);
    expect(replay.json().data).toEqual(confirmed.json().data);
    expect(await database.identityMerge.count()).toBe(1);

    const alias = await http.send('GET', `/people/${source.person.id}`);
    expect(alias.statusCode, alias.body).toBe(200);
    expect(alias.json().data.person.id).toBe(target.person.id);
    expect(
      alias
        .json()
        .data.memberships.map((row: { familyId: string }) => row.familyId),
    ).toEqual([first.id, second.id]);
    const listed = await http.send('GET', '/people?q=Alpha');
    expect(listed.json().data.map((row: { id: string }) => row.id)).toEqual([
      target.person.id,
    ]);
    expect(await http.frequency(target.person.id, activity.id)).toMatchObject({
      sessionCount: 2,
      presenceCount: 2,
    });
    expect(
      await http.frequency(target.person.id, activity.id, first.id),
    ).toMatchObject({ sessionCount: 1, presenceCount: 1 });

    const issues = await http.send(
      'GET',
      '/data-quality-issues?status=RESOLVED&kind=POSSIBLE_DUPLICATE',
    );
    expect(issues.json().data).toEqual([
      expect.objectContaining({
        id: view.issueIds[0],
        resolution: 'MERGED',
        resolvedBy: operator.user.id,
      }),
    ]);
    const history = auditPageSchema.parse(
      (
        await http.send(
          'GET',
          `/audit-entries?entityType=IdentityMerge&entityId=${result.merge.id}`,
        )
      ).json(),
    );
    expect(history.data).toHaveLength(1);
    expect(history.data[0]).toMatchObject({
      action: 'MERGE',
      actorId: operator.user.id,
      reason: 'Synthetic duplicate registration',
    });
    const again = await http.send('POST', '/identity-merges/preview', {
      entityType: 'PERSON',
      sourceId: source.person.id,
      targetId: target.person.id,
    });
    expect(again.statusCode, again.body).toBe(404);
    const write = await http.send('PATCH', `/people/${source.person.id}`, {
      expectedRevision: 1,
      name: 'Gamma Tres',
    });
    expect(write.statusCode, write.body).toBe(404);
  });

  it('requires an explicit choice between divergent markings of one session and keeps both records', async () => {
    const operator = await coordinator();
    const http = api(fixture, operator.cookie);
    const { activity } = await createPeriodicActivity(fixture, operator.cookie);
    const family = await http.family();
    const source = await http.person('Alpha Uno', family.id);
    const target = await http.person('Beta Dois', family.id);
    const call = await confirmCall(
      fixture,
      operator.cookie,
      activity.id,
      operator.user.id,
      '2026-01-05T13:00:00Z',
      [
        { personId: source.person.id, status: 'PRESENT' },
        { personId: target.person.id, status: 'ABSENT' },
      ],
    );
    const present = call.attendances.find(
      (row) => row.personId === source.person.id,
    )!;
    const absent = call.attendances.find(
      (row) => row.personId === target.person.id,
    )!;
    const view = await http.preview(
      'PERSON',
      source.person.id,
      target.person.id,
    );
    expect(view.attendanceConflicts).toEqual([
      {
        sessionId: call.session.id,
        attendanceIds: [present.id, absent.id].sort(),
        statusesDiffer: true,
      },
    ]);
    expect(view.membershipConflicts).toEqual([
      {
        ids: [source.membership.id, target.membership.id].sort(),
        sameGroup: true,
      },
    ]);
    expect(view.fieldConflicts.map((row) => row.field)).toEqual(['name']);
    const supersede = [
      {
        id: source.membership.id,
        action: 'SUPERSEDE',
        supersededById: target.membership.id,
      },
    ];
    const unresolved = await http.merge(view, {
      membershipResolutions: supersede,
    });
    expect(unresolved.statusCode, unresolved.body).toBe(409);
    expect(unresolved.json().error.details.rule).toBe(
      'MERGE_RESOLUTION_REQUIRED',
    );
    const withoutReason = await http.merge(view, {
      membershipResolutions: supersede,
      attendanceResolutions: [
        { sessionId: call.session.id, effectiveAttendanceId: present.id },
      ],
    });
    expect(withoutReason.statusCode, withoutReason.body).toBe(409);
    const database = fixture.runtime.database;
    expect(await database.identityMerge.count()).toBe(0);

    const confirmed = await http.merge(view, {
      membershipResolutions: supersede,
      attendanceResolutions: [
        {
          sessionId: call.session.id,
          effectiveAttendanceId: present.id,
          reason: 'Synthetic paper list confirms presence',
        },
      ],
    });
    expect(confirmed.statusCode, confirmed.body).toBe(201);
    expect(
      mergeResultSchema.parse(confirmed.json().data).merge.resolution,
    ).toMatchObject({
      supersededAttendances: [{ id: absent.id, supersededById: present.id }],
      supersededMemberships: [
        { id: source.membership.id, supersededById: target.membership.id },
      ],
    });
    expect(await http.frequency(target.person.id, activity.id)).toMatchObject({
      sessionCount: 1,
      presenceCount: 1,
      absenceCount: 0,
    });
    const stored = await database.attendance.findMany({
      where: { sessionId: call.session.id },
      orderBy: { id: 'asc' },
    });
    expect(stored).toHaveLength(2);
    expect(stored.find((row) => row.id === absent.id)).toMatchObject({
      status: 'ABSENT',
      personId: target.person.id,
      supersededById: present.id,
    });
    expect(stored.find((row) => row.id === present.id)).toMatchObject({
      status: 'PRESENT',
      personId: target.person.id,
      membershipId: target.membership.id,
      supersededById: null,
    });
    const composition = await http.send('GET', `/families/${family.id}`);
    expect(composition.json().data.family.memberCount).toBe(1);
    const session = await http.send('GET', `/sessions/${call.session.id}`);
    expect(session.json().data.session.revision).toBe(2);
    expect(session.json().data.attendances).toHaveLength(1);
  });

  it('keeps exclusive stretches of partially overlapping memberships and rejects later overlaps for the canonical person', async () => {
    const operator = await coordinator();
    const http = api(fixture, operator.cookie);
    const { activity } = await createPeriodicActivity(fixture, operator.cookie);
    const family = await http.family();
    const other = await http.family();
    const source = await http.person('Alpha Uno', family.id);
    const closed = await http.send(
      'POST',
      `/memberships/${source.membership.id}/closure`,
      {
        expectedRevision: 1,
        expectedFamilyRevision: source.family.revision,
        validUntil: day(4),
        reason: 'Synthetic closure',
      },
    );
    expect(closed.statusCode, closed.body).toBe(200);
    const target = await http.person('Beta Dois', family.id, {}, day(3));
    await confirmCall(
      fixture,
      operator.cookie,
      activity.id,
      operator.user.id,
      '2026-01-05T13:00:00Z',
      [{ personId: source.person.id, status: 'PRESENT' }],
    );
    const view = await http.preview(
      'PERSON',
      source.person.id,
      target.person.id,
    );
    expect(view.membershipConflicts).toHaveLength(1);
    const supersede = {
      id: source.membership.id,
      action: 'SUPERSEDE',
      supersededById: target.membership.id,
    };
    const lossy = await http.merge(view, {
      membershipResolutions: [supersede],
    });
    expect(lossy.statusCode, lossy.body).toBe(422);
    expect(lossy.json().error.details.rule).toBe('MERGE_RESOLUTION_INVALID');
    const confirmed = await http.merge(view, {
      membershipResolutions: [
        supersede,
        {
          id: target.membership.id,
          action: 'KEEP',
          validFrom: jan,
          validUntil: null,
        },
      ],
    });
    expect(confirmed.statusCode, confirmed.body).toBe(201);
    const detail = await http.send('GET', `/people/${target.person.id}`);
    expect(detail.json().data.memberships).toEqual([
      expect.objectContaining({
        id: target.membership.id,
        familyId: family.id,
        validFrom: jan,
        validUntil: null,
      }),
    ]);
    expect(
      await http.frequency(target.person.id, activity.id, family.id),
    ).toMatchObject({ sessionCount: 1, presenceCount: 1 });
    // The canonical person still cannot belong to two families at the same instant.
    const current = await http.send('GET', `/families/${other.id}`);
    const duplicate = await fixture.runtime.database.familyMembership
      .create({
        data: {
          personId: target.person.id,
          familyId: other.id,
          validFrom: new Date(day(5)),
        },
      })
      .then(
        () => 'created',
        () => 'rejected',
      );
    expect(current.statusCode).toBe(200);
    expect(duplicate).toBe('rejected');
  });

  it('requires choosing between two size profiles and keeps both histories', async () => {
    const operator = await coordinator();
    const http = api(fixture, operator.cookie);
    const first = await http.family();
    const second = await http.family();
    const source = await http.person('Alpha Uno', first.id);
    const closed = await http.send(
      'POST',
      `/memberships/${source.membership.id}/closure`,
      {
        expectedRevision: 1,
        expectedFamilyRevision: source.family.revision,
        validUntil: day(2),
        reason: 'Synthetic closure',
      },
    );
    expect(closed.statusCode, closed.body).toBe(200);
    const target = await http.person('Beta Dois', second.id, {}, day(2));
    for (const [personId, shoeSize] of [
      [source.person.id, '36'],
      [target.person.id, '38'],
    ] as const) {
      const saved = await http.send('PUT', `/people/${personId}/sizes`, {
        expectedRevision: null,
        shoeSize,
        clothingSize: null,
        informedOn: '2026-01-10',
      });
      expect(saved.statusCode, saved.body).toBe(200);
    }
    const view = await http.preview(
      'PERSON',
      source.person.id,
      target.person.id,
    );
    expect(view.sizeProfileConflict).toMatchObject({
      source: { shoeSize: '36' },
      target: { shoeSize: '38' },
    });
    const unresolved = await http.merge(view);
    expect(unresolved.statusCode, unresolved.body).toBe(409);
    const confirmed = await http.merge(view, {
      sizeProfileResolution: { keep: 'SOURCE' },
    });
    expect(confirmed.statusCode, confirmed.body).toBe(201);
    const detail = await http.send('GET', `/people/${target.person.id}`);
    expect(detail.json().data.sizeProfile).toMatchObject({
      personId: target.person.id,
      shoeSize: '36',
      revision: 2,
    });
    const profiles = await fixture.runtime.database.sizeProfile.findMany({
      orderBy: { shoeSize: 'asc' },
    });
    expect(profiles.map((row) => [row.personId, row.shoeSize])).toEqual([
      [source.person.id, '36'],
      [target.person.id, '36'],
    ]);
    const history = auditPageSchema.parse(
      (
        await http.send(
          'GET',
          `/audit-entries?entityType=SizeProfile&entityId=${target.person.id}`,
        )
      ).json(),
    );
    expect(history.data.map((row) => [row.action, row.revision])).toEqual([
      ['MERGE', 2],
      ['CREATE', 1],
    ]);
  });

  it('rolls back the mapping, every change and the operation when audit fails, then accepts the same key', async () => {
    const operator = await coordinator();
    const http = api(fixture, operator.cookie);
    const family = await http.family();
    const source = await http.person('Alpha Uno', family.id);
    const target = await http.person('Beta Dois', family.id);
    const view = await http.preview(
      'PERSON',
      source.person.id,
      target.person.id,
    );
    const plan = {
      membershipResolutions: [
        {
          id: source.membership.id,
          action: 'SUPERSEDE',
          supersededById: target.membership.id,
        },
      ],
    };
    const database = fixture.runtime.database;
    await database.$executeRawUnsafe(
      `CREATE FUNCTION fail_merge_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."entityType" = 'IdentityMerge' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$`,
    );
    await database.$executeRawUnsafe(
      `CREATE TRIGGER fail_merge_audit BEFORE INSERT ON "AuditEntry" FOR EACH ROW EXECUTE FUNCTION fail_merge_audit()`,
    );
    const key = randomUUID();
    try {
      const failed = await http.merge(view, plan, key);
      expect(failed.statusCode, failed.body).toBe(500);
    } finally {
      await database.$executeRawUnsafe(
        `DROP TRIGGER fail_merge_audit ON "AuditEntry"`,
      );
      await database.$executeRawUnsafe(`DROP FUNCTION fail_merge_audit()`);
    }
    expect(await database.identityMerge.count()).toBe(0);
    expect(await database.operationRecord.count({ where: { key } })).toBe(0);
    expect(
      await database.person.findUniqueOrThrow({
        where: { id: source.person.id },
      }),
    ).toMatchObject({ mergedIntoId: null, revision: 1 });
    expect(
      await database.familyMembership.findUniqueOrThrow({
        where: { id: source.membership.id },
      }),
    ).toMatchObject({ supersededById: null, revision: 1 });
    const retried = await http.merge(view, plan, key);
    expect(retried.statusCode, retried.body).toBe(201);
  });

  it('supersedes duplicated enrollments and never counts one presence twice in eligibility, keeping saved assessments', async () => {
    const operator = await coordinator();
    const http = api(fixture, operator.cookie);
    const { activity } = await createPeriodicActivity(fixture, operator.cookie);
    const family = await http.family();
    const source = await http.person('Alpha Uno', family.id);
    const target = await http.person('Beta Dois', family.id);
    const sourceEnrollment = await enrollPerson(
      fixture,
      operator.cookie,
      activity.id,
      source.person.id,
    );
    const targetEnrollment = await enrollPerson(
      fixture,
      operator.cookie,
      activity.id,
      target.person.id,
    );
    const call = await confirmCall(
      fixture,
      operator.cookie,
      activity.id,
      operator.user.id,
      '2026-01-05T13:00:00Z',
      [
        { personId: source.person.id, status: 'PRESENT' },
        { personId: target.person.id, status: 'PRESENT' },
      ],
    );
    const policy = await http.send('POST', '/eligibility-policies', {
      definition: {
        schemaVersion: 1,
        period: {
          type: 'FIXED_PERIOD',
          start: '2026-01-01',
          endExclusive: '2026-02-01',
        },
        minimum: { type: 'PRESENCE_COUNT', value: 2 },
        activityIds: [activity.id],
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
    const saved = await http.send(
      'POST',
      `/families/${family.id}/eligibility-assessments`,
      { referenceDate: '2026-01-31' },
    );
    expect(saved.statusCode, saved.body).toBe(201);
    expect(saved.json().data.evidences).toHaveLength(2);

    const view = await http.preview(
      'PERSON',
      source.person.id,
      target.person.id,
    );
    expect(view.enrollmentConflicts).toEqual([
      {
        ids: [sourceEnrollment.id, targetEnrollment.id].sort(),
        sameGroup: true,
      },
    ]);
    expect(view.attendanceConflicts).toMatchObject([{ statusesDiffer: false }]);
    expect(view.preserved.eligibilityAssessments).toBe(1);
    const kept = call.attendances.find(
      (row) => row.personId === target.person.id,
    )!;
    const confirmed = await http.merge(view, {
      membershipResolutions: [
        {
          id: source.membership.id,
          action: 'SUPERSEDE',
          supersededById: target.membership.id,
        },
      ],
      enrollmentResolutions: [
        {
          id: sourceEnrollment.id,
          action: 'SUPERSEDE',
          supersededById: targetEnrollment.id,
        },
      ],
      attendanceResolutions: [
        { sessionId: call.session.id, effectiveAttendanceId: kept.id },
      ],
    });
    expect(confirmed.statusCode, confirmed.body).toBe(201);
    const enrollments = await http.send(
      'GET',
      `/activities/${activity.id}/enrollments`,
    );
    expect(
      enrollments
        .json()
        .data.map((row: { personId?: string; person?: { id: string } }) =>
          row.person ? row.person.id : row.personId,
        ),
    ).toEqual([target.person.id]);
    const after = await http.send(
      'GET',
      `/families/${family.id}/eligibility-preview?referenceDate=2026-01-31`,
    );
    expect(after.json().data).toMatchObject({
      status: 'PENDING',
      evidences: [
        { personId: target.person.id, sessionCount: 1, presenceCount: 1 },
      ],
    });
    expect(after.json().data.evidences).toHaveLength(1);
    const original = await http.send(
      'GET',
      `/eligibility-assessments/${saved.json().data.id}`,
    );
    expect(original.json().data).toEqual(saved.json().data);
  });

  it('denies preview and confirmation to profiles without the merge capability', async () => {
    const operator = await coordinator();
    const http = api(fixture, operator.cookie);
    const family = await http.family();
    const source = await http.person('Alpha Uno', family.id);
    const target = await http.person('Beta Dois', family.id);
    const view = await http.preview(
      'PERSON',
      source.person.id,
      target.person.id,
    );
    const manager = await fixture.operator('synthetic.manager', [
      'ACTIVITY_MANAGER',
    ]);
    for (const cookie of [manager.cookie, fixture.adminCookie]) {
      const denied = api(fixture, cookie);
      expect(
        (
          await denied.send('POST', '/identity-merges/preview', {
            entityType: 'PERSON',
            sourceId: source.person.id,
            targetId: target.person.id,
          })
        ).statusCode,
      ).toBe(403);
      expect((await denied.merge(view)).statusCode).toBe(403);
    }
    expect(await fixture.runtime.database.identityMerge.count()).toBe(0);
  });
});

describe('Family identity merge', () => {
  const fixture = setupIntegrationFixture();
  it('moves the composition and facts to the canonical family and turns the source code into a search alias', async () => {
    const operator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const http = api(fixture, operator.cookie);
    const { activity } = await createPeriodicActivity(fixture, operator.cookie);
    const source = await http.family({ referenceName: 'Nucleo Alpha' });
    const target = await http.family({
      referenceName: 'Casa Beta',
      neighborhood: 'Centro',
    });
    const first = await http.person('Alpha Uno', source.id, {
      isReference: true,
    });
    const second = await http.person('Beta Dois', target.id);
    await confirmCall(
      fixture,
      operator.cookie,
      activity.id,
      operator.user.id,
      '2026-01-05T13:00:00Z',
      [{ personId: first.person.id, status: 'PRESENT' }],
    );
    const view = await http.preview('FAMILY', source.id, target.id);
    expect(view).toMatchObject({
      fieldConflicts: [
        { field: 'referenceName', source: 'Nucleo Alpha', target: 'Casa Beta' },
      ],
      referenceConflicts: [],
      membershipConflicts: [],
    });
    const unresolved = await http.merge(view, { fieldSelections: {} });
    expect(unresolved.statusCode, unresolved.body).toBe(409);
    const confirmed = await http.merge(view, {
      fieldSelections: { referenceName: 'SOURCE' },
    });
    expect(confirmed.statusCode, confirmed.body).toBe(201);
    expect(mergeResultSchema.parse(confirmed.json().data).target).toMatchObject(
      { id: target.id, referenceName: 'Nucleo Alpha', neighborhood: 'Centro' },
    );
    const byCode = await http.send('GET', `/families?code=${source.code}`);
    expect(byCode.json().data.map((row: { id: string }) => row.id)).toEqual([
      target.id,
    ]);
    const alias = await http.send('GET', `/families/${source.id}`);
    expect(alias.statusCode, alias.body).toBe(200);
    expect(alias.json().data.family).toMatchObject({
      id: target.id,
      code: target.code,
      memberCount: 2,
      referencePersonName: 'Alpha Uno',
    });
    expect(
      alias
        .json()
        .data.members.map((row: { person: { id: string } }) => row.person.id)
        .sort(),
    ).toEqual([first.person.id, second.person.id].sort());
    expect(
      await http.frequency(first.person.id, activity.id, target.id),
    ).toMatchObject({ sessionCount: 1, presenceCount: 1 });
    const created = await http.send('POST', '/people', {
      name: 'Gamma Tres',
      familyId: source.id,
      expectedFamilyRevision: 1,
      validFrom: jan,
    });
    expect(created.statusCode, created.body).toBe(404);
  });
  it('keeps the social forms of both origins without rewriting them and publishes next in the canonical namespace', async () => {
    const operator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const http = api(fixture, operator.cookie);
    await configureSocialFields(fixture, operator.cookie);
    const { family: source } = await createSocialFamily(
      fixture,
      operator.cookie,
    );
    const target = await http.family();
    await http.person('Beta Dois', target.id);
    const publish = async (familyId: string) => {
      const response = await http.send(
        'POST',
        `/families/${familyId}/social-forms`,
        socialPublicationInput(
          await previewSocialForm(fixture, operator.cookie, familyId),
        ),
      );
      expect(response.statusCode, response.body).toBe(201);
      return response.json().data as { id: string };
    };
    const original = await publish(source.id);
    const database = fixture.runtime.database;
    const before = await database.socialForm.findUniqueOrThrow({
      where: { id: original.id },
      include: { members: true },
    });
    const view = await http.preview('FAMILY', source.id, target.id);
    expect(view.preserved.socialForms).toBe(1);
    expect(view.adoptedFields).toEqual(['address']);
    const confirmed = await http.merge(view);
    expect(confirmed.statusCode, confirmed.body).toBe(201);
    expect(
      await database.socialForm.findUniqueOrThrow({
        where: { id: original.id },
        include: { members: true },
      }),
    ).toEqual(before);
    const next = await publish(target.id);
    const listed = await http.send(
      'GET',
      `/families/${target.id}/social-forms`,
    );
    expect(listed.statusCode, listed.body).toBe(200);
    expect(
      listed
        .json()
        .data.map(
          (row: {
            id: string;
            version: number;
            originFamilyId: string | null;
            originalVersion: number | null;
          }) => [row.id, row.version, row.originFamilyId, row.originalVersion],
        ),
    ).toEqual(
      expect.arrayContaining([
        [next.id, 1, null, null],
        [original.id, 1, source.id, 1],
      ]),
    );
    expect(listed.json().data).toHaveLength(2);
  });
  it('keeps the conflict until two simultaneous references are fixed by reference commands', async () => {
    const operator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const http = api(fixture, operator.cookie);
    const source = await http.family();
    const target = await http.family();
    const first = await http.person('Alpha Uno', source.id, {
      isReference: true,
    });
    const second = await http.person('Beta Dois', target.id, {
      isReference: true,
    });
    const view = await http.preview('FAMILY', source.id, target.id);
    expect(view.referenceConflicts).toEqual([
      {
        membershipIds: [first.membership.id, second.membership.id].sort(),
      },
    ]);
    const refused = await http.merge(view);
    expect(refused.statusCode, refused.body).toBe(409);
    expect(refused.json().error.details.rule).toBe('MERGE_REFERENCE_CONFLICT');
    expect(await fixture.runtime.database.identityMerge.count()).toBe(0);
  });
});
