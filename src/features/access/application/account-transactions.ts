import type { Role } from '@erp/contracts/access';
import type { Account } from '../domain/account.js';
import type { CredentialAccount } from './ports.js';
import type { AccountAuditWriter } from '../../audit/application/account-audit.js';
import type { AuditActorType } from '../../audit/domain/account-audit.js';
import type { ListUsersInput, AccountPage } from './account-commands.js';

export interface AccountsReader {
  findByLogin(login: string): Promise<CredentialAccount | null>;
  findById(id: string): Promise<CredentialAccount | null>;
  list(input: ListUsersInput): Promise<AccountPage>;
}
export interface AccountCreation {
  login: string;
  displayName: string;
  passwordHash: string;
  roleCodes: Role[];
  active: boolean;
  mustChangePassword: boolean;
  revision: number;
  authVersion: number;
}
export interface AccountChanges {
  revision: number;
  displayName?: string;
  roleCodes?: Role[];
  active?: boolean;
  mustChangePassword?: boolean;
  passwordHash?: string;
  authVersion?: number;
}
export interface TransactionalAccounts {
  findByLogin(login: string): Promise<CredentialAccount | null>;
  findById(id: string): Promise<CredentialAccount | null>;
  count(): Promise<number>;
  countActiveAdministrators(): Promise<number>;
  create(input: AccountCreation): Promise<Account>;
  update(id: string, changes: AccountChanges): Promise<Account>;
  ensureRoles(
    roles: ReadonlyArray<{ code: Role; label: string }>,
  ): Promise<void>;
}
export interface AccountRevisionReference {
  entityType: 'UserAccount';
  entityId: string;
  revision: number;
}
export type AccountOperationType =
  | 'accounts.create'
  | 'accounts.update'
  | 'accounts.activation'
  | 'accounts.password.reset'
  | 'auth.password.change'
  | 'accounts.bootstrap';
export interface AccountOperation {
  id: string;
  actorId: string | null;
  fingerprintKeyId: string | null;
  requestFingerprint: string;
  resultReference: AccountRevisionReference;
}
export interface AccountOperationInput {
  type: AccountOperationType;
  key: string;
  actorType: AuditActorType;
  actorId: string | null;
  fingerprintKeyId: string | null;
  requestFingerprint: string;
}
export interface AccountOperations {
  find(
    type: AccountOperationType,
    key: string,
  ): Promise<AccountOperation | null>;
  create(input: AccountOperationInput): Promise<string>;
  complete(id: string, reference: AccountRevisionReference): Promise<void>;
}
export interface AccountTransaction {
  accounts: TransactionalAccounts;
  operations: AccountOperations;
  audit: AccountAuditWriter;
}
export interface AccountUnitOfWork {
  run<T>(
    accountIds: readonly string[],
    work: (transaction: AccountTransaction) => Promise<T>,
  ): Promise<T>;
}
export interface OperationFingerprints {
  currentKeyId: string;
  calculate(content: unknown, keyId: string | null): string;
  matches(first: string, second: string): boolean;
}
