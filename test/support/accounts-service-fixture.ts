import { vi } from 'vitest';
import { AccountsService } from '../../src/features/access/application/accounts-service.js';
import type {
  AccountTransaction,
  AccountUnitOfWork,
  AccountsReader,
  TransactionalAccounts,
  AccountOperations,
  OperationFingerprints,
} from '../../src/features/access/application/account-transactions.js';
import type { AccountAuditWriter } from '../../src/features/audit/application/account-audit.js';
import { createAccessServiceFixture } from './access-service-fixture.js';

export function createAccountsServiceFixture() {
  const { account, principal, user } = createAccessServiceFixture();
  const reader = {
    findByLogin: vi
      .fn<AccountsReader['findByLogin']>()
      .mockResolvedValue(account),
    findById: vi.fn<AccountsReader['findById']>().mockResolvedValue(account),
    list: vi.fn<AccountsReader['list']>(),
  } satisfies AccountsReader;
  const stored = {
    findByLogin: vi
      .fn<TransactionalAccounts['findByLogin']>()
      .mockResolvedValue(null),
    findById: vi
      .fn<TransactionalAccounts['findById']>()
      .mockResolvedValue(account),
    count: vi.fn<TransactionalAccounts['count']>().mockResolvedValue(0),
    countActiveAdministrators: vi
      .fn<TransactionalAccounts['countActiveAdministrators']>()
      .mockResolvedValue(2),
    create: vi.fn<TransactionalAccounts['create']>(),
    update: vi.fn<TransactionalAccounts['update']>(),
    ensureRoles: vi
      .fn<TransactionalAccounts['ensureRoles']>()
      .mockResolvedValue(undefined),
  } satisfies TransactionalAccounts;
  const operationId = '00000000-0000-4000-8000-000000000005';
  const operations = {
    find: vi.fn<AccountOperations['find']>().mockResolvedValue(null),
    create: vi.fn<AccountOperations['create']>().mockResolvedValue(operationId),
    complete: vi
      .fn<AccountOperations['complete']>()
      .mockResolvedValue(undefined),
  } satisfies AccountOperations;
  const audit = {
    append: vi.fn<AccountAuditWriter['append']>().mockResolvedValue(undefined),
    readRevision: vi.fn<AccountAuditWriter['readRevision']>(),
  } satisfies AccountAuditWriter;
  const transaction: AccountTransaction = {
    accounts: stored,
    operations,
    audit,
  };
  const unitOfWork: AccountUnitOfWork = {
    run: async (_ids, work) => work(transaction),
  };
  const fingerprints = {
    currentKeyId: 'v2',
    calculate: vi
      .fn<OperationFingerprints['calculate']>()
      .mockReturnValue('protected-fingerprint'),
    matches: vi.fn<OperationFingerprints['matches']>().mockReturnValue(true),
  } satisfies OperationFingerprints;
  const key = '00000000-0000-4000-8000-000000000004';
  const context = { actor: principal, key };
  const service = new AccountsService(
    reader,
    unitOfWork,
    fingerprints,
    () => key,
  );
  return {
    service,
    reader,
    stored,
    operations,
    audit,
    fingerprints,
    account,
    user,
    principal,
    context,
    operationId,
  };
}
