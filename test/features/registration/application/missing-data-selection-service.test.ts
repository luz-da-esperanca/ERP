import { describe, expect, it, vi } from 'vitest';
import { MissingDataSelectionService } from '../../../../src/features/registration/application/missing-data-selection-service.js';
import type {
  MissingDataSelectionStore,
  MissingDataSelectionTransaction,
} from '../../../../src/features/registration/application/missing-data-ports.js';
import { createAccessServiceFixture } from '../../../support/access-service-fixture.js';
import { createAccountsServiceFixture } from '../../../support/accounts-service-fixture.js';

describe('Missing data selection publication', () => {
  it('revalidates the author, publishes an explicit version and reconciles existing canonical records in the same operation', async () => {
    const { principal } = createAccessServiceFixture();
    principal.user.roleCodes = ['COORDINATION'];
    const selection = {
      id: 'selection',
      version: 1,
      personFields: ['cpf'],
      familyFields: [],
      decisionReference: 'Synthetic selection',
      recordedBy: principal.user.id,
      recordedAt: '2026-01-01T00:00:00.000Z',
    };
    const tx = {
      findActor: vi.fn().mockResolvedValue(principal),
      findOperation: vi.fn().mockResolvedValue(null),
      createOperation: vi.fn().mockResolvedValue('operation'),
      completeOperation: vi.fn(),
      selectionRevision: vi.fn().mockResolvedValue(selection),
      publishSelection: vi.fn().mockResolvedValue(selection),
      auditSelection: vi.fn(),
      entities: vi
        .fn()
        .mockResolvedValue([
          { entityType: 'PERSON', id: 'person', fields: { cpf: null } },
        ]),
      missingData: {
        selection: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValue(selection),
        openIssues: vi.fn().mockResolvedValue([]),
        createIssue: vi.fn(),
        closeIssue: vi.fn(),
      },
    } satisfies MissingDataSelectionTransaction;
    const store: MissingDataSelectionStore = {
      current: vi.fn().mockResolvedValue(null),
      run: async (_actor, work) => work(tx),
    };
    const service = new MissingDataSelectionService(
      store,
      createAccountsServiceFixture().fingerprints,
      () => selection.recordedAt,
    );
    expect(
      await service.publish(
        { actor: principal, key: 'key' },
        {
          expectedVersion: null,
          personFields: ['cpf'],
          familyFields: [],
          decisionReference: selection.decisionReference,
        },
      ),
    ).toEqual(selection);
    expect(tx.missingData.createIssue).toHaveBeenCalledWith(
      'operation',
      principal.user.id,
      'PERSON',
      'person',
      'cpf',
    );
    expect(tx.auditSelection).toHaveBeenCalledWith(
      'operation',
      principal.user.id,
      selection,
    );
    vi.mocked(tx.findActor).mockResolvedValue({
      ...principal,
      authVersion: principal.authVersion + 1,
    });
    await expect(
      service.publish(
        { actor: principal, key: 'another' },
        {
          expectedVersion: 1,
          personFields: [],
          familyFields: [],
          decisionReference: 'Synthetic withdrawal',
        },
      ),
    ).rejects.toMatchObject({ message: 'Authentication required' });
    expect(tx.publishSelection).toHaveBeenCalledTimes(1);
  });
});
