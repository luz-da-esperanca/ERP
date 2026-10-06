import { describe, expect, it } from 'vitest';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
import { responsibleCandidatesPageSchema } from '@erp/contracts/access-api';

describe('Responsible candidates', () => {
  const fixture = setupIntegrationFixture();
  it('lists active activity operators with identification only, for the profiles that designate a responsible', async () => {
    const coordinator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const manager = await fixture.operator('synthetic.manager', [
      'ACTIVITY_MANAGER',
    ]);
    const social = await fixture.operator('synthetic.social', [
      'SOCIAL_ASSISTANCE',
    ]);
    const former = await fixture.createUser('synthetic.former', [
      'ACTIVITY_MANAGER',
    ]);
    const app = fixture.runtime.app;
    const deactivated = await app.inject({
      method: 'POST',
      url: `/api/v1/users/${former.id}/activation`,
      headers: fixture.headers(fixture.adminCookie),
      payload: {
        expectedRevision: former.revision,
        active: false,
        reason: 'Synthetic departure',
      },
    });
    expect(deactivated.statusCode, deactivated.body).toBe(200);
    const get = (cookie: string, query = '') =>
      app.inject({
        method: 'GET',
        url: `/api/v1/responsible-candidates${query}`,
        headers: fixture.headers(cookie),
      });
    for (const cookie of [coordinator.cookie, manager.cookie]) {
      const response = await get(cookie);
      expect(response.statusCode, response.body).toBe(200);
      // Administrators, social assistance and deactivated accounts are not offered.
      expect(responsibleCandidatesPageSchema.parse(response.json())).toEqual({
        data: [
          {
            id: coordinator.user.id,
            displayName: 'Synthetic synthetic.coordinator',
            active: true,
          },
          {
            id: manager.user.id,
            displayName: 'Synthetic synthetic.manager',
            active: true,
          },
        ],
        pagination: { page: 1, pageSize: 20, total: 2 },
      });
      expect(Object.keys(response.json().data[0]).sort()).toEqual([
        'active',
        'displayName',
        'id',
      ]);
    }
    const searched = await get(coordinator.cookie, '?q=MANAGER');
    expect(searched.json().data.map((row: { id: string }) => row.id)).toEqual([
      manager.user.id,
    ]);
    // A responsible already recorded stays identifiable after leaving.
    const resolved = await get(
      manager.cookie,
      `?ids=${former.id},${social.user.id}`,
    );
    expect(responsibleCandidatesPageSchema.parse(resolved.json()).data).toEqual(
      expect.arrayContaining([
        {
          id: former.id,
          displayName: 'Synthetic synthetic.former',
          active: false,
        },
        {
          id: social.user.id,
          displayName: 'Synthetic synthetic.social',
          active: true,
        },
      ]),
    );
    for (const cookie of [social.cookie, fixture.adminCookie])
      expect((await get(cookie)).statusCode).toBe(403);
    expect((await get(coordinator.cookie, '?login=x')).statusCode).toBe(400);
  });
});
