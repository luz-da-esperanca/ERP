import { describe, expect, it } from 'vitest';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';

const fixture = setupIntegrationFixture();

describe('PostgreSQL registration integrity', () => {
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
});
