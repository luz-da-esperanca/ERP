import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
import {
  createPeriodicActivity,
  createParticipant,
} from '../../../support/projects-fixture.js';
import {
  previewCall,
  markingFor,
  confirmCall,
  enrollPerson,
} from '../../../support/attendance-fixture.js';
import { coverageViewSchema } from '@erp/contracts/attendance-api';

describe('Attendance validation and completeness', () => {
  const fixture = setupIntegrationFixture();
  it('rejects stale rosters and invalid factual context before any session is persisted', async () => {
    const operator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const { activity } = await createPeriodicActivity(fixture, operator.cookie);
    const { person } = await createParticipant(fixture, operator.cookie);
    const preview = await previewCall(
      fixture,
      operator.cookie,
      activity.id,
      '2026-01-05T13:00:00Z',
      [person.id],
    );
    const app = fixture.runtime.app;
    const payload = {
      occurredAt: preview.occurredAt,
      responsibleId: operator.user.id,
      expectedActivityRevision: preview.expectedActivityRevision,
      expectedRosterFingerprint: preview.rosterFingerprint,
      entries: [
        { ...markingFor(preview.rows[0]!, 'PRESENT'), familyId: randomUUID() },
      ],
    };
    const invalid = await app.inject({
      method: 'POST',
      url: `/api/v1/activities/${activity.id}/sessions`,
      headers: fixture.headers(operator.cookie),
      payload,
    });
    expect(invalid.statusCode, invalid.body).toBe(409);
    await enrollPerson(fixture, operator.cookie, activity.id, person.id);
    const stale = await app.inject({
      method: 'POST',
      url: `/api/v1/activities/${activity.id}/sessions`,
      headers: fixture.headers(operator.cookie),
      payload: {
        ...payload,
        entries: [markingFor(preview.rows[0]!, 'PRESENT')],
      },
    });
    expect(stale.statusCode, stale.body).toBe(409);
    const sessions = await app.inject({
      method: 'GET',
      url: `/api/v1/activities/${activity.id}/sessions`,
      headers: fixture.headers(operator.cookie),
    });
    expect(sessions.json().pagination.total).toBe(0);
  });
  it('declares an empty closed period without producing attendance or a percentage', async () => {
    const operator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const { activity } = await createPeriodicActivity(fixture, operator.cookie);
    const { person } = await createParticipant(fixture, operator.cookie);
    const app = fixture.runtime.app;
    const before = await app.inject({
      method: 'GET',
      url: `/api/v1/activities/${activity.id}/coverage?periodStart=2026-01-01&periodEndExclusive=2026-01-02`,
      headers: fixture.headers(operator.cookie),
    });
    const view = coverageViewSchema.parse(before.json().data);
    const declaration = await app.inject({
      method: 'POST',
      url: `/api/v1/activities/${activity.id}/coverage-declarations`,
      headers: fixture.headers(operator.cookie),
      payload: {
        periodStart: view.periodStart,
        periodEndExclusive: view.periodEndExclusive,
        expectedActivityRevision: view.expectedActivityRevision,
        expectedSourceFingerprint: view.sourceFingerprint,
        confirmed: true,
        reason: 'Synthetic known recess',
      },
    });
    expect(declaration.statusCode, declaration.body).toBe(201);
    const frequency = await app.inject({
      method: 'GET',
      url: `/api/v1/people/${person.id}/frequency?activityId=${activity.id}&from=2026-01-01T03:00:00Z&toExclusive=2026-01-02T03:00:00Z`,
      headers: fixture.headers(operator.cookie),
    });
    expect(frequency.json().data).toMatchObject({
      sessionCount: 0,
      presenceCount: 0,
      absenceCount: 0,
      unrecordedCount: 0,
      coverageComplete: true,
      attendanceRate: null,
    });
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: fixture.config.APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const tomorrow = new Date(Date.parse(today) + 86400000)
      .toISOString()
      .slice(0, 10);
    const currentDay = await app.inject({
      method: 'POST',
      url: `/api/v1/activities/${activity.id}/coverage-declarations`,
      headers: fixture.headers(operator.cookie),
      payload: {
        periodStart: today,
        periodEndExclusive: tomorrow,
        expectedActivityRevision: view.expectedActivityRevision,
        expectedSourceFingerprint: view.sourceFingerprint,
        confirmed: true,
        reason: 'Synthetic current day',
      },
    });
    expect(currentDay.statusCode, currentDay.body).toBe(422);
  });
  it('allows bounded late facts in closed activities and denies writes to read-only operators', async () => {
    const coordinator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const reader = await fixture.operator('synthetic.reader', [
      'SOCIAL_ASSISTANCE',
    ]);
    const { activity } = await createPeriodicActivity(
      fixture,
      coordinator.cookie,
    );
    const app = fixture.runtime.app;
    const closed = await app.inject({
      method: 'POST',
      url: `/api/v1/activities/${activity.id}/closure`,
      headers: fixture.headers(coordinator.cookie),
      payload: {
        expectedRevision: 1,
        effectiveAt: '2026-02-01T03:00:00Z',
        reason: 'Synthetic closure',
      },
    });
    expect(closed.statusCode, closed.body).toBe(200);
    const late = await confirmCall(
      fixture,
      coordinator.cookie,
      activity.id,
      coordinator.user.id,
      '2026-01-10T13:00:00Z',
    );
    expect(late.session.status).toBe('COMPLETED');
    const boundary = await app.inject({
      method: 'GET',
      url: `/api/v1/activities/${activity.id}/attendance-context?occurredAt=2026-02-01T03:00:00Z`,
      headers: fixture.headers(coordinator.cookie),
    });
    expect(boundary.statusCode, boundary.body).toBe(422);
    const forbidden = await app.inject({
      method: 'POST',
      url: `/api/v1/sessions/${late.session.id}/cancellation`,
      headers: fixture.headers(reader.cookie),
      payload: {
        expectedSessionRevision: 1,
        reason: 'Synthetic forbidden cancellation',
      },
    });
    expect(forbidden.statusCode, forbidden.body).toBe(403);
  });
});
