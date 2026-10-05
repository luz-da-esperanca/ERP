import type {
  ChangePasswordInput,
  CreateUserInput,
  ResetPasswordInput,
} from '@erp/contracts/access-api';
import { assertRevision } from '../domain/account-rules.js';
import { capabilitiesFor } from '../domain/permissions.js';
import { unauthenticated } from '../../../core/errors.js';
import type {
  AccountsStore,
  PasswordHasher,
  SessionsStore,
  TokenSigner,
  Principal,
  SessionDto,
  CommandContext,
} from './ports.js';

export class AccessService {
  constructor(
    readonly accounts: AccountsStore,
    readonly sessions: SessionsStore,
    private readonly passwords: PasswordHasher,
    private readonly tokens: TokenSigner,
  ) {}
  async login(login: string, password: string, ip: string) {
    await this.sessions.checkLogin(login, ip);
    const account = await this.accounts.findByLogin(login);
    const valid = await this.passwords.compare(
      password,
      account?.user.active ? account.passwordHash : this.passwords.dummyHash,
    );
    if (!account?.user.active || !valid) {
      await this.sessions.recordLoginFailure(login);
      throw unauthenticated();
    }
    const current = await this.accounts.findById(account.user.id);
    if (
      !current?.user.active ||
      current.authVersion !== account.authVersion ||
      current.passwordHash !== account.passwordHash
    )
      throw unauthenticated();
    await this.sessions.clearLoginFailures(login);
    const session = await this.sessions.create(
      current.user.id,
      current.authVersion,
    );
    return {
      token: await this.tokens.sign(session),
      data: this.describe({
        user: current.user,
        authVersion: current.authVersion,
        sessionId: session.id,
      }),
    };
  }
  async authenticate(token: string | undefined): Promise<Principal> {
    if (!token) throw unauthenticated();
    const claims = await this.tokens.verify(token);
    const session = await this.sessions.read(claims.sessionId, false);
    if (!session || session.userId !== claims.userId) throw unauthenticated();
    const account = await this.accounts.findById(claims.userId);
    if (!account?.user.active || account.authVersion !== session.authVersion)
      throw unauthenticated();
    if (!(await this.sessions.read(claims.sessionId, true)))
      throw unauthenticated();
    return {
      user: account.user,
      authVersion: account.authVersion,
      sessionId: claims.sessionId,
    };
  }
  describe(principal: Principal): SessionDto {
    return {
      user: principal.user,
      roles: principal.user.roleCodes,
      capabilities: capabilitiesFor(principal.user.roleCodes),
    };
  }
  async logout(token: string | undefined) {
    await this.sessions.assertAvailable();
    if (!token) return;
    let sessionId: string;
    try {
      sessionId = (await this.tokens.verify(token)).sessionId;
    } catch {
      return;
    }
    await this.sessions.delete(sessionId);
  }
  async changePassword(principal: Principal, input: ChangePasswordInput) {
    const captured = await this.accounts.findById(principal.user.id);
    if (
      !captured?.user.active ||
      captured.authVersion !== principal.authVersion
    )
      throw unauthenticated();
    assertRevision(captured.user.revision, input.expectedRevision);
    if (
      !(await this.passwords.compare(
        input.currentPassword,
        captured.passwordHash,
      ))
    )
      throw unauthenticated();
    return this.accounts.changePassword(
      principal,
      input,
      captured.user.revision,
      await this.passwords.hash(input.newPassword),
    );
  }
  hash(password: string) {
    return this.passwords.hash(password);
  }
  async createUser(context: CommandContext, input: CreateUserInput) {
    return this.accounts.create(
      context,
      input,
      await this.passwords.hash(input.initialPassword),
    );
  }
  async resetPassword(
    context: CommandContext,
    id: string,
    input: ResetPasswordInput,
  ) {
    return this.accounts.resetPassword(
      context,
      id,
      input,
      await this.passwords.hash(input.temporaryPassword),
    );
  }
}
