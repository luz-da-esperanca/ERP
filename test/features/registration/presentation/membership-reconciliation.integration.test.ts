import { describe, expect, it } from 'vitest';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
import {
  createPeriodicActivity,
  createParticipant,
} from '../../../support/projects-fixture.js';
import { confirmCall } from '../../../support/attendance-fixture.js';

describe('Atomic membership and attendance reconciliation', () => {
  const fixture = setupIntegrationFixture();
  it('confirms a reviewed final state and preserves the original attendance status and replay', async () => {
    const operator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const { activity } = await createPeriodicActivity(fixture, operator.cookie);
    const { person, family, membership } = await createParticipant(
      fixture,
      operator.cookie,
    );
    const call = await confirmCall(
      fixture,
      operator.cookie,
      activity.id,
      operator.user.id,
      '2026-01-20T13:00:00Z',
      [{ personId: person.id, status: 'PRESENT' }],
    );
    const app = fixture.runtime.app;
    const target = (
      await app.inject({
        method: 'POST',
        url: '/api/v1/families',
        headers: fixture.headers(operator.cookie),
        payload: {},
      })
    ).json().data;
    const plan = {
      intent: 'CORRECTION',
      expectedPersonRevision: person.revision,
      familyRevisions: [
        { familyId: family.id, expectedRevision: family.revision },
        { familyId: target.id, expectedRevision: target.revision },
      ],
      membershipChanges: [
        {
          membershipId: membership.id,
          expectedRevision: membership.revision,
          validFrom: membership.validFrom,
          validUntil: '2026-01-10T03:00:00Z',
          isReference: false,
          relationshipToReference: null,
        },
        {
          clientRef: 'corrected-binding',
          familyId: target.id,
          validFrom: '2026-01-10T03:00:00Z',
          validUntil: null,
          isReference: false,
          relationshipToReference: null,
        },
      ],
      attendanceContextChanges: [
        {
          attendanceId: call.attendances[0]!.id,
          expectedRevision: 1,
          sessionId: call.session.id,
          expectedSessionRevision: 1,
          membership: { clientRef: 'corrected-binding' },
          reason: 'Synthetic mistaken family context',
        },
      ],
      reason: 'Synthetic composed correction',
    };
    const incompletePlan = { ...plan, attendanceContextChanges: [] };
    const incompletePreview = await app.inject({
      method: 'POST',
      url: `/api/v1/people/${person.id}/membership-reconciliations/preview`,
      headers: fixture.headers(operator.cookie),
      payload: incompletePlan,
    });
    expect(incompletePreview.statusCode, incompletePreview.body).toBe(200);
    expect(incompletePreview.json().data.conflicts).toEqual([
      call.attendances[0]!.id,
    ]);
    const rejected = await app.inject({
      method: 'POST',
      url: `/api/v1/people/${person.id}/membership-reconciliations`,
      headers: fixture.headers(operator.cookie),
      payload: {
        ...incompletePlan,
        expectedSourceFingerprint:
          incompletePreview.json().data.sourceFingerprint,
      },
    });
    expect(rejected.statusCode, rejected.body).toBe(409);
    expect(rejected.json().error.details.rule).toBe(
      'MEMBERSHIP_ATTENDANCE_CONFLICT',
    );
    expect(
      await fixture.runtime.database.familyMembership.findUniqueOrThrow({
        where: { id: membership.id },
      }),
    ).toMatchObject({ validUntil: null, revision: 1 });
    const socialOperator = await fixture.operator('synthetic.social', [
      'SOCIAL_ASSISTANCE',
    ]);
    const denied = await app.inject({
      method: 'POST',
      url: `/api/v1/people/${person.id}/membership-reconciliations/preview`,
      headers: fixture.headers(socialOperator.cookie),
      payload: plan,
    });
    expect(denied.statusCode, denied.body).toBe(403);
    const preview = await app.inject({
      method: 'POST',
      url: `/api/v1/people/${person.id}/membership-reconciliations/preview`,
      headers: fixture.headers(operator.cookie),
      payload: plan,
    });
    expect(preview.statusCode, preview.body).toBe(200);
    expect(preview.json().data.conflicts).toEqual([]);
    const payload = {
      ...plan,
      expectedSourceFingerprint: preview.json().data.sourceFingerprint,
    };
    const headers = fixture.headers(operator.cookie);
    const confirmed = await app.inject({
      method: 'POST',
      url: `/api/v1/people/${person.id}/membership-reconciliations`,
      headers,
      payload,
    });
    expect(confirmed.statusCode, confirmed.body).toBe(200);
    expect(confirmed.json().data.attendances[0]).toMatchObject({
      id: call.attendances[0]!.id,
      familyId: target.id,
      status: 'PRESENT',
      revision: 2,
    });
    const replay = await app.inject({
      method: 'POST',
      url: `/api/v1/people/${person.id}/membership-reconciliations`,
      headers,
      payload,
    });
    expect(replay.json()).toEqual(confirmed.json());
    const originalAudit = await app.inject({
      method: 'GET',
      url: `/api/v1/audit-entries?entityType=Attendance&entityId=${call.attendances[0]!.id}`,
      headers: fixture.headers(operator.cookie),
    });
    expect(originalAudit.json().data).toHaveLength(2);
    expect(originalAudit.json().data[0]).toMatchObject({
      before: { familyId: family.id },
      after: { familyId: target.id, status: 'PRESENT' },
      reason: 'Synthetic mistaken family context',
    });
  });
});
