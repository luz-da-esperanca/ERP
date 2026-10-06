import { describe, expect, it, vi } from 'vitest';
import { reconcileMissingData } from '../../../../src/features/registration/application/missing-data.js';
import type { MissingDataTransaction } from '../../../../src/features/registration/application/missing-data-ports.js';
import type { QualityIssue } from '../../../../src/features/registration/domain/data-quality.js';

const issue = (id: string, fieldKey: string): QualityIssue => ({
  id,
  entityType: 'PERSON',
  entityId: 'person',
  kind: 'MISSING_DATA',
  fieldKeys: [fieldKey],
  candidateIds: [],
  identifiedAt: '2026-01-01T00:00:00.000Z',
  resolvedAt: null,
  resolvedBy: null,
  resolution: null,
  reason: null,
  revision: 1,
});

describe('Missing data occurrence lifecycle', () => {
  it('creates only new missing fields, closes completed or unselected ones and leaves existing open occurrences unchanged', async () => {
    const transaction = {
      selection: vi
        .fn<MissingDataTransaction['selection']>()
        .mockResolvedValue({
          id: 'selection',
          version: 1,
          decisionReference: 'Synthetic selection',
          recordedAt: '2026-01-01T00:00:00.000Z',
          recordedBy: 'actor',
          personFields: ['cpf', 'contactPhone'],
          familyFields: [],
        }),
      openIssues: vi
        .fn<MissingDataTransaction['openIssues']>()
        .mockResolvedValue([issue('old-cpf', 'cpf'), issue('old-rg', 'rg')]),
      createIssue: vi.fn(),
      closeIssue: vi.fn(),
    } satisfies MissingDataTransaction;
    await reconcileMissingData(
      transaction,
      'operation',
      'actor',
      'PERSON',
      'person',
      { cpf: '12345678909', contactPhone: null },
    );
    expect(transaction.createIssue).toHaveBeenCalledWith(
      'operation',
      'actor',
      'PERSON',
      'person',
      'contactPhone',
    );
    expect(transaction.closeIssue).toHaveBeenCalledWith(
      'operation',
      'actor',
      expect.objectContaining({ id: 'old-cpf' }),
      'COMPLETED',
    );
    expect(transaction.closeIssue).toHaveBeenCalledWith(
      'operation',
      'actor',
      expect.objectContaining({ id: 'old-rg' }),
      'NOT_TRACKED',
    );
    vi.mocked(transaction.createIssue).mockClear();
    vi.mocked(transaction.closeIssue).mockClear();
    vi.mocked(transaction.openIssues).mockResolvedValue([
      issue('existing-phone', 'contactPhone'),
    ]);
    await reconcileMissingData(
      transaction,
      'operation',
      'actor',
      'PERSON',
      'person',
      { cpf: '12345678909', contactPhone: null },
    );
    expect(transaction.createIssue).not.toHaveBeenCalled();
    expect(transaction.closeIssue).not.toHaveBeenCalled();
  });
});
