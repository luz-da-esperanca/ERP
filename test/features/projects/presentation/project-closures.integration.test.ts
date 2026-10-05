import { describe, expect, it } from 'vitest';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
import {
  createPeriodicActivity,
  createParticipant,
} from '../../../support/projects-fixture.js';

const fixture = setupIntegrationFixture();
describe('Atomic project and activity closure', () => {
  it('preserves earlier closures, rejects conflicting cuts and replays the original cascade after late registration', async () => {
    const actor = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const { project, activity: earlier } = await createPeriodicActivity(
      fixture,
      actor.cookie,
    );
    const { person } = await createParticipant(fixture, actor.cookie);
    const app = fixture.runtime.app;
    const headers = () => fixture.headers(actor.cookie);
    const otherResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/activities`,
      headers: headers(),
      payload: {
        expectedProjectRevision: 2,
        name: 'Synthetic Other Activity',
        nature: 'PERIODIC',
      },
    });
    expect(otherResponse.statusCode, otherResponse.body).toBe(201);
    const other = otherResponse.json().data;
    const earlierClose = await app.inject({
      method: 'POST',
      url: `/api/v1/activities/${earlier.id}/closure`,
      headers: headers(),
      payload: {
        expectedRevision: 1,
        effectiveAt: '2026-03-01T03:00:00Z',
        reason: 'Synthetic early closure',
      },
    });
    expect(earlierClose.statusCode, earlierClose.body).toBe(200);
    const enrolled = await app.inject({
      method: 'POST',
      url: `/api/v1/activities/${other.id}/enrollments`,
      headers: headers(),
      payload: {
        expectedActivityRevision: 1,
        personId: person.id,
        validFrom: '2026-02-01T03:00:00Z',
      },
    });
    expect(enrolled.statusCode, enrolled.body).toBe(201);
    const conflict = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/closure`,
      headers: headers(),
      payload: {
        expectedRevision: 3,
        effectiveAt: '2026-02-01T03:00:00Z',
        reason: 'Synthetic conflicting closure',
      },
    });
    expect(conflict.statusCode, conflict.body).toBe(409);
    expect(conflict.json().error.details.ids).toEqual(
      expect.arrayContaining([earlier.id, enrolled.json().data.id]),
    );
    const unchanged = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}`,
      headers: headers(),
    });
    expect(unchanged.json().data.project).toMatchObject({
      status: 'ACTIVE',
      revision: 3,
    });
    const request = {
      method: 'POST' as const,
      url: `/api/v1/projects/${project.id}/closure`,
      headers: headers(),
      payload: {
        expectedRevision: 3,
        effectiveAt: '2026-04-01T03:00:00Z',
        reason: 'Synthetic project closure',
      },
    };
    const closed = await app.inject(request);
    expect(closed.statusCode, closed.body).toBe(200);
    expect(closed.json().data.project).toMatchObject({
      status: 'CLOSED',
      revision: 4,
    });
    expect(closed.json().data.activities).toHaveLength(1);
    expect(closed.json().data.activities[0]).toMatchObject({
      id: other.id,
      revision: 3,
      closedAt: '2026-04-01T03:00:00.000Z',
    });
    expect(closed.json().data.enrollments[0]).toMatchObject({
      id: enrolled.json().data.id,
      revision: 2,
      validUntil: '2026-04-01T03:00:00.000Z',
    });
    const earlierDetail = await app.inject({
      method: 'GET',
      url: `/api/v1/activities/${earlier.id}`,
      headers: headers(),
    });
    expect(earlierDetail.json().data.activity).toMatchObject({
      revision: 2,
      closedAt: '2026-03-01T03:00:00.000Z',
    });
    const late = await app.inject({
      method: 'POST',
      url: `/api/v1/activities/${other.id}/enrollments`,
      headers: headers(),
      payload: {
        expectedActivityRevision: 3,
        personId: person.id,
        validFrom: '2026-01-01T03:00:00Z',
        validUntil: '2026-01-15T03:00:00Z',
      },
    });
    expect(late.statusCode, late.body).toBe(201);
    expect((await app.inject(request)).json()).toEqual(closed.json());
    const boundary = await app.inject({
      method: 'POST',
      url: `/api/v1/activities/${other.id}/enrollments`,
      headers: headers(),
      payload: {
        expectedActivityRevision: 4,
        personId: person.id,
        validFrom: '2026-04-01T03:00:00Z',
        validUntil: '2026-04-02T03:00:00Z',
      },
    });
    expect(boundary.statusCode, boundary.body).toBe(422);
    const history = await app.inject({
      method: 'GET',
      url: `/api/v1/audit-entries?entityType=Activity&entityId=${earlier.id}`,
      headers: headers(),
    });
    expect(history.json().data).toHaveLength(2);
  });
});
