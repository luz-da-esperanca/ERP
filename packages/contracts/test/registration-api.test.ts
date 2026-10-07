import { describe, expect, it } from 'vitest';
import {
  createFamilySchema,
  createRegisteredPersonSchema,
  updateFamilySchema,
  listFamiliesSchema,
  updatePersonSchema,
} from '../src/registration-api';

describe('Registration HTTP inputs', () => {
  it('validates CPF check digits for creation and edits and rejects a person duplicate override', () => {
    const input = {
      name: 'Synthetic Person',
      familyId: '00000000-0000-4000-8000-000000000001',
      expectedFamilyRevision: 1,
      validFrom: '2026-01-01T00:00:00Z',
    };
    expect(
      createRegisteredPersonSchema.safeParse({ ...input, cpf: '12345678900' })
        .success,
    ).toBe(false);
    expect(
      updatePersonSchema.safeParse({ expectedRevision: 1, cpf: '11111111111' })
        .success,
    ).toBe(false);
    expect(
      createRegisteredPersonSchema.safeParse({
        ...input,
        duplicateReview: {
          candidateIds: [input.familyId],
          decision: 'DISTINCT',
          reason: 'Override',
        },
      }).success,
    ).toBe(false);
    expect(
      updatePersonSchema.parse({ expectedRevision: 1, cpf: '123.456.789-09' })
        .cpf,
    ).toBe('12345678909');
  });
  it('normalizes blank optional civil dates and rejects a family code outside PostgreSQL bigint range', () => {
    expect(
      createRegisteredPersonSchema.parse({
        name: 'Synthetic Person',
        birthDate: '  ',
        familyId: '00000000-0000-4000-8000-000000000001',
        expectedFamilyRevision: 1,
        validFrom: '2026-01-01T00:00:00Z',
      }).birthDate,
    ).toBeNull();
    expect(
      listFamiliesSchema.safeParse({ code: '9999999999999999999' }).success,
    ).toBe(false);
    expect(listFamiliesSchema.parse({ code: '9223372036854775807' }).code).toBe(
      '9223372036854775807',
    );
  });
  it('normalizes empty optional fields to unknown while rejecting malformed supplied values', () => {
    const input = {
      name: 'Synthetic Person',
      familyId: '00000000-0000-4000-8000-000000000001',
      expectedFamilyRevision: 1,
      validFrom: '2026-01-01T00:00:00Z',
      cpf: '  ',
      birthDate: '',
    };
    expect(createRegisteredPersonSchema.parse(input)).toMatchObject({
      cpf: null,
      birthDate: null,
    });
    expect(createFamilySchema.parse({ postalCode: '' })).toMatchObject({
      postalCode: null,
    });
    expect(
      createRegisteredPersonSchema.safeParse({ ...input, cpf: '123' }).success,
    ).toBe(false);
  });
  it('allows unknown personal data, normalizes supplied documents and preserves omitted patch fields', () => {
    expect(createFamilySchema.parse({})).toMatchObject({
      address: null,
      referenceName: null,
    });
    const person = createRegisteredPersonSchema.parse({
      name: ' Synthetic Person ',
      cpf: '123.456.789-09',
      familyId: '00000000-0000-4000-8000-000000000001',
      expectedFamilyRevision: 1,
      validFrom: '2026-01-01T00:00:00-03:00',
    });
    expect(person).toMatchObject({
      name: 'Synthetic Person',
      cpf: '12345678909',
      birthDate: null,
      sex: null,
      isReference: false,
    });
    expect(
      updateFamilySchema.parse({ expectedRevision: 1, address: null }),
    ).toEqual({
      expectedRevision: 1,
      address: null,
    });
    expect(createFamilySchema.safeParse({ recordedBy: 'caller' }).success).toBe(
      false,
    );
  });
});
