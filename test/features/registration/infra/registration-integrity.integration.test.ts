import { describe, expect, it } from 'vitest';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';

const fixture = setupIntegrationFixture();

describe('PostgreSQL registration integrity', () => {
  it('enforces canonical CPF uniqueness under concurrent inserts and edits while permitting unknown CPF', async () => {
    const database = fixture.runtime.database;
    const attempts = await Promise.allSettled([
      database.person.create({
        data: { name: 'Synthetic First', cpf: '12345678909' },
      }),
      database.person.create({
        data: { name: 'Synthetic Second', cpf: '12345678909' },
      }),
    ]);
    expect(
      attempts.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      attempts.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    const unknown = await database.person.create({
      data: { name: 'Unknown CPF' },
    });
    await expect(
      database.person.create({ data: { name: 'Another unknown CPF' } }),
    ).resolves.toMatchObject({ cpf: null });
    await expect(
      database.person.update({
        where: { id: unknown.id },
        data: { cpf: '12345678909' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
  it('rejects overlapping membership, concurrent references and family code rewrites at the database boundary', async () => {
    const database = fixture.runtime.database;
    const family = await database.family.create({ data: {} });
    const otherFamily = await database.family.create({ data: {} });
    const first = await database.person.create({
      data: { name: 'Synthetic First' },
    });
    const second = await database.person.create({
      data: { name: 'Synthetic Second' },
    });
    const interval = {
      validFrom: new Date('2026-01-01T00:00:00Z'),
      validUntil: new Date('2026-02-01T00:00:00Z'),
    };
    await database.familyMembership.create({
      data: {
        ...interval,
        personId: first.id,
        familyId: family.id,
        isReference: true,
      },
    });
    await expect(
      database.familyMembership.create({
        data: { ...interval, personId: first.id, familyId: otherFamily.id },
      }),
    ).rejects.toThrow();
    await expect(
      database.familyMembership.create({
        data: {
          ...interval,
          personId: second.id,
          familyId: family.id,
          isReference: true,
        },
      }),
    ).rejects.toThrow();
    await expect(
      database.family.update({
        where: { id: family.id },
        data: { code: family.code + 1000n },
      }),
    ).rejects.toThrow();
    await expect(
      database.familyMembership.create({
        data: {
          personId: first.id,
          familyId: otherFamily.id,
          validFrom: interval.validUntil,
          isReference: true,
        },
      }),
    ).resolves.toMatchObject({ personId: first.id });
  });
  it('rolls back the person, membership, family revision and operation when audit persistence fails', async () => {
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
    const database = fixture.runtime.database;
    const before = await database.operationRecord.count();
    const request = {
      method: 'POST' as const,
      url: '/api/v1/people',
      headers: fixture.headers(actor.cookie),
      payload: {
        name: 'Synthetic Rollback',
        familyId: family.id,
        expectedFamilyRevision: 1,
        validFrom: '2026-01-01T00:00:00Z',
      },
    };
    await database.$executeRawUnsafe(
      'ALTER TABLE "AuditEntry" ADD CONSTRAINT test_reject_registration CHECK ("entityType" <> \'FamilyMembership\')',
    );
    try {
      expect((await fixture.runtime.app.inject(request)).statusCode).toBe(500);
      expect(await database.person.count()).toBe(0);
      expect(await database.familyMembership.count()).toBe(0);
      expect(
        (await database.family.findUniqueOrThrow({ where: { id: family.id } }))
          .revision,
      ).toBe(1);
      expect(await database.operationRecord.count()).toBe(before);
    } finally {
      await database.$executeRawUnsafe(
        'ALTER TABLE "AuditEntry" DROP CONSTRAINT test_reject_registration',
      );
    }
    expect((await fixture.runtime.app.inject(request)).statusCode).toBe(201);
  });
  it('allows only one concurrent first reference and refuses future effective reference changes', async () => {
    const first = await fixture.operator('synthetic.first', [
      'SOCIAL_ASSISTANCE',
    ]);
    const second = await fixture.operator('synthetic.second', [
      'SOCIAL_ASSISTANCE',
    ]);
    const familyResponse = await fixture.runtime.app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: fixture.headers(first.cookie),
      payload: {},
    });
    const family = familyResponse.json().data;
    const responses = await Promise.all(
      [first, second].map((actor, index) =>
        fixture.runtime.app.inject({
          method: 'POST',
          url: '/api/v1/people',
          headers: fixture.headers(actor.cookie),
          payload: {
            name: `Synthetic Reference ${index}`,
            familyId: family.id,
            expectedFamilyRevision: 1,
            validFrom: '2026-01-01T00:00:00Z',
            isReference: true,
          },
        }),
      ),
    );
    expect(responses.map((response) => response.statusCode).sort()).toEqual([
      201, 409,
    ]);
    const membership = responses
      .find((response) => response.statusCode === 201)!
      .json().data.membership;
    const future = await fixture.runtime.app.inject({
      method: 'POST',
      url: `/api/v1/families/${family.id}/reference-changes`,
      headers: fixture.headers(first.cookie),
      payload: {
        membershipId: membership.id,
        expectedRevision: 2,
        effectiveAt: '2099-01-01T00:00:00Z',
        reason: 'Synthetic future change',
      },
    });
    expect(future.statusCode, future.body).toBe(422);
    expect(future.json().error.details.rule).toBe('FUTURE_MEMBERSHIP');
  });
});
