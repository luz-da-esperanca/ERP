import { describe, expect, it } from 'vitest';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
import {
  createPeriodicActivity,
  createParticipant,
} from '../../../support/projects-fixture.js';

const fixture = setupIntegrationFixture();
describe('Historical participant enrollments', () => {
  it('keeps consecutive intervals, restricts participant data and corrects dates without creating attendance', async () => {
    const coordinator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const manager = await fixture.operator('synthetic.manager', [
      'ACTIVITY_MANAGER',
    ]);
    const { project, activity } = await createPeriodicActivity(
      fixture,
      coordinator.cookie,
    );
    const { person, family } = await createParticipant(
      fixture,
      coordinator.cookie,
    );
    const app = fixture.runtime.app;
    const request = {
      method: 'POST' as const,
      url: `/api/v1/activities/${activity.id}/enrollments`,
      headers: fixture.headers(manager.cookie),
      payload: {
        expectedActivityRevision: 1,
        personId: person.id,
        validFrom: '2026-01-01T03:00:00Z',
        validUntil: '2026-03-01T03:00:00Z',
      },
    };
    const first = await app.inject(request);
    expect(first.statusCode, first.body).toBe(201);
    const enrollment = first.json().data;
    expect((await app.inject(request)).json()).toEqual(first.json());
    const overlapping = await app.inject({
      ...request,
      headers: fixture.headers(manager.cookie),
      payload: {
        ...request.payload,
        expectedActivityRevision: 2,
        validFrom: '2026-02-01T03:00:00Z',
      },
    });
    expect(overlapping.statusCode, overlapping.body).toBe(409);
    expect(overlapping.json().error.details).toMatchObject({
      rule: 'ENROLLMENT_OVERLAP',
      ids: [enrollment.id],
    });
    const second = await app.inject({
      ...request,
      headers: fixture.headers(manager.cookie),
      payload: {
        ...request.payload,
        expectedActivityRevision: 2,
        validFrom: '2026-03-01T03:00:00Z',
        validUntil: '2026-04-01T03:00:00Z',
      },
    });
    expect(second.statusCode, second.body).toBe(201);
    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/activities/${activity.id}?asOf=2026-03-01T03:00:00Z`,
      headers: fixture.headers(manager.cookie),
    });
    expect(detail.json().data).toMatchObject({
      participantCount: 1,
      activity: { revision: 3 },
    });
    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/activities/${activity.id}/enrollments?asOf=2026-02-01T03:00:00Z`,
      headers: fixture.headers(manager.cookie),
    });
    expect(list.statusCode, list.body).toBe(200);
    expect(list.json().data).toHaveLength(1);
    expect(list.json().data[0].person).toEqual({
      id: person.id,
      name: 'Synthetic Participant',
      family: { id: family.id, code: family.code },
    });
    expect(JSON.stringify(list.json())).not.toContain('12345678901');
    const nature = await app.inject({
      method: 'PATCH',
      url: `/api/v1/activities/${activity.id}`,
      headers: fixture.headers(coordinator.cookie),
      payload: { expectedRevision: 3, nature: 'ONE_OFF' },
    });
    expect(nature.statusCode, nature.body).toBe(409);
    const corrected = await app.inject({
      method: 'PATCH',
      url: `/api/v1/enrollments/${enrollment.id}`,
      headers: fixture.headers(manager.cookie),
      payload: {
        expectedRevision: 1,
        validFrom: '2026-01-02T03:00:00Z',
        reason: 'Synthetic date correction',
      },
    });
    expect(corrected.statusCode, corrected.body).toBe(200);
    expect(corrected.json().data).toMatchObject({
      id: enrollment.id,
      validFrom: '2026-01-02T03:00:00.000Z',
      revision: 2,
    });
    const closed = await app.inject({
      method: 'POST',
      url: `/api/v1/enrollments/${second.json().data.id}/closure`,
      headers: fixture.headers(manager.cookie),
      payload: {
        expectedRevision: 1,
        validUntil: '2026-03-15T03:00:00Z',
        reason: 'Synthetic enrollment closure',
      },
    });
    expect(closed.statusCode, closed.body).toBe(200);
    const after = await app.inject({
      method: 'GET',
      url: `/api/v1/activities/${activity.id}?asOf=2026-03-15T03:00:00Z`,
      headers: fixture.headers(manager.cookie),
    });
    expect(after.json().data.participantCount).toBe(0);
    const audit = await app.inject({
      method: 'GET',
      url: `/api/v1/audit-entries?entityType=ParticipantEnrollment&entityId=${enrollment.id}`,
      headers: fixture.headers(manager.cookie),
    });
    expect(audit.statusCode, audit.body).toBe(200);
    expect(audit.json().data[0]).toMatchObject({
      action: 'CORRECT',
      reason: 'Synthetic date correction',
      before: { validFrom: '2026-01-01T03:00:00.000Z' },
      after: { validFrom: '2026-01-02T03:00:00.000Z' },
    });
    const changedPeriod = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${project.id}`,
      headers: fixture.headers(coordinator.cookie),
      payload: { expectedRevision: 2, startsOn: '2026-02-01' },
    });
    expect(changedPeriod.statusCode, changedPeriod.body).toBe(409);
    expect(changedPeriod.json().error.details.ids).toContain(enrollment.id);
  });
});
