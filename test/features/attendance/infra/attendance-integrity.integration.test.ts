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
} from '../../../support/attendance-fixture.js';

describe('Attendance transaction integrity', () => {
  const fixture = setupIntegrationFixture();
  it('serializes session confirmation against a retroactive activity closure', async () => {
    const coordinator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const manager = await fixture.operator('synthetic.manager', [
      'ACTIVITY_MANAGER',
    ]);
    const { activity } = await createPeriodicActivity(
      fixture,
      coordinator.cookie,
    );
    const preview = await previewCall(
      fixture,
      manager.cookie,
      activity.id,
      '2026-01-20T13:00:00Z',
    );
    const app = fixture.runtime.app;
    const responses = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/v1/activities/${activity.id}/sessions`,
        headers: fixture.headers(manager.cookie),
        payload: {
          occurredAt: preview.occurredAt,
          responsibleId: manager.user.id,
          expectedActivityRevision: preview.expectedActivityRevision,
          expectedRosterFingerprint: preview.rosterFingerprint,
          entries: [],
        },
      }),
      app.inject({
        method: 'POST',
        url: `/api/v1/activities/${activity.id}/closure`,
        headers: fixture.headers(coordinator.cookie),
        payload: {
          expectedRevision: activity.revision,
          effectiveAt: '2026-01-10T13:00:00Z',
          reason: 'Synthetic racing closure',
        },
      }),
    ]);
    expect(responses.filter((row) => row.statusCode === 409)).toHaveLength(1);
    expect(
      responses.filter(
        (row) => row.statusCode === 200 || row.statusCode === 201,
      ),
    ).toHaveLength(1);
    const current = (
      await app.inject({
        method: 'GET',
        url: `/api/v1/activities/${activity.id}`,
        headers: fixture.headers(coordinator.cookie),
      })
    ).json().data.activity;
    const sessions = (
      await app.inject({
        method: 'GET',
        url: `/api/v1/activities/${activity.id}/sessions`,
        headers: fixture.headers(manager.cookie),
      })
    ).json().data;
    expect(sessions).toHaveLength(current.status === 'CLOSED' ? 0 : 1);
  });
  it('serializes the same intention and rejects the same operation key from another author', async () => {
    const coordinator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const manager = await fixture.operator('synthetic.manager', [
      'ACTIVITY_MANAGER',
    ]);
    const { activity } = await createPeriodicActivity(
      fixture,
      coordinator.cookie,
    );
    const { person } = await createParticipant(fixture, coordinator.cookie);
    const preview = await previewCall(
      fixture,
      coordinator.cookie,
      activity.id,
      '2026-01-05T13:00:00Z',
      [person.id],
    );
    const payload = {
      occurredAt: preview.occurredAt,
      responsibleId: coordinator.user.id,
      expectedActivityRevision: preview.expectedActivityRevision,
      expectedRosterFingerprint: preview.rosterFingerprint,
      entries: [markingFor(preview.rows[0]!, 'PRESENT')],
    };
    const key = randomUUID();
    const responses = await Promise.all(
      [coordinator, manager].map((operator) =>
        fixture.runtime.app.inject({
          method: 'POST',
          url: `/api/v1/activities/${activity.id}/sessions`,
          headers: fixture.headers(operator.cookie, key),
          payload,
        }),
      ),
    );
    expect(responses.map((row) => row.statusCode).sort()).toEqual([201, 409]);
    const owner = responses[0]!.statusCode === 201 ? coordinator : manager;
    const retry = await fixture.runtime.app.inject({
      method: 'POST',
      url: `/api/v1/activities/${activity.id}/sessions`,
      headers: fixture.headers(owner.cookie, key),
      payload,
    });
    expect(retry.json()).toEqual(
      responses.find((row) => row.statusCode === 201)!.json(),
    );
    const duplicate = retry.json().data.attendances[0];
    await expect(
      fixture.runtime.database.attendance.create({
        data: {
          sessionId: duplicate.sessionId,
          personId: duplicate.personId,
          familyId: duplicate.familyId,
          membershipId: duplicate.membershipId,
          membershipRevision: duplicate.membershipRevision,
          status: 'ABSENT',
          recordedBy: owner.user.id,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
  it('rolls back the session, markings and operation when audit fails, then accepts the same key', async () => {
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
    const payload = {
      occurredAt: preview.occurredAt,
      responsibleId: operator.user.id,
      expectedActivityRevision: preview.expectedActivityRevision,
      expectedRosterFingerprint: preview.rosterFingerprint,
      entries: [markingFor(preview.rows[0]!, 'PRESENT')],
    };
    const headers = fixture.headers(operator.cookie);
    const database = fixture.runtime.database;
    await database.$executeRawUnsafe(
      `CREATE FUNCTION fail_attendance_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."entityType" = 'Attendance' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$`,
    );
    await database.$executeRawUnsafe(
      `CREATE TRIGGER fail_attendance_audit BEFORE INSERT ON "AuditEntry" FOR EACH ROW EXECUTE FUNCTION fail_attendance_audit()`,
    );
    try {
      const failed = await fixture.runtime.app.inject({
        method: 'POST',
        url: `/api/v1/activities/${activity.id}/sessions`,
        headers,
        payload,
      });
      expect(failed.statusCode, failed.body).toBe(500);
      const sessions = await fixture.runtime.app.inject({
        method: 'GET',
        url: `/api/v1/activities/${activity.id}/sessions`,
        headers: fixture.headers(operator.cookie),
      });
      expect(sessions.json().pagination.total).toBe(0);
    } finally {
      await database.$executeRawUnsafe(
        'DROP TRIGGER fail_attendance_audit ON "AuditEntry"',
      );
      await database.$executeRawUnsafe('DROP FUNCTION fail_attendance_audit()');
    }
    const retried = await fixture.runtime.app.inject({
      method: 'POST',
      url: `/api/v1/activities/${activity.id}/sessions`,
      headers,
      payload,
    });
    expect(retried.statusCode, retried.body).toBe(201);
  });
});
