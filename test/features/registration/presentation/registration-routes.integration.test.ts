import { describe, expect, it } from 'vitest';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';

const fixture = setupIntegrationFixture();
describe('Registration HTTP API', () => {
  it('rejects competing authors sharing a concurrent idempotency key', async () => {
    const first = await fixture.operator('synthetic.first', [
      'SOCIAL_ASSISTANCE',
    ]);
    const second = await fixture.operator('synthetic.second', [
      'SOCIAL_ASSISTANCE',
    ]);
    const headers = fixture.headers(first.cookie);
    const responses = await Promise.all(
      [first, second].map((actor) =>
        fixture.runtime.app.inject({
          method: 'POST',
          url: '/api/v1/families',
          headers: { ...headers, cookie: actor.cookie },
          payload: {},
        }),
      ),
    );
    expect(responses.map((response) => response.statusCode).sort()).toEqual([
      201, 409,
    ]);
    expect(
      responses.find((response) => response.statusCode === 409)!.json().error
        .code,
    ).toBe('IDEMPOTENCY_CONFLICT');
    expect(await fixture.runtime.database.family.count()).toBe(1);
  });
  it('creates a family with unknown data and a server-generated immutable code', async () => {
    const actor = await fixture.operator('synthetic.social', [
      'SOCIAL_ASSISTANCE',
    ]);
    const response = await fixture.runtime.app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: fixture.headers(actor.cookie),
      payload: {},
    });
    expect(response.statusCode, response.body).toBe(201);
    expect(response.json().data).toMatchObject({
      code: expect.stringMatching(/^\d+$/),
      revision: 1,
      referenceName: null,
      address: null,
    });
    const detail = await fixture.runtime.app.inject({
      method: 'GET',
      url: `/api/v1/families/${response.json().data.id}`,
      headers: { cookie: actor.cookie },
    });
    expect(detail.statusCode, detail.body).toBe(200);
    expect(detail.json().data).toMatchObject({
      family: {
        id: response.json().data.id,
        memberCount: 0,
        referencePersonName: null,
      },
      members: [],
    });
  });
  it('updates optional fields without erasing omitted data and restricts participant searches to minimal identities', async () => {
    const social = await fixture.operator('synthetic.social', [
      'SOCIAL_ASSISTANCE',
    ]);
    const familyResponse = await fixture.runtime.app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: fixture.headers(social.cookie),
      payload: {
        address: 'Synthetic Address',
        referenceName: 'Synthetic Household',
      },
    });
    const family = familyResponse.json().data;
    const personResponse = await fixture.runtime.app.inject({
      method: 'POST',
      url: '/api/v1/people',
      headers: fixture.headers(social.cookie),
      payload: {
        name: 'Synthetic Participant',
        cpf: '12345678900',
        familyId: family.id,
        expectedFamilyRevision: 1,
        validFrom: '2026-01-01T00:00:00Z',
      },
    });
    const person = personResponse.json().data.person;
    const update = await fixture.runtime.app.inject({
      method: 'PATCH',
      url: `/api/v1/families/${family.id}`,
      headers: fixture.headers(social.cookie),
      payload: { expectedRevision: 2, contactPhone: 'Synthetic Phone' },
    });
    expect(update.statusCode, update.body).toBe(200);
    expect(update.json().data).toMatchObject({
      address: 'Synthetic Address',
      contactPhone: 'Synthetic Phone',
      revision: 3,
    });
    const activity = await fixture.operator('synthetic.activity', [
      'ACTIVITY_MANAGER',
    ]);
    const lookup = await fixture.runtime.app.inject({
      method: 'GET',
      url: '/api/v1/people?q=synthetic',
      headers: { cookie: activity.cookie },
    });
    expect(lookup.statusCode, lookup.body).toBe(200);
    expect(lookup.json()).toEqual({
      data: [
        {
          id: person.id,
          name: 'Synthetic Participant',
          family: { id: family.id, code: family.code },
        },
      ],
      pagination: { page: 1, pageSize: 20, total: 1 },
    });
    expect(
      (
        await fixture.runtime.app.inject({
          method: 'GET',
          url: '/api/v1/people?cpf=12345678900',
          headers: { cookie: activity.cookie },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await fixture.runtime.app.inject({
          method: 'GET',
          url: '/api/v1/duplicate-candidates?entityType=PERSON&name=Synthetic',
          headers: { cookie: activity.cookie },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await fixture.runtime.app.inject({
          method: 'GET',
          url: '/api/v1/people',
          headers: { cookie: fixture.adminCookie },
        })
      ).statusCode,
    ).toBe(403);
  });
  it('creates a person and first membership atomically without inventing birth date or documents', async () => {
    const actor = await fixture.operator('synthetic.social', [
      'SOCIAL_ASSISTANCE',
    ]);
    const familyResponse = await fixture.runtime.app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: fixture.headers(actor.cookie),
      payload: {},
    });
    const family = familyResponse.json().data;
    const response = await fixture.runtime.app.inject({
      method: 'POST',
      url: '/api/v1/people',
      headers: fixture.headers(actor.cookie),
      payload: {
        name: 'Synthetic Member',
        familyId: family.id,
        expectedFamilyRevision: family.revision,
        validFrom: '2026-01-01T00:00:00Z',
        isReference: true,
      },
    });
    expect(response.statusCode, response.body).toBe(201);
    expect(response.json().data).toMatchObject({
      person: {
        name: 'Synthetic Member',
        birthDate: null,
        cpf: null,
        sex: null,
        revision: 1,
      },
      membership: { familyId: family.id, isReference: true, validUntil: null },
      family: { revision: 2 },
    });
    const detail = await fixture.runtime.app.inject({
      method: 'GET',
      url: `/api/v1/families/${family.id}?asOf=2026-02-01T00:00:00Z`,
      headers: { cookie: actor.cookie },
    });
    expect(detail.json().data.family).toMatchObject({
      memberCount: 1,
      referencePersonName: 'Synthetic Member',
    });
    expect(detail.json().data.members).toHaveLength(1);
    const before = await fixture.runtime.app.inject({
      method: 'GET',
      url: `/api/v1/families/${family.id}?asOf=2025-12-31T23:59:59Z`,
      headers: { cookie: actor.cookie },
    });
    expect(before.json().data.family.memberCount).toBe(0);
  });
  it('replays one family for concurrent identical keys and rejects another intention or author', async () => {
    const actor = await fixture.operator('synthetic.social', [
      'SOCIAL_ASSISTANCE',
    ]);
    const request = {
      method: 'POST' as const,
      url: '/api/v1/families',
      headers: fixture.headers(actor.cookie),
      payload: { referenceName: 'Synthetic Replay' },
    };
    const responses = await Promise.all([
      fixture.runtime.app.inject(request),
      fixture.runtime.app.inject(request),
    ]);
    expect(responses.map((response) => response.statusCode)).toEqual([
      201, 201,
    ]);
    expect(responses[0]!.json()).toEqual(responses[1]!.json());
    const replay = await fixture.runtime.app.inject(request);
    expect(replay.statusCode, replay.body).toBe(201);
    expect(replay.json()).toEqual(responses[0]!.json());
    expect(
      (
        await fixture.runtime.app.inject({
          ...request,
          payload: { referenceName: 'Synthetic Different' },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      await fixture.runtime.database.auditEntry.count({
        where: { entityType: 'Family' },
      }),
    ).toBe(1);
    const other = await fixture.operator('synthetic.other', [
      'SOCIAL_ASSISTANCE',
    ]);
    expect(
      (
        await fixture.runtime.app.inject({
          ...request,
          headers: { ...request.headers, cookie: other.cookie },
        })
      ).statusCode,
    ).toBe(409);
  });
});
