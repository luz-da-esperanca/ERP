import { describe, expect, it } from 'vitest';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
import {
  createPeriodicActivity,
  createParticipant,
} from '../../../support/projects-fixture.js';
import {
  confirmCall,
  enrollPerson,
} from '../../../support/attendance-fixture.js';

describe('Attendance boundaries in dependent modules', () => {
  const fixture = setupIntegrationFixture();
  it('blocks closure and project date changes that invalidate completed sessions, and preserves nature after cancellation', async () => {
    const operator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const { activity, project } = await createPeriodicActivity(
      fixture,
      operator.cookie,
    );
    const call = await confirmCall(
      fixture,
      operator.cookie,
      activity.id,
      operator.user.id,
      '2026-01-20T13:00:00Z',
    );
    const app = fixture.runtime.app;
    const closure = await app.inject({
      method: 'POST',
      url: `/api/v1/activities/${activity.id}/closure`,
      headers: fixture.headers(operator.cookie),
      payload: {
        expectedRevision: activity.revision,
        effectiveAt: '2026-01-10T13:00:00Z',
        reason: 'Synthetic invalid cut',
      },
    });
    expect(closure.statusCode, closure.body).toBe(409);
    expect(closure.json().error.details.ids).toContain(call.session.id);
    const period = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${project.id}`,
      headers: fixture.headers(operator.cookie),
      payload: { expectedRevision: project.revision, endsOn: '2026-01-10' },
    });
    expect(period.statusCode, period.body).toBe(409);
    const cancelled = await app.inject({
      method: 'POST',
      url: `/api/v1/sessions/${call.session.id}/cancellation`,
      headers: fixture.headers(operator.cookie),
      payload: { expectedSessionRevision: 1, reason: 'Synthetic cancellation' },
    });
    expect(cancelled.statusCode, cancelled.body).toBe(200);
    const serviceType = await app.inject({
      method: 'POST',
      url: '/api/v1/service-types',
      headers: fixture.headers(operator.cookie),
      payload: { code: 'SYNTHETIC', name: 'Synthetic type' },
    });
    const nature = await app.inject({
      method: 'PATCH',
      url: `/api/v1/activities/${activity.id}`,
      headers: fixture.headers(operator.cookie),
      payload: {
        expectedRevision: activity.revision,
        nature: 'ONE_OFF',
        serviceTypeId: serviceType.json().data.id,
      },
    });
    expect(nature.statusCode, nature.body).toBe(409);
  });
  it('blocks retroactive membership changes that invalidate a completed marking', async () => {
    const operator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const { activity } = await createPeriodicActivity(fixture, operator.cookie);
    const { person, family, membership } = await createParticipant(
      fixture,
      operator.cookie,
    );
    await enrollPerson(fixture, operator.cookie, activity.id, person.id);
    const call = await confirmCall(
      fixture,
      operator.cookie,
      activity.id,
      operator.user.id,
      '2026-01-20T13:00:00Z',
      [{ personId: person.id, status: 'PRESENT' }],
    );
    const response = await fixture.runtime.app.inject({
      method: 'POST',
      url: `/api/v1/memberships/${membership.id}/closure`,
      headers: fixture.headers(operator.cookie),
      payload: {
        expectedRevision: membership.revision,
        expectedFamilyRevision: family.revision,
        validUntil: '2026-01-10T13:00:00Z',
        reason: 'Synthetic invalid historical cut',
      },
    });
    expect(response.statusCode, response.body).toBe(409);
    expect(response.json().error.details.ids).toContain(
      call.attendances[0]!.id,
    );
  });
});
