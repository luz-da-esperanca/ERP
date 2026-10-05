import { describe, expect, it } from 'vitest';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
import {
  createPeriodicActivity,
  createParticipant,
} from '../../../support/projects-fixture.js';
import { confirmCall } from '../../../support/attendance-fixture.js';
import { auditPageSchema } from '@erp/contracts/audit-api';
describe('Attendance audit authorization', () => {
  const fixture = setupIntegrationFixture();
  it('exposes attendance history to activity managers without granting registration or account history', async () => {
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
    const { person, family } = await createParticipant(
      fixture,
      coordinator.cookie,
    );
    const call = await confirmCall(
      fixture,
      manager.cookie,
      activity.id,
      manager.user.id,
      '2026-01-05T13:00:00Z',
      [{ personId: person.id, status: 'PRESENT' }],
    );
    const app = fixture.runtime.app;
    const history = await app.inject({
      method: 'GET',
      url: `/api/v1/audit-entries?entityType=ActivitySession&entityId=${call.session.id}`,
      headers: fixture.headers(manager.cookie),
    });
    expect(history.statusCode, history.body).toBe(200);
    const entries = auditPageSchema.parse(history.json());
    expect(entries.data).toHaveLength(1);
    expect(entries.data[0]).toMatchObject({
      classification: 'ATTENDANCE',
      actorId: manager.user.id,
      occurredAt: call.session.occurredAt,
    });
    const forbidden = await app.inject({
      method: 'GET',
      url: `/api/v1/audit-entries?entityType=ActivitySession&entityId=${call.session.id}`,
      headers: fixture.headers(fixture.adminCookie),
    });
    expect(forbidden.statusCode, forbidden.body).toBe(403);
    const familyHistory = await app.inject({
      method: 'GET',
      url: `/api/v1/audit-entries?entityType=Family&entityId=${family.id}`,
      headers: fixture.headers(coordinator.cookie),
    });
    const restricted = await app.inject({
      method: 'GET',
      url: `/api/v1/audit-entries/${familyHistory.json().data[0].id}`,
      headers: fixture.headers(manager.cookie),
    });
    expect(restricted.statusCode, restricted.body).toBe(404);
  });
});
