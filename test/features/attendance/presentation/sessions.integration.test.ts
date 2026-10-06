import { describe, expect, it } from 'vitest';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
import {
  createPeriodicActivity,
  createParticipant,
} from '../../../support/projects-fixture.js';
import {
  attendanceContextSchema,
  sessionResultSchema,
  frequencyResultSchema,
} from '@erp/contracts/attendance-api';

describe('Attendance session confirmation', () => {
  const fixture = setupIntegrationFixture();
  it('keeps preview read-only and confirms explicit guest attendance without creating enrollment', async () => {
    const operator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const { activity } = await createPeriodicActivity(fixture, operator.cookie);
    const { person, family } = await createParticipant(
      fixture,
      operator.cookie,
    );
    const app = fixture.runtime.app;
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/activities/${activity.id}/attendance-context?occurredAt=2026-01-05T13:00:00Z&guestPersonIds=${person.id}`,
      headers: fixture.headers(operator.cookie),
    });
    expect(response.statusCode, response.body).toBe(200);
    const context = attendanceContextSchema.parse(response.json().data);
    expect(context.rows).toHaveLength(1);
    expect(context.rows[0]?.attendance).toBeNull();
    expect(response.body).not.toContain('12345678901');
    const sessionsBefore = await app.inject({
      method: 'GET',
      url: `/api/v1/activities/${activity.id}/sessions`,
      headers: fixture.headers(operator.cookie),
    });
    expect(sessionsBefore.json().pagination.total).toBe(0);
    const row = context.rows[0]!;
    const payload = {
      occurredAt: context.occurredAt,
      responsibleId: operator.user.id,
      expectedActivityRevision: context.expectedActivityRevision,
      expectedRosterFingerprint: context.rosterFingerprint,
      entries: [
        {
          personId: row.personId,
          expectedPersonRevision: row.expectedPersonRevision,
          familyId: row.familyId,
          expectedFamilyRevision: row.expectedFamilyRevision,
          membershipId: row.membershipId,
          expectedMembershipRevision: row.expectedMembershipRevision,
          status: 'PRESENT',
        },
      ],
    };
    const headers = fixture.headers(operator.cookie);
    const confirmed = await app.inject({
      method: 'POST',
      url: `/api/v1/activities/${activity.id}/sessions`,
      headers,
      payload,
    });
    expect(confirmed.statusCode, confirmed.body).toBe(201);
    const result = sessionResultSchema.parse(confirmed.json().data);
    expect(result.attendances[0]).toMatchObject({
      personId: person.id,
      familyId: family.id,
      status: 'PRESENT',
    });
    expect(result.session.occurredAt).toBe('2026-01-05T13:00:00.000Z');
    expect(result.session.recordedAt > result.session.occurredAt).toBe(true);
    const replay = await app.inject({
      method: 'POST',
      url: `/api/v1/activities/${activity.id}/sessions`,
      headers,
      payload,
    });
    expect(replay.json()).toEqual(confirmed.json());
    const enrollments = await app.inject({
      method: 'GET',
      url: `/api/v1/activities/${activity.id}/enrollments`,
      headers: fixture.headers(operator.cookie),
    });
    expect(enrollments.json().pagination.total).toBe(0);
    const frequency = await app.inject({
      method: 'GET',
      url: `/api/v1/people/${person.id}/frequency?activityId=${activity.id}&from=2026-01-01T03:00:00Z&toExclusive=2026-02-01T03:00:00Z`,
      headers: fixture.headers(operator.cookie),
    });
    expect(frequency.statusCode, frequency.body).toBe(200);
    expect(frequencyResultSchema.parse(frequency.json().data)).toMatchObject({
      sessionCount: 1,
      presenceCount: 1,
      unrecordedCount: 0,
      attendanceRate: null,
      coverageComplete: false,
    });
  });
});
