import { describe, expect, it } from 'vitest';
import { ApplicationError } from '../../../src/modules/shared/errors.ts';
import {
  BAZAR_TRANSFER_STOCK_ORIGIN_ID,
  CREATABLE_STOCK_ORIGIN_KINDS,
  STOCK_ORIGIN_KINDS,
  SYSTEM_STOCK_ORIGIN_DEFINITIONS,
  UNKNOWN_STOCK_ORIGIN_ID,
  isExternalDonation,
  isSystemManaged,
  toStockOriginView,
  validateCreateStockOriginInput,
  type StockOriginRecord,
} from '../../../src/modules/social-stock/domain/stock-origin-types.ts';

const SYSTEM_UNKNOWN = SYSTEM_STOCK_ORIGIN_DEFINITIONS.find((definition) => definition.kind === 'UNKNOWN');
const SYSTEM_BAZAR = SYSTEM_STOCK_ORIGIN_DEFINITIONS.find((definition) => definition.kind === 'BAZAR_TRANSFER');

function expectValidationFailure(run: () => unknown, field: string): ApplicationError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ApplicationError);
    const applicationError = error as ApplicationError;
    expect(applicationError.status).toBe(422);
    expect(applicationError.code).toBe('VALIDATION_FAILED');
    expect(applicationError.errors?.map((entry) => entry.field)).toContain(field);
    return applicationError;
  }
  throw new Error('Expected validation to fail, but it succeeded.');
}

describe('Stock Origin domain (G-02 / RF-EST-02 / RF-EST-03 / RF-BAZ-04)', () => {
  it('exposes the five documented kinds and only the three named donation kinds as creatable', () => {
    expect([...STOCK_ORIGIN_KINDS]).toEqual([
      'INDIVIDUAL_DONOR',
      'COMPANY_DONOR',
      'CAMPAIGN',
      'UNKNOWN',
      'BAZAR_TRANSFER',
    ]);
    expect([...CREATABLE_STOCK_ORIGIN_KINDS]).toEqual([
      'INDIVIDUAL_DONOR',
      'COMPANY_DONOR',
      'CAMPAIGN',
    ]);
    for (const kind of CREATABLE_STOCK_ORIGIN_KINDS) {
      expect(STOCK_ORIGIN_KINDS).toContain(kind);
    }
  });

  it('treats the Bazar transfer as the only internal, non-donation kind', () => {
    expect(isExternalDonation('INDIVIDUAL_DONOR')).toBe(true);
    expect(isExternalDonation('COMPANY_DONOR')).toBe(true);
    expect(isExternalDonation('CAMPAIGN')).toBe(true);
    expect(isExternalDonation('UNKNOWN')).toBe(true);
    expect(isExternalDonation('BAZAR_TRANSFER')).toBe(false);
  });

  it('recognizes only the unknown origin and the Bazar transfer as system-managed', () => {
    expect(isSystemManaged('UNKNOWN')).toBe(true);
    expect(isSystemManaged('BAZAR_TRANSFER')).toBe(true);
    expect(isSystemManaged('INDIVIDUAL_DONOR')).toBe(false);
    expect(isSystemManaged('COMPANY_DONOR')).toBe(false);
    expect(isSystemManaged('CAMPAIGN')).toBe(false);
  });

  it('defines exactly two system records with the agreed stable identifiers and Portuguese names', () => {
    expect(SYSTEM_STOCK_ORIGIN_DEFINITIONS).toHaveLength(2);
    expect(SYSTEM_UNKNOWN).toBeDefined();
    expect(SYSTEM_BAZAR).toBeDefined();
    expect(SYSTEM_UNKNOWN?.id).toBe(UNKNOWN_STOCK_ORIGIN_ID);
    expect(SYSTEM_UNKNOWN?.name).toBe('Origem desconhecida');
    expect(SYSTEM_BAZAR?.id).toBe(BAZAR_TRANSFER_STOCK_ORIGIN_ID);
    expect(SYSTEM_BAZAR?.name).toBe('Transferência do Bazar');
    const systemIds = SYSTEM_STOCK_ORIGIN_DEFINITIONS.map((definition) => definition.id);
    expect(new Set(systemIds).size).toBe(2);
    for (const definition of SYSTEM_STOCK_ORIGIN_DEFINITIONS) {
      expect(isSystemManaged(definition.kind)).toBe(true);
      expect(definition.name.trim().length).toBeGreaterThan(0);
    }
  });

  it('accepts the three creatable kinds and trims the name', () => {
    for (const kind of CREATABLE_STOCK_ORIGIN_KINDS) {
      expect(validateCreateStockOriginInput({ kind, name: `  Synthetic ${kind}  ` })).toEqual({
        kind,
        name: `Synthetic ${kind}`,
      });
    }
    expect(validateCreateStockOriginInput({ kind: 'CAMPAIGN', name: 'x'.repeat(150) }).name).toHaveLength(150);
  });

  it('rejects system-managed kinds with a validation error', () => {
    expectValidationFailure(() => validateCreateStockOriginInput({ kind: 'UNKNOWN', name: 'Ignorada' }), 'kind');
    expectValidationFailure(() => validateCreateStockOriginInput({ kind: 'BAZAR_TRANSFER', name: 'Transferida' }), 'kind');
  });

  it('rejects unknown or malformed kinds', () => {
    for (const kind of ['DONOR', 'INDIVIDUAL_DONOR ', 42, null, undefined, ['CAMPAIGN']]) {
      expectValidationFailure(() => validateCreateStockOriginInput({ kind, name: 'Synthetic Origin' }), 'kind');
    }
  });

  it('rejects missing, empty, whitespace-only, or oversized names', () => {
    for (const name of [undefined, null, 7, '', '   ', '\t\n', 'x'.repeat(151)]) {
      expectValidationFailure(() => validateCreateStockOriginInput({ kind: 'CAMPAIGN', name }), 'name');
    }
  });

  it('reports both problems when kind and name are invalid', () => {
    const error = expectValidationFailure(
      () => validateCreateStockOriginInput({ kind: 'UNKNOWN', name: '   ' }),
      'kind',
    );
    expect(error.errors?.map((entry) => entry.field)).toContain('name');
  });

  it('maps a record to a view with derived flags and no financial or CRM fields', () => {
    const record: StockOriginRecord = {
      id: '01963000-0000-7000-8000-000000000701',
      kind: 'UNKNOWN',
      name: 'Origem desconhecida',
      createdAt: '2026-10-25T12:00:00.000Z',
    };
    expect(toStockOriginView(record)).toEqual({
      id: '01963000-0000-7000-8000-000000000701',
      kind: 'UNKNOWN',
      name: 'Origem desconhecida',
      isExternalDonation: true,
      isSystemManaged: true,
      createdAt: '2026-10-25T12:00:00.000Z',
    });

    const forbiddenKeys = [
      'value',
      'estimatedValue',
      'amount',
      'cpf',
      'cnpj',
      'email',
      'phone',
      'address',
      'campaignGoal',
      'active',
      'version',
      'updatedAt',
    ];
    const unknownOrigin = toStockOriginView({
      id: '01963000-0000-7000-8000-000000000702',
      kind: 'BAZAR_TRANSFER',
      name: 'Transferência do Bazar',
      createdAt: '2026-10-25T12:00:00.000Z',
    });
    expect(unknownOrigin.isExternalDonation).toBe(false);
    expect(unknownOrigin.isSystemManaged).toBe(true);
    for (const key of forbiddenKeys) {
      expect(Object.keys(unknownOrigin)).not.toContain(key);
    }
  });
});
