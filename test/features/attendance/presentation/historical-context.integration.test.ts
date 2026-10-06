import { describe, expect, it } from 'vitest';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
import {
  createPeriodicActivity,
  createParticipant,
} from '../../../support/projects-fixture.js';
import {
  confirmCall,
  previewCall,
  markingContextFor,
} from '../../../support/attendance-fixture.js';

describe('Historical attendance context', () => {
  const fixture = setupIntegrationFixture();
  it('preserves old family after transfer and requires an explicit plan when moving a session across that boundary', async () => {
    const operator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const { activity } = await createPeriodicActivity(fixture, operator.cookie);
    const participant = await createParticipant(fixture, operator.cookie);
    const { person, family, membership } = participant;
    const call = await confirmCall(
      fixture,
      operator.cookie,
      activity.id,
      operator.user.id,
      '2026-01-05T13:00:00Z',
      [{ personId: person.id, status: 'PRESENT' }],
    );
    const app = fixture.runtime.app;
    const targetResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: fixture.headers(operator.cookie),
      payload: {},
    });
    const target = targetResponse.json().data;
    const transfer = await app.inject({
      method: 'POST',
      url: `/api/v1/people/${person.id}/membership-transfers`,
      headers: fixture.headers(operator.cookie),
      payload: {
        membershipId: membership.id,
        expectedMembershipRevision: membership.revision,
        expectedSourceFamilyRevision: family.revision,
        expectedTargetFamilyRevision: target.revision,
        targetFamilyId: target.id,
        effectiveAt: '2026-01-10T03:00:00Z',
        isReference: false,
        relationshipToReference: null,
        reason: 'Synthetic real transfer',
      },
    });
    expect(transfer.statusCode, transfer.body).toBe(200);
    const old = await app.inject({
      method: 'GET',
      url: `/api/v1/sessions/${call.session.id}`,
      headers: fixture.headers(operator.cookie),
    });
    expect(old.json().data.attendances[0]).toMatchObject({
      familyId: family.id,
      membershipId: membership.id,
      membershipRevision: 1,
    });
    const at = '2026-01-15T13:00:00Z';
    const preview = await previewCall(
      fixture,
      operator.cookie,
      activity.id,
      at,
      [],
      call.session.id,
    );
    expect(preview.rows[0]?.familyId).toBe(target.id);
    const unsafe = await app.inject({
      method: 'PATCH',
      url: `/api/v1/sessions/${call.session.id}`,
      headers: fixture.headers(operator.cookie),
      payload: {
        expectedSessionRevision: 1,
        occurredAt: at,
        reason: 'Synthetic date correction',
      },
    });
    expect(unsafe.statusCode, unsafe.body).toBe(409);
    const context = markingContextFor(preview.rows[0]!);
    const corrected = await app.inject({
      method: 'PATCH',
      url: `/api/v1/sessions/${call.session.id}`,
      headers: fixture.headers(operator.cookie),
      payload: {
        expectedSessionRevision: 1,
        occurredAt: at,
        expectedRosterFingerprint: preview.rosterFingerprint,
        contextCorrections: [{ ...context, expectedRevision: 1 }],
        reason: 'Synthetic reconciled date',
      },
    });
    expect(corrected.statusCode, corrected.body).toBe(200);
    expect(corrected.json().data).toMatchObject({
      session: { occurredAt: '2026-01-15T13:00:00.000Z', revision: 2 },
      attendances: [
        {
          familyId: target.id,
          membershipId: transfer.json().data.membership.id,
          status: 'PRESENT',
          revision: 2,
        },
      ],
    });
    const invalidContext = await app.inject({
      method: 'POST',
      url: `/api/v1/attendances/${call.attendances[0]!.id}/context-corrections`,
      headers: fixture.headers(operator.cookie),
      payload: {
        expectedSessionRevision: 2,
        expectedRevision: 2,
        expectedPersonRevision: person.revision,
        familyId: family.id,
        expectedFamilyRevision: transfer.json().data.sourceFamily.revision,
        membershipId: membership.id,
        expectedMembershipRevision: 2,
        reason: 'Synthetic invalid old binding',
      },
    });
    expect(invalidContext.statusCode, invalidContext.body).toBe(409);
  });
});
