import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
import {
  createPeriodicActivity,
  createParticipant,
} from '../../../support/projects-fixture.js';

const fixture = setupIntegrationFixture();
describe('Projects public validation boundaries', () => {
  it('requires a persisted institute, an idempotency key and server-controlled metadata', async () => {
    const actor = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const app = fixture.runtime.app;
    const headers = () => fixture.headers(actor.cookie);
    const missing = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: headers(),
      payload: { name: 'Synthetic Project' },
    });
    expect(missing.statusCode, missing.body).toBe(400);
    const unknown = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: headers(),
      payload: { name: 'Synthetic Project', instituteId: randomUUID() },
    });
    expect(unknown.statusCode, unknown.body).toBe(404);
    const { project, activity } = await createPeriodicActivity(
      fixture,
      actor.cookie,
    );
    const noKey = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${project.id}`,
      headers: {
        origin: fixture.config.APP_ORIGIN,
        'content-type': 'application/json',
        'x-erp-request': '1',
        cookie: actor.cookie,
      },
      payload: { expectedRevision: 2, name: 'Synthetic Renamed' },
    });
    expect(noKey.statusCode, noKey.body).toBe(400);
    const metadata = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${project.id}`,
      headers: headers(),
      payload: {
        expectedRevision: 2,
        status: 'CLOSED',
        updatedBy: actor.user.id,
      },
    });
    expect(metadata.statusCode, metadata.body).toBe(400);
    const unknownAccount = await app.inject({
      method: 'PATCH',
      url: `/api/v1/activities/${activity.id}`,
      headers: headers(),
      payload: { expectedRevision: 1, responsibleId: randomUUID() },
    });
    expect(unknownAccount.statusCode, unknownAccount.body).toBe(404);
    const future = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/closure`,
      headers: headers(),
      payload: {
        expectedRevision: 2,
        effectiveAt: '2099-01-01T00:00:00Z',
        reason: 'Synthetic future closure',
      },
    });
    expect(future.statusCode, future.body).toBe(422);
    expect(future.json().error.details.rule).toBe('FUTURE_EFFECTIVE_DATE');
  });
  it('requires a family membership at the initial instant and permits enrollment in its historical interval', async () => {
    const actor = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const { activity } = await createPeriodicActivity(fixture, actor.cookie);
    const { person, family, membership } = await createParticipant(
      fixture,
      actor.cookie,
    );
    const app = fixture.runtime.app;
    const closed = await app.inject({
      method: 'POST',
      url: `/api/v1/memberships/${membership.id}/closure`,
      headers: fixture.headers(actor.cookie),
      payload: {
        expectedRevision: membership.revision,
        expectedFamilyRevision: family.revision,
        validUntil: '2026-02-01T03:00:00Z',
        reason: 'Synthetic family membership closure',
      },
    });
    expect(closed.statusCode, closed.body).toBe(200);
    const unknown = await app.inject({
      method: 'POST',
      url: `/api/v1/activities/${activity.id}/enrollments`,
      headers: fixture.headers(actor.cookie),
      payload: {
        expectedActivityRevision: 1,
        personId: person.id,
        validFrom: '2026-02-01T03:00:00Z',
      },
    });
    expect(unknown.statusCode, unknown.body).toBe(422);
    expect(unknown.json().error.details.rule).toBe('PERSON_WITHOUT_MEMBERSHIP');
    const historical = await app.inject({
      method: 'POST',
      url: `/api/v1/activities/${activity.id}/enrollments`,
      headers: fixture.headers(actor.cookie),
      payload: {
        expectedActivityRevision: 1,
        personId: person.id,
        validFrom: '2026-01-15T03:00:00Z',
        validUntil: '2026-02-01T03:00:00Z',
      },
    });
    expect(historical.statusCode, historical.body).toBe(201);
  });
});
