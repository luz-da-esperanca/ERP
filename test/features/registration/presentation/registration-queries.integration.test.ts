import { describe, expect, it } from 'vitest';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';

const fixture = setupIntegrationFixture();
async function household() {
  const actor = await fixture.operator('synthetic.social', [
    'SOCIAL_ASSISTANCE',
  ]);
  const familyResponse = await fixture.runtime.app.inject({
    method: 'POST',
    url: '/api/v1/families',
    headers: fixture.headers(actor.cookie),
    payload: {
      referenceName: 'Família Sintética',
      address: 'Rua José Sintética',
    },
  });
  expect(familyResponse.statusCode, familyResponse.body).toBe(201);
  const family = familyResponse.json().data;
  const personResponse = await fixture.runtime.app.inject({
    method: 'POST',
    url: '/api/v1/people',
    headers: fixture.headers(actor.cookie),
    payload: {
      name: 'Pessoa Sintética',
      familyId: family.id,
      expectedFamilyRevision: 1,
      validFrom: '2026-01-01T00:00:00Z',
      isReference: true,
    },
  });
  expect(personResponse.statusCode, personResponse.body).toBe(201);
  return { actor, family, ...personResponse.json().data };
}

describe('Registration queries and personal revisions', () => {
  it('lists filtered family compositions with stable pagination and an exclusive historical cut', async () => {
    const { actor, family } = await household();
    const list = await fixture.runtime.app.inject({
      method: 'GET',
      url: '/api/v1/families?q=rua%20jose&asOf=2026-01-01T00:00:00Z&pageSize=1',
      headers: { cookie: actor.cookie },
    });
    expect(list.statusCode, list.body).toBe(200);
    expect(list.json()).toMatchObject({
      data: [
        {
          id: family.id,
          memberCount: 1,
          referencePersonName: 'Pessoa Sintética',
        },
      ],
      pagination: { page: 1, pageSize: 1, total: 1 },
    });
    const before = await fixture.runtime.app.inject({
      method: 'GET',
      url: `/api/v1/families?code=${family.code}&asOf=2025-12-31T23:59:59Z`,
      headers: { cookie: actor.cookie },
    });
    expect(before.json().data[0].memberCount).toBe(0);
    expect(
      (
        await fixture.runtime.app.inject({
          method: 'GET',
          url: '/api/v1/families',
          headers: { cookie: fixture.adminCookie },
        })
      ).statusCode,
    ).toBe(403);
  });
  it('updates person data with historical audit, no-op preservation and restricted detail projection', async () => {
    const { actor, person, family } = await household();
    const request = {
      method: 'PATCH' as const,
      url: `/api/v1/people/${person.id}`,
      headers: fixture.headers(actor.cookie),
      payload: {
        expectedRevision: 1,
        cpf: '123.456.789-00',
        occupation: 'Synthetic occupation',
      },
    };
    const update = await fixture.runtime.app.inject(request);
    expect(update.statusCode, update.body).toBe(200);
    expect(update.json().data).toMatchObject({
      name: person.name,
      cpf: '12345678900',
      revision: 2,
    });
    const noop = await fixture.runtime.app.inject({
      ...request,
      headers: fixture.headers(actor.cookie),
      payload: {
        expectedRevision: 2,
        cpf: '123.456.789-00',
        occupation: 'Synthetic occupation',
      },
    });
    expect(noop.json()).toEqual(update.json());
    expect((await fixture.runtime.app.inject(request)).json()).toEqual(
      update.json(),
    );
    const detail = await fixture.runtime.app.inject({
      method: 'GET',
      url: `/api/v1/people/${person.id}`,
      headers: { cookie: actor.cookie },
    });
    expect(detail.json().data).toMatchObject({
      person: { revision: 2 },
      memberships: [{ familyId: family.id }],
    });
    const history = await fixture.runtime.app.inject({
      method: 'GET',
      url: `/api/v1/audit-entries?entityType=Person&entityId=${person.id}`,
      headers: { cookie: actor.cookie },
    });
    expect(history.statusCode, history.body).toBe(200);
    expect(history.json().data).toHaveLength(2);
    expect(history.json().data[0]).toMatchObject({
      before: { cpf: null },
      after: { cpf: '12345678900' },
      actorId: actor.user.id,
    });
    const activity = await fixture.operator('synthetic.activity', [
      'ACTIVITY_MANAGER',
    ]);
    const minimal = await fixture.runtime.app.inject({
      method: 'GET',
      url: `/api/v1/people/${person.id}`,
      headers: { cookie: activity.cookie },
    });
    expect(minimal.json().data).toEqual({
      id: person.id,
      name: person.name,
      family: { id: family.id, code: family.code },
    });
    for (const cookie of [activity.cookie, fixture.adminCookie]) {
      const entry = await fixture.runtime.app.inject({
        method: 'GET',
        url: `/api/v1/audit-entries/${history.json().data[0].id}`,
        headers: { cookie },
      });
      expect(entry.statusCode, entry.body).toBe(404);
    }
  });
  it('keeps dated size revisions and permits an unknown current membership after closure', async () => {
    const { actor, person, membership, family } = await household();
    const sizesRequest = {
      method: 'PUT' as const,
      url: `/api/v1/people/${person.id}/sizes`,
      headers: fixture.headers(actor.cookie),
      payload: {
        expectedRevision: null,
        shoeSize: 'Synthetic 30',
        clothingSize: null,
        informedOn: '2026-01-02',
      },
    };
    const missingRevision = await fixture.runtime.app.inject({
      ...sizesRequest,
      headers: fixture.headers(actor.cookie),
      payload: { ...sizesRequest.payload, expectedRevision: 1 },
    });
    expect(missingRevision.statusCode, missingRevision.body).toBe(409);
    expect(missingRevision.json().error.details.currentRevision).toBeNull();
    for (const [informedOn, rule] of [
      [null, 'SIZE_DATE_REQUIRED'],
      ['2099-01-01', 'FUTURE_SIZE_DATE'],
    ] as const) {
      const invalid = await fixture.runtime.app.inject({
        ...sizesRequest,
        headers: fixture.headers(actor.cookie),
        payload: { ...sizesRequest.payload, informedOn },
      });
      expect(invalid.statusCode, invalid.body).toBe(422);
      expect(invalid.json().error.details.rule).toBe(rule);
    }
    expect(await fixture.runtime.database.sizeProfile.count()).toBe(0);
    const sizes = await fixture.runtime.app.inject(sizesRequest);
    expect(sizes.statusCode, sizes.body).toBe(200);
    expect(sizes.json().data).toMatchObject({
      personId: person.id,
      shoeSize: 'Synthetic 30',
      revision: 1,
    });
    await fixture.runtime.app.inject({
      ...sizesRequest,
      headers: fixture.headers(actor.cookie),
      payload: {
        expectedRevision: 1,
        shoeSize: 'Synthetic 31',
        clothingSize: null,
        informedOn: '2026-02-02',
      },
    });
    expect((await fixture.runtime.app.inject(sizesRequest)).json()).toEqual(
      sizes.json(),
    );
    const close = await fixture.runtime.app.inject({
      method: 'POST',
      url: `/api/v1/memberships/${membership.id}/closure`,
      headers: fixture.headers(actor.cookie),
      payload: {
        expectedRevision: 1,
        expectedFamilyRevision: 2,
        validUntil: '2026-02-01T00:00:00Z',
        reason: 'Synthetic departure',
      },
    });
    expect(close.statusCode, close.body).toBe(200);
    expect(close.json().data).toMatchObject({
      membership: { validUntil: '2026-02-01T00:00:00.000Z', revision: 2 },
      family: { id: family.id, revision: 3 },
    });
    const detail = await fixture.runtime.app.inject({
      method: 'GET',
      url: `/api/v1/people/${person.id}`,
      headers: { cookie: actor.cookie },
    });
    expect(detail.json().data).toMatchObject({
      person: { id: person.id },
      currentFamily: null,
      sizeProfile: { shoeSize: 'Synthetic 31', revision: 2 },
    });
  });
});
