import type { Account } from '../domain/account.js';
import type { Role } from '@erp/contracts/access';
import {
  planAccountProfileChange,
  planAccountActivation,
  assertRevision,
} from '../domain/account-rules.js';
import {
  activityResponsibleRoles,
  assertPermission,
  capabilitiesFor,
  roleLabels,
} from '../domain/permissions.js';
import { AccountRuleError } from '../domain/account-errors.js';
import { AuthenticationRequiredError } from './access-errors.js';
import {
  IdempotencyConflictError,
  ResourceNotFoundError,
} from '../../../core/application/errors.js';
import type { AccountAuditAction } from '../../audit/application/account-audit.js';
import type {
  AccountsReader,
  AccountUnitOfWork,
  OperationFingerprints,
  AccountTransaction,
  AccountOperationType,
} from './account-transactions.js';
import type { AccountsStore, CommandContext, Principal } from './ports.js';
import type {
  CreateUserInput,
  UpdateUserInput,
  ActivationInput,
  ResetPasswordInput,
  ChangePasswordInput,
  ListUsersInput,
  ResponsibleCandidatesInput,
} from './account-commands.js';

interface AccountMutation {
  account: Account;
  before: Account | null;
  action: AccountAuditAction;
  changed: boolean;
  reason?: string;
}

export class AccountsService implements AccountsStore {
  constructor(
    private readonly reader: AccountsReader,
    private readonly unitOfWork: AccountUnitOfWork,
    private readonly fingerprints: OperationFingerprints,
    private readonly operationKey: () => string,
  ) {}

  findByLogin(login: string) {
    return this.reader.findByLogin(login);
  }
  findById(id: string) {
    return this.reader.findById(id);
  }
  async list(actor: Principal, input: ListUsersInput) {
    assertPermission(
      actor.user.roleCodes,
      actor.user.mustChangePassword,
      'accounts.manage',
    );
    return this.reader.list(input);
  }
  /**
   * Minimal directory for choosing a responsible. It is not account
   * administration: only who designates a responsible may read it.
   */
  async responsibleCandidates(
    actor: Principal,
    input: ResponsibleCandidatesInput,
  ) {
    const capabilities = capabilitiesFor(actor.user.roleCodes);
    assertPermission(
      actor.user.roleCodes,
      actor.user.mustChangePassword,
      capabilities.includes('projects.write')
        ? 'projects.write'
        : 'attendance.write',
    );
    return this.reader.responsibleCandidates({
      ...input,
      roleCodes: [...activityResponsibleRoles],
    });
  }

  private async authorize(
    tx: AccountTransaction,
    actor: Principal,
    ownPassword: boolean,
  ) {
    const current = await tx.accounts.findById(actor.user.id);
    if (!current?.user.active || current.authVersion !== actor.authVersion)
      throw new AuthenticationRequiredError();
    if (!ownPassword)
      assertPermission(
        current.user.roleCodes,
        current.user.mustChangePassword,
        'accounts.manage',
      );
  }

  private execute(
    context: CommandContext,
    type: AccountOperationType,
    targetId: string | null,
    input: unknown,
    secret: boolean,
    work: (tx: AccountTransaction) => Promise<AccountMutation>,
    ownPassword = false,
  ) {
    return this.unitOfWork.run(
      [context.actor.user.id, ...(targetId ? [targetId] : [])],
      async (tx) => {
        await this.authorize(tx, context.actor, ownPassword);
        const existing = await tx.operations.find(type, context.key);
        const content = {
          route: type,
          params: { userId: targetId },
          body: input,
        };
        if (existing) {
          if (
            existing.actorId !== context.actor.user.id ||
            !this.fingerprints.matches(
              existing.requestFingerprint,
              this.fingerprints.calculate(content, existing.fingerprintKeyId),
            )
          )
            throw new IdempotencyConflictError();
          return tx.audit.readRevision(
            existing.resultReference.entityId,
            existing.resultReference.revision,
          );
        }
        const keyId = secret ? this.fingerprints.currentKeyId : null;
        const operationId = await tx.operations.create({
          type,
          key: context.key,
          actorType: 'USER',
          actorId: context.actor.user.id,
          fingerprintKeyId: keyId,
          requestFingerprint: this.fingerprints.calculate(content, keyId),
        });
        const mutation = await work(tx);
        if (mutation.changed)
          await tx.audit.append({
            operationId,
            actorId: context.actor.user.id,
            before: mutation.before,
            after: mutation.account,
            action: mutation.action,
            reason: mutation.reason,
          });
        await tx.operations.complete(operationId, {
          entityType: 'UserAccount',
          entityId: mutation.account.id,
          revision: mutation.account.revision,
        });
        return mutation.account;
      },
    );
  }

  private async current(
    tx: AccountTransaction,
    id: string,
    expectedRevision: number,
  ) {
    const current = await tx.accounts.findById(id);
    if (!current) throw new ResourceNotFoundError();
    assertRevision(current.user.revision, expectedRevision);
    return current;
  }

  update(context: CommandContext, id: string, input: UpdateUserInput) {
    return this.execute(
      context,
      'accounts.update',
      id,
      input,
      false,
      async (tx) => {
        const { user: before } = await this.current(
          tx,
          id,
          input.expectedRevision,
        );
        const plan = planAccountProfileChange(
          before,
          input,
          await tx.accounts.countActiveAdministrators(),
        );
        if (!plan.changed)
          return { account: before, before, action: 'UPDATE', changed: false };
        const account = await tx.accounts.update(id, {
          displayName: plan.displayName,
          revision: before.revision + 1,
          ...(input.roleCodes ? { roleCodes: plan.roleCodes } : {}),
        });
        return { account, before, action: 'UPDATE', changed: true };
      },
    );
  }

  create(
    context: CommandContext,
    input: CreateUserInput,
    passwordHash: string,
  ) {
    return this.execute(
      context,
      'accounts.create',
      null,
      input,
      true,
      async (tx) => {
        if (await tx.accounts.findByLogin(input.login))
          throw new AccountRuleError('LOGIN_ALREADY_USED');
        const account = await tx.accounts.create({
          login: input.login,
          displayName: input.displayName,
          roleCodes: input.roleCodes,
          passwordHash,
          active: true,
          mustChangePassword: true,
          revision: 1,
          authVersion: 1,
        });
        return { account, before: null, action: 'CREATE', changed: true };
      },
    );
  }

  activate(context: CommandContext, id: string, input: ActivationInput) {
    return this.execute(
      context,
      'accounts.activation',
      id,
      input,
      false,
      async (tx) => {
        const current = await this.current(tx, id, input.expectedRevision);
        const before = current.user;
        const plan = planAccountActivation(
          before,
          input.active,
          await tx.accounts.countActiveAdministrators(),
        );
        const action = input.active ? 'ACTIVATE' : 'DEACTIVATE';
        if (!plan.changed)
          return { account: before, before, action, changed: false };
        const account = await tx.accounts.update(id, {
          active: input.active,
          revision: before.revision + 1,
          authVersion: current.authVersion + 1,
        });
        return { account, before, action, reason: input.reason, changed: true };
      },
    );
  }

  resetPassword(
    context: CommandContext,
    id: string,
    input: ResetPasswordInput,
    passwordHash: string,
  ) {
    return this.execute(
      context,
      'accounts.password.reset',
      id,
      input,
      true,
      async (tx) => {
        const current = await this.current(tx, id, input.expectedRevision);
        const account = await tx.accounts.update(id, {
          passwordHash,
          mustChangePassword: true,
          revision: current.user.revision + 1,
          authVersion: current.authVersion + 1,
        });
        return {
          account,
          before: current.user,
          action: 'PASSWORD_RESET',
          reason: input.reason,
          changed: true,
        };
      },
    );
  }

  changePassword(
    actor: Principal,
    input: ChangePasswordInput,
    capturedRevision: number,
    passwordHash: string,
  ) {
    return this.execute(
      { actor, key: this.operationKey() },
      'auth.password.change',
      actor.user.id,
      { expectedRevision: capturedRevision },
      false,
      async (tx) => {
        const current = await this.current(tx, actor.user.id, capturedRevision);
        assertRevision(current.user.revision, input.expectedRevision);
        const account = await tx.accounts.update(actor.user.id, {
          passwordHash,
          mustChangePassword: false,
          revision: current.user.revision + 1,
          authVersion: current.authVersion + 1,
        });
        return {
          account,
          before: current.user,
          action: 'PASSWORD_CHANGE',
          changed: true,
        };
      },
      true,
    );
  }

  bootstrap(input: CreateUserInput, passwordHash: string) {
    return this.unitOfWork.run([], async (tx) => {
      if (await tx.accounts.count())
        throw new AccountRuleError('BOOTSTRAP_ALREADY_COMPLETED');
      if (!input.roleCodes.includes('ADMINISTRATOR'))
        throw new AccountRuleError('BOOTSTRAP_REQUIRES_ADMINISTRATOR');
      await tx.accounts.ensureRoles(
        Object.entries(roleLabels).map(([code, label]) => ({
          code: code as Role,
          label,
        })),
      );
      const account = await tx.accounts.create({
        login: input.login,
        displayName: input.displayName,
        roleCodes: input.roleCodes,
        passwordHash,
        active: true,
        mustChangePassword: true,
        revision: 1,
        authVersion: 1,
      });
      const key = this.operationKey();
      const operationId = await tx.operations.create({
        type: 'accounts.bootstrap',
        key,
        actorType: 'SYSTEM_BOOTSTRAP',
        actorId: null,
        fingerprintKeyId: null,
        requestFingerprint: this.fingerprints.calculate({ key }, null),
      });
      await tx.audit.append({
        operationId,
        actorId: null,
        action: 'CREATE',
        before: null,
        after: account,
      });
      await tx.operations.complete(operationId, {
        entityType: 'UserAccount',
        entityId: account.id,
        revision: account.revision,
      });
      return account;
    });
  }
}
