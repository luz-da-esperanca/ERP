import { describe, expect, it } from 'vitest';
import { missingFields } from '../../../../src/features/registration/domain/missing-data-rules.js';

describe('Selected missing registration data', () => {
  it('flags only selected unknown values without treating zero or false as missing', () => {
    expect(
      missingFields(['cpf', 'contactPhone', 'birthDate'], {
        cpf: null,
        contactPhone: '  ',
        birthDate: '2000-01-01',
        sex: null,
      }),
    ).toEqual(['contactPhone', 'cpf']);
    expect(missingFields([], { cpf: null })).toEqual([]);
    expect(
      missingFields(['amount', 'known'], { amount: 0, known: false }),
    ).toEqual([]);
  });
});
