import { describe, expect, it } from 'vitest';
import {
  missingDataSelectionInputSchema,
  dataQualityIssueSchema,
} from '../src/data-quality-api';

describe('Registration data quality contracts', () => {
  it('requires explicit unique supported field selections and a decision reference without presuming required documents', () => {
    expect(
      missingDataSelectionInputSchema.parse({
        expectedVersion: null,
        personFields: [],
        familyFields: [],
        decisionReference: 'Synthetic demonstration selection',
      }),
    ).toMatchObject({ personFields: [], familyFields: [] });
    for (const fields of [['cpf', 'cpf'], ['religion'], ['name']])
      expect(
        missingDataSelectionInputSchema.safeParse({
          expectedVersion: null,
          personFields: fields,
          familyFields: [],
          decisionReference: 'Synthetic demonstration selection',
        }).success,
      ).toBe(false);
    expect(
      missingDataSelectionInputSchema.safeParse({
        expectedVersion: null,
        personFields: ['cpf'],
        familyFields: [],
        decisionReference: '',
      }).success,
    ).toBe(false);
    expect(
      dataQualityIssueSchema.safeParse({
        id: '00000000-0000-4000-8000-000000000001',
        entityType: 'PERSON',
        entityId: '00000000-0000-4000-8000-000000000002',
        kind: 'MISSING_DATA',
        candidateIds: [],
        fieldKeys: ['cpf'],
        identifiedAt: '2026-01-01T00:00:00.000Z',
        resolvedAt: '2026-01-02T00:00:00.000Z',
        resolution: 'COMPLETED',
        resolvedBy: '00000000-0000-4000-8000-000000000003',
        reason: 'Selected field completed',
        revision: 2,
      }).success,
    ).toBe(true);
  });
});
