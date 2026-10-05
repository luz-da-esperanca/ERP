import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type {
  CreateUserInput,
  UpdateUserInput,
  ActivationInput,
  ResetPasswordInput,
  ChangePasswordInput,
  ListUsersInput,
  UserDto,
} from '@erp/contracts/access-api';
import { userDtoSchema } from '@erp/contracts/access-api';
import { roleSchema } from '@erp/contracts/access';
import type { ApiConfig } from '../../../core/config.js';
import type { Database, Transaction } from '../../../core/database.js';
import { serializable } from '../../../core/database.js';
import { Prisma } from '../../../generated/prisma/client.js';
import {
  businessRule,
  idempotencyConflict,
  notFound,
  unauthenticated,
} from '../../../core/errors.js';
import {
  fingerprint,
  sameFingerprint,
} from '../../../core/operation-fingerprint.js';
import { assertPermission, roleLabels } from '../domain/permissions.js';
import {
  assertAdministratorRemains,
  assertRevision,
} from '../domain/account-rules.js';
import type {
  AccountsStore,
  CommandContext,
  Principal,
  CredentialAccount,
} from '../application/ports.js';
import {
  appendAccountAudit,
  readAccountRevision,
  type AccountAuditAction,
} from '../../audit/infra/audit-store.js';

const accountSelect = {
  id: true,
  login: true,
  displayName: true,
  active: true,
  mustChangePassword: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
  roles: { select: { roleCode: true } },
} satisfies Prisma.UserAccountSelect;
const credentialSelect = {
  ...accountSelect,
  passwordHash: true,
  authVersion: true,
} satisfies Prisma.UserAccountSelect;
type SelectedAccount = Prisma.UserAccountGetPayload<{
  select: typeof accountSelect;
}>;
type SelectedCredential = Prisma.UserAccountGetPayload<{
  select: typeof credentialSelect;
}>;
function projectAccount(account: SelectedAccount): UserDto {
  return userDtoSchema.parse({
    id: account.id,
    login: account.login,
    displayName: account.displayName,
    active: account.active,
    mustChangePassword: account.mustChangePassword,
    revision: account.revision,
    roleCodes: account.roles.map((assignment) =>
      roleSchema.parse(assignment.roleCode),
    ),
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  });
}
function projectCredential(
  account: SelectedCredential | null,
): CredentialAccount | null {
  return account
    ? {
        user: projectAccount(account),
        passwordHash: account.passwordHash,
        authVersion: account.authVersion,
      }
    : null;
}
const referenceSchema = z
  .object({
    entityType: z.literal('UserAccount'),
    entityId: z.uuid(),
    revision: z.number().int().positive(),
  })
  .strict();
type Mutation = {
  account: UserDto;
  before: UserDto | null;
  action: AccountAuditAction;
  changed: boolean;
  reason?: string;
};

export class PrismaAccounts implements AccountsStore {
  constructor(
    private readonly database: Database,
    private readonly config: ApiConfig,
  ) {}
  async findByLogin(login: string) {
    return projectCredential(
      await this.database.userAccount.findUnique({
        where: { login },
        select: credentialSelect,
      }),
    );
  }
  async findById(id: string) {
    return projectCredential(
      await this.database.userAccount.findUnique({
        where: { id },
        select: credentialSelect,
      }),
    );
  }
  async list(input: ListUsersInput) {
    const where: Prisma.UserAccountWhereInput = {
      active: input.active,
      ...(input.q
        ? {
            OR: [
              { login: { contains: input.q, mode: 'insensitive' } },
              { displayName: { contains: input.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [accounts, total] = await this.database.$transaction(
      [
        this.database.userAccount.findMany({
          where,
          select: accountSelect,
          orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        this.database.userAccount.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      data: accounts.map(projectAccount),
      pagination: { page: input.page, pageSize: input.pageSize, total },
    };
  }
  private async lock(tx: Transaction, ids: string[]) {
    // Account commands share a lock to protect bootstrap and the last active administrator.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(71482001)`;
    if (ids.length)
      await tx.$queryRaw`SELECT id FROM "UserAccount" WHERE id IN (${Prisma.join([...new Set(ids)].sort().map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`;
  }
  private async authorize(
    tx: Transaction,
    actor: Principal,
    ownPassword: boolean,
  ) {
    const current = await tx.userAccount.findUnique({
      where: { id: actor.user.id },
      select: credentialSelect,
    });
    if (!current?.active || current.authVersion !== actor.authVersion)
      throw unauthenticated();
    if (!ownPassword)
      assertPermission(
        projectAccount(current).roleCodes,
        current.mustChangePassword,
        'accounts.manage',
      );
  }
  private async execute(
    context: CommandContext,
    type: string,
    targetId: string | null,
    input: unknown,
    secret: boolean,
    work: (tx: Transaction) => Promise<Mutation>,
    ownPassword = false,
  ) {
    return serializable(this.database, async (tx) => {
      await this.lock(tx, [
        context.actor.user.id,
        ...(targetId ? [targetId] : []),
      ]);
      await this.authorize(tx, context.actor, ownPassword);
      const existing = await tx.operationRecord.findUnique({
        where: { type_key: { type, key: context.key } },
      });
      const content = {
        route: type,
        params: { userId: targetId },
        body: input,
      };
      if (existing) {
        if (
          existing.actorId !== context.actor.user.id ||
          !sameFingerprint(
            existing.requestFingerprint,
            fingerprint(this.config, content, existing.fingerprintKeyId),
          )
        )
          throw idempotencyConflict();
        const reference = referenceSchema.parse(existing.resultReference);
        return readAccountRevision(tx, reference.entityId, reference.revision);
      }
      const keyId = secret ? this.config.OPERATION_HMAC_CURRENT_KEY_ID : null;
      const operation = await tx.operationRecord.create({
        data: {
          type,
          key: context.key,
          actorType: 'USER',
          actorId: context.actor.user.id,
          fingerprintKeyId: keyId,
          requestFingerprint: fingerprint(this.config, content, keyId),
        },
      });
      const mutation = await work(tx);
      if (mutation.changed)
        await appendAccountAudit(tx, {
          operationId: operation.id,
          actorId: context.actor.user.id,
          before: mutation.before,
          after: mutation.account,
          action: mutation.action,
          reason: mutation.reason,
        });
      await tx.operationRecord.update({
        where: { id: operation.id },
        data: {
          resultReference: {
            entityType: 'UserAccount',
            entityId: mutation.account.id,
            revision: mutation.account.revision,
          },
          completedAt: new Date(),
        },
      });
      return mutation.account;
    });
  }
  private async current(tx: Transaction, id: string, expectedRevision: number) {
    const account = await tx.userAccount.findUnique({
      where: { id },
      select: accountSelect,
    });
    if (!account) throw notFound();
    assertRevision(account.revision, expectedRevision);
    return projectAccount(account);
  }
  async create(
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
        if (
          await tx.userAccount.findUnique({
            where: { login: input.login },
            select: { id: true },
          })
        )
          throw businessRule('LOGIN_ALREADY_USED');
        const account = await tx.userAccount.create({
          data: {
            login: input.login,
            displayName: input.displayName,
            passwordHash,
            roles: {
              create: input.roleCodes.map((roleCode) => ({ roleCode })),
            },
          },
          select: accountSelect,
        });
        return {
          account: projectAccount(account),
          before: null,
          action: 'CREATE',
          changed: true,
        };
      },
    );
  }
  async update(context: CommandContext, id: string, input: UpdateUserInput) {
    return this.execute(
      context,
      'accounts.update',
      id,
      input,
      false,
      async (tx) => {
        const before = await this.current(tx, id, input.expectedRevision);
        const nextRoles = input.roleCodes ?? before.roleCodes;
        const nextName = input.displayName ?? before.displayName;
        const count = await tx.userAccount.count({
          where: {
            active: true,
            roles: { some: { roleCode: 'ADMINISTRATOR' } },
          },
        });
        assertAdministratorRemains(
          before.active,
          before.roleCodes,
          before.active,
          nextRoles,
          count,
        );
        if (
          nextName === before.displayName &&
          nextRoles.join() === before.roleCodes.join()
        )
          return { account: before, before, action: 'UPDATE', changed: false };
        const account = await tx.userAccount.update({
          where: { id },
          data: {
            displayName: nextName,
            revision: { increment: 1 },
            ...(input.roleCodes
              ? {
                  roles: {
                    deleteMany: {},
                    create: nextRoles.map((roleCode) => ({ roleCode })),
                  },
                }
              : {}),
          },
          select: accountSelect,
        });
        return {
          account: projectAccount(account),
          before,
          action: 'UPDATE',
          changed: true,
        };
      },
    );
  }
  async activate(context: CommandContext, id: string, input: ActivationInput) {
    return this.execute(
      context,
      'accounts.activation',
      id,
      input,
      false,
      async (tx) => {
        const before = await this.current(tx, id, input.expectedRevision);
        const count = await tx.userAccount.count({
          where: {
            active: true,
            roles: { some: { roleCode: 'ADMINISTRATOR' } },
          },
        });
        assertAdministratorRemains(
          before.active,
          before.roleCodes,
          input.active,
          before.roleCodes,
          count,
        );
        if (before.active === input.active)
          return {
            account: before,
            before,
            action: input.active ? 'ACTIVATE' : 'DEACTIVATE',
            changed: false,
          };
        const account = await tx.userAccount.update({
          where: { id },
          data: {
            active: input.active,
            revision: { increment: 1 },
            authVersion: { increment: 1 },
          },
          select: accountSelect,
        });
        return {
          account: projectAccount(account),
          before,
          action: input.active ? 'ACTIVATE' : 'DEACTIVATE',
          reason: input.reason,
          changed: true,
        };
      },
    );
  }
  async resetPassword(
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
        const before = await this.current(tx, id, input.expectedRevision);
        const account = await tx.userAccount.update({
          where: { id },
          data: {
            passwordHash,
            mustChangePassword: true,
            authVersion: { increment: 1 },
            revision: { increment: 1 },
          },
          select: accountSelect,
        });
        return {
          account: projectAccount(account),
          before,
          action: 'PASSWORD_RESET',
          reason: input.reason,
          changed: true,
        };
      },
    );
  }
  async changePassword(
    actor: Principal,
    input: ChangePasswordInput,
    capturedRevision: number,
    passwordHash: string,
  ) {
    return this.execute(
      { actor, key: randomUUID() },
      'auth.password.change',
      actor.user.id,
      { expectedRevision: capturedRevision },
      false,
      async (tx) => {
        const before = await this.current(tx, actor.user.id, capturedRevision);
        assertRevision(before.revision, input.expectedRevision);
        const account = await tx.userAccount.update({
          where: { id: actor.user.id },
          data: {
            passwordHash,
            mustChangePassword: false,
            authVersion: { increment: 1 },
            revision: { increment: 1 },
          },
          select: accountSelect,
        });
        return {
          account: projectAccount(account),
          before,
          action: 'PASSWORD_CHANGE',
          changed: true,
        };
      },
      true,
    );
  }
  async bootstrap(input: CreateUserInput, passwordHash: string) {
    return serializable(this.database, async (tx) => {
      await this.lock(tx, []);
      if ((await tx.userAccount.count()) !== 0)
        throw businessRule('BOOTSTRAP_ALREADY_COMPLETED');
      if (!input.roleCodes.includes('ADMINISTRATOR'))
        throw businessRule('BOOTSTRAP_REQUIRES_ADMINISTRATOR');
      for (const code of roleSchema.options)
        await tx.role.upsert({
          where: { code },
          create: { code, label: roleLabels[code] },
          update: {},
        });
      const account = projectAccount(
        await tx.userAccount.create({
          data: {
            login: input.login,
            displayName: input.displayName,
            passwordHash,
            roles: {
              create: input.roleCodes.map((roleCode) => ({ roleCode })),
            },
          },
          select: accountSelect,
        }),
      );
      const key = randomUUID();
      const operation = await tx.operationRecord.create({
        data: {
          type: 'accounts.bootstrap',
          key,
          actorType: 'SYSTEM_BOOTSTRAP',
          requestFingerprint: fingerprint(this.config, { key }, null),
          resultReference: {
            entityType: 'UserAccount',
            entityId: account.id,
            revision: account.revision,
          },
          completedAt: new Date(),
        },
      });
      await appendAccountAudit(tx, {
        operationId: operation.id,
        actorId: null,
        action: 'CREATE',
        before: null,
        after: account,
      });
      return account;
    });
  }
}
