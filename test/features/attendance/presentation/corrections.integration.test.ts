import { describe, expect, it } from 'vitest';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
import {
  createPeriodicActivity,
  createParticipant,
} from '../../../support/projects-fixture.js';
import {
  confirmCall,
  previewCall,
  markingFor,
  enrollPerson,
} from '../../../support/attendance-fixture.js';

describe('Attendance corrections and cancellation', () => {
  const fixture = setupIntegrationFixture();
  it('adds a first marking with historical context, detects stale revision and preserves cancelled history', async () => {
    const operator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const { activity } = await createPeriodicActivity(fixture, operator.cookie);
    const { person } = await createParticipant(fixture, operator.cookie);
    await enrollPerson(fixture, operator.cookie, activity.id, person.id);
    const call = await confirmCall(
      fixture,
      operator.cookie,
      activity.id,
      operator.user.id,
      '2026-01-05T13:00:00Z',
    );
    expect(call.attendances).toEqual([]);
    const app = fixture.runtime.app;
    const context = await previewCall(
      fixture,
      operator.cookie,
      activity.id,
      call.session.occurredAt,
      [],
      call.session.id,
    );
    const payload = {
      expectedSessionRevision: 1,
      expectedRosterFingerprint: context.rosterFingerprint,
      reason: 'Synthetic first marking',
      entries: [
        { ...markingFor(context.rows[0]!, 'PRESENT'), expectedRevision: null },
      ],
    };
    const first = await app.inject({
      method: 'PUT',
      url: `/api/v1/sessions/${call.session.id}/attendance`,
      headers: fixture.headers(operator.cookie),
      payload,
    });
    expect(first.statusCode, first.body).toBe(200);
    expect(first.json().data.session.revision).toBe(2);
    const stale = await app.inject({
      method: 'PUT',
      url: `/api/v1/sessions/${call.session.id}/attendance`,
      headers: fixture.headers(operator.cookie),
      payload,
    });
    expect(stale.statusCode, stale.body).toBe(409);
    const refreshed = await previewCall(
      fixture,
      operator.cookie,
      activity.id,
      call.session.occurredAt,
      [],
      call.session.id,
    );
    const marking = first.json().data.attendances[0];
    const corrected = await app.inject({
      method: 'PUT',
      url: `/api/v1/sessions/${call.session.id}/attendance`,
      headers: fixture.headers(operator.cookie),
      payload: {
        expectedSessionRevision: 2,
        expectedRosterFingerprint: refreshed.rosterFingerprint,
        reason: 'Synthetic status correction',
        entries: [
          {
            personId: person.id,
            expectedRevision: marking.revision,
            status: 'ABSENT',
          },
        ],
      },
    });
    expect(corrected.statusCode, corrected.body).toBe(200);
    expect(corrected.json().data.attendances[0]).toMatchObject({
      id: marking.id,
      status: 'ABSENT',
      revision: 2,
      membershipId: marking.membershipId,
    });
    const cancellationHeaders = fixture.headers(operator.cookie);
    const cancellationPayload = {
      expectedSessionRevision: 3,
      reason: 'Synthetic cancellation',
    };
    const cancelled = await app.inject({
      method: 'POST',
      url: `/api/v1/sessions/${call.session.id}/cancellation`,
      headers: cancellationHeaders,
      payload: cancellationPayload,
    });
    expect(cancelled.statusCode, cancelled.body).toBe(200);
    expect(cancelled.json().data).toMatchObject({
      session: { status: 'CANCELED', revision: 4 },
      attendances: [{ id: marking.id, status: 'ABSENT' }],
    });
    const replay = await app.inject({
      method: 'POST',
      url: `/api/v1/sessions/${call.session.id}/cancellation`,
      headers: cancellationHeaders,
      payload: cancellationPayload,
    });
    expect(replay.json()).toEqual(cancelled.json());
    const frequency = await app.inject({
      method: 'GET',
      url: `/api/v1/people/${person.id}/frequency?activityId=${activity.id}&from=2026-01-01T03:00:00Z&toExclusive=2026-02-01T03:00:00Z`,
      headers: fixture.headers(operator.cookie),
    });
    expect(frequency.json().data).toMatchObject({
      sessionCount: 0,
      presenceCount: 0,
      absenceCount: 0,
      attendanceRate: null,
    });
    const repeated = await app.inject({
      method: 'POST',
      url: `/api/v1/sessions/${call.session.id}/cancellation`,
      headers: fixture.headers(operator.cookie),
      payload: {
        expectedSessionRevision: 4,
        reason: 'Synthetic duplicate cancellation',
      },
    });
    expect(repeated.statusCode, repeated.body).toBe(422);
  });
});
