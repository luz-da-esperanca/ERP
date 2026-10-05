import type {
  CreateUserInput,
  UpdateUserInput,
  ActivationInput,
  ResetPasswordInput,
  ChangePasswordInput,
  ListUsersInput,
  UserDto,
} from '@erp/contracts/access-api';
import type { Capability } from '@erp/contracts/access';
export interface Principal {
  user: UserDto;
  authVersion: number;
  sessionId: string;
}
export interface CredentialAccount {
  user: UserDto;
  passwordHash: string;
  authVersion: number;
}
export interface CommandContext {
  actor: Principal;
  key: string;
}
export interface AccountsStore {
  findByLogin(login: string): Promise<CredentialAccount | null>;
  findById(id: string): Promise<CredentialAccount | null>;
  list(input: ListUsersInput): Promise<{
    data: UserDto[];
    pagination: { page: number; pageSize: number; total: number };
  }>;
  create(
    context: CommandContext,
    input: CreateUserInput,
    passwordHash: string,
  ): Promise<UserDto>;
  update(
    context: CommandContext,
    id: string,
    input: UpdateUserInput,
  ): Promise<UserDto>;
  activate(
    context: CommandContext,
    id: string,
    input: ActivationInput,
  ): Promise<UserDto>;
  resetPassword(
    context: CommandContext,
    id: string,
    input: ResetPasswordInput,
    passwordHash: string,
  ): Promise<UserDto>;
  changePassword(
    actor: Principal,
    input: ChangePasswordInput,
    capturedRevision: number,
    passwordHash: string,
  ): Promise<UserDto>;
  bootstrap(input: CreateUserInput, passwordHash: string): Promise<UserDto>;
}
export interface StoredSession {
  id: string;
  userId: string;
  authVersion: number;
  createdAt: number;
  absoluteExpiresAt: number;
  lastActivityAt: number;
}
export interface SessionsStore {
  create(userId: string, authVersion: number): Promise<StoredSession>;
  read(id: string, touch: boolean): Promise<StoredSession | null>;
  delete(id: string): Promise<void>;
  assertAvailable(): Promise<void>;
  checkLogin(login: string, ip: string): Promise<void>;
  recordLoginFailure(login: string): Promise<void>;
  clearLoginFailures(login: string): Promise<void>;
}
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
  dummyHash: string;
}
export interface TokenSigner {
  sign(session: StoredSession): Promise<string>;
  verify(token: string): Promise<{ userId: string; sessionId: string }>;
}
export interface SessionDto {
  user: UserDto;
  roles: UserDto['roleCodes'];
  capabilities: Capability[];
}
