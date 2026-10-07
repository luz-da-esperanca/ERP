import { describe, expect, it } from 'vitest';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';

const fixture = setupIntegrationFixture();
async function registeredPerson() {
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
  const personResponse = await fixture.runtime.app.inject({
    method: 'POST',
    url: '/api/v1/people',
    headers: fixture.headers(actor.cookie),
    payload: {
      name: 'Synthetic Original',
      familyId: family.id,
      expectedFamilyRevision: 1,
      validFrom: '2026-01-01T00:00:00Z',
    },
  });
  return { actor, ...personResponse.json().data };
}

describe('Registration corrections and quality history', () => {
  it('corrects a declared interval with a reason and rejects overlap without changing either family', async () => {
    const { actor, person, family, membership } = await registeredPerson();
    const request = {
      method: 'PATCH' as const,
      url: `/api/v1/memberships/${membership.id}`,
      headers: fixture.headers(actor.cookie),
      payload: {
        expectedRevision: 1,
        expectedFamilyRevision: 2,
        validFrom: '2025-12-01T00:00:00Z',
        relationshipToReference: 'Synthetic relationship',
        reason: 'Synthetic initial date correction',
      },
    };
    const corrected = await fixture.runtime.app.inject(request);
    expect(corrected.statusCode, corrected.body).toBe(200);
    expect(corrected.json().data).toMatchObject({
      membership: { validFrom: '2025-12-01T00:00:00.000Z', revision: 2 },
      family: { revision: 3 },
    });
    expect((await fixture.runtime.app.inject(request)).json()).toEqual(
      corrected.json(),
    );
    const target = (
      await fixture.runtime.app.inject({
        method: 'POST',
        url: '/api/v1/families',
        headers: fixture.headers(actor.cookie),
        payload: {},
      })
    ).json().data;
    const transfer = await fixture.runtime.app.inject({
      method: 'POST',
      url: `/api/v1/people/${person.id}/membership-transfers`,
      headers: fixture.headers(actor.cookie),
      payload: {
        membershipId: membership.id,
        targetFamilyId: target.id,
        expectedMembershipRevision: 2,
        expectedSourceFamilyRevision: 3,
        expectedTargetFamilyRevision: 1,
        effectiveAt: '2026-02-01T00:00:00Z',
        reason: 'Synthetic transfer',
      },
    });
    expect(transfer.statusCode, transfer.body).toBe(200);
    const rejected = await fixture.runtime.app.inject({
      ...request,
      headers: fixture.headers(actor.cookie),
      payload: {
        expectedRevision: 3,
        expectedFamilyRevision: 4,
        validUntil: '2026-03-01T00:00:00Z',
        reason: 'Synthetic overlap correction',
      },
    });
    expect(rejected.statusCode, rejected.body).toBe(409);
    expect(rejected.json().error.details.rule).toBe('MEMBERSHIP_OVERLAP');
    const detail = await fixture.runtime.app.inject({
      method: 'GET',
      url: `/api/v1/people/${person.id}`,
      headers: { cookie: actor.cookie },
    });
    expect(
      detail
        .json()
        .data.memberships.find(
          (row: { id: string }) => row.id === membership.id,
        ).validUntil,
    ).toBe('2026-02-01T00:00:00.000Z');
    const audit = await fixture.runtime.app.inject({
      method: 'GET',
      url: `/api/v1/audit-entries?entityType=FamilyMembership&entityId=${membership.id}`,
      headers: { cookie: actor.cookie },
    });
    expect(audit.json().data).toHaveLength(3);
    expect(
      audit
        .json()
        .data.find((entry: { action: string }) => entry.action === 'CORRECT'),
    ).toMatchObject({
      before: { validFrom: '2026-01-01T00:00:00.000Z' },
      after: { validFrom: '2025-12-01T00:00:00.000Z' },
      reason: 'Synthetic initial date correction',
    });
    expect(family.id).toBe(membership.familyId);
  });
  it('permits namesakes without creating a duplicate review issue and keeps quality history protected', async () => {
    const { actor, person, family } = await registeredPerson();
    const another = await fixture.runtime.app.inject({
      method: 'POST',
      url: '/api/v1/people',
      headers: fixture.headers(actor.cookie),
      payload: {
        name: 'Different identity',
        familyId: family.id,
        expectedFamilyRevision: 2,
        validFrom: '2026-01-01T00:00:00Z',
      },
    });
    expect(another.statusCode, another.body).toBe(201);
    const other = another.json().data.person;
    const update = await fixture.runtime.app.inject({
      method: 'PATCH',
      url: `/api/v1/people/${other.id}`,
      headers: fixture.headers(actor.cookie),
      payload: { expectedRevision: 1, name: person.name },
    });
    expect(update.statusCode, update.body).toBe(200);
    const query = {
      method: 'GET' as const,
      url: '/api/v1/data-quality-issues?entityType=PERSON&status=OPEN',
      headers: { cookie: actor.cookie },
    };
    const issues = await fixture.runtime.app.inject(query);
    expect(issues.statusCode, issues.body).toBe(200);
    expect(issues.json().data).toHaveLength(0);
    expect(update.json().data.name).toBe(person.name);
    expect(await fixture.runtime.database.person.count()).toBe(2);
    const activity = await fixture.operator('synthetic.activity', [
      'ACTIVITY_MANAGER',
    ]);
    expect(
      (
        await fixture.runtime.app.inject({
          ...query,
          headers: { cookie: activity.cookie },
        })
      ).statusCode,
    ).toBe(403);
  });
});
