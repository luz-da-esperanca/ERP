import { vi } from 'vitest';
import type { UserDto } from '@erp/contracts/access-api';
import { AccessService } from '../../src/features/access/application/access-service.js';
import type {
  AccountsStore,
  CredentialAccount,
  PasswordHasher,
  Principal,
  SessionsStore,
  StoredSession,
  TokenSigner,
} from '../../src/features/access/application/ports.js';

export function createAccessServiceFixture() {
  const user: UserDto = {
    id: '00000000-0000-4000-8000-000000000001',
    login: 'test.operator',
    displayName: 'Synthetic Operator',
    active: true,
    mustChangePassword: false,
    revision: 3,
    roleCodes: ['ADMINISTRATOR'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };
  const account: CredentialAccount = {
    user,
    passwordHash: 'stored-password-hash',
    authVersion: 2,
  };
  const session: StoredSession = {
    id: '00000000-0000-4000-8000-000000000002',
    userId: user.id,
    authVersion: account.authVersion,
    createdAt: Date.parse('2026-01-02T00:00:00.000Z'),
    absoluteExpiresAt: Date.parse('2026-01-02T08:00:00.000Z'),
    lastActivityAt: Date.parse('2026-01-02T00:00:00.000Z'),
  };
  const principal: Principal = {
    user,
    authVersion: account.authVersion,
    sessionId: session.id,
  };
  const accounts = {
    findByLogin: vi
      .fn<AccountsStore['findByLogin']>()
      .mockResolvedValue(account),
    findById: vi.fn<AccountsStore['findById']>().mockResolvedValue(account),
    list: vi.fn<AccountsStore['list']>(),
    create: vi.fn<AccountsStore['create']>(),
    update: vi.fn<AccountsStore['update']>(),
    activate: vi.fn<AccountsStore['activate']>(),
    resetPassword: vi.fn<AccountsStore['resetPassword']>(),
    changePassword: vi.fn<AccountsStore['changePassword']>(),
    bootstrap: vi.fn<AccountsStore['bootstrap']>(),
  } satisfies AccountsStore;
  const sessions = {
    create: vi.fn<SessionsStore['create']>().mockResolvedValue(session),
    read: vi.fn<SessionsStore['read']>().mockResolvedValue(session),
    delete: vi.fn<SessionsStore['delete']>().mockResolvedValue(undefined),
    assertAvailable: vi
      .fn<SessionsStore['assertAvailable']>()
      .mockResolvedValue(undefined),
    checkLogin: vi
      .fn<SessionsStore['checkLogin']>()
      .mockResolvedValue(undefined),
    recordLoginFailure: vi
      .fn<SessionsStore['recordLoginFailure']>()
      .mockResolvedValue(undefined),
    clearLoginFailures: vi
      .fn<SessionsStore['clearLoginFailures']>()
      .mockResolvedValue(undefined),
  } satisfies SessionsStore;
  const passwords = {
    dummyHash: 'dummy-password-hash',
    hash: vi
      .fn<PasswordHasher['hash']>()
      .mockResolvedValue('new-password-hash'),
    compare: vi.fn<PasswordHasher['compare']>().mockResolvedValue(true),
  } satisfies PasswordHasher;
  const tokens = {
    sign: vi
      .fn<TokenSigner['sign']>()
      .mockResolvedValue('signed-session-token'),
    verify: vi
      .fn<TokenSigner['verify']>()
      .mockResolvedValue({ userId: user.id, sessionId: session.id }),
  } satisfies TokenSigner;
  return {
    service: new AccessService(accounts, sessions, passwords, tokens),
    accounts,
    sessions,
    passwords,
    tokens,
    user,
    account,
    session,
    principal,
    password: 'synthetic-password',
    token: 'signed-session-token',
    ip: '127.0.0.1',
  };
}
