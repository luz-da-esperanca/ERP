import { z } from 'zod';
import { Prisma } from '../../../generated/prisma/client.js';
import { roleSchema } from '@erp/contracts/access';
import type { Account } from '../domain/account.js';
import type { CredentialAccount } from '../application/ports.js';
import type { ListUsersInput } from '../application/account-commands.js';
import type {
  AccountsReader,
  AccountUnitOfWork,
  AccountTransaction,
  TransactionalAccounts,
  AccountOperations,
} from '../application/account-transactions.js';
import type { AccountAuditWriter } from '../../audit/application/account-audit.js';
import {
  databaseOperation,
  serializable,
  type Database,
  type Transaction,
} from '../../../core/infra/database.js';

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

function projectAccount(account: SelectedAccount): Account {
  return {
    id: account.id,
    login: account.login,
    displayName: account.displayName,
    active: account.active,
    mustChangePassword: account.mustChangePassword,
    revision: account.revision,
    roleCodes: account.roles
      .map((assignment) => roleSchema.parse(assignment.roleCode))
      .sort(),
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
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

function transactionalAccounts(tx: Transaction): TransactionalAccounts {
  return {
    async findByLogin(login) {
      return projectCredential(
        await tx.userAccount.findUnique({
          where: { login },
          select: credentialSelect,
        }),
      );
    },
    async findById(id) {
      return projectCredential(
        await tx.userAccount.findUnique({
          where: { id },
          select: credentialSelect,
        }),
      );
    },
    count: () => tx.userAccount.count(),
    countActiveAdministrators: () =>
      tx.userAccount.count({
        where: { active: true, roles: { some: { roleCode: 'ADMINISTRATOR' } } },
      }),
    async create(input) {
      const { roleCodes, ...fields } = input;
      return projectAccount(
        await tx.userAccount.create({
          data: {
            ...fields,
            roles: { create: roleCodes.map((roleCode) => ({ roleCode })) },
          },
          select: accountSelect,
        }),
      );
    },
    async update(id, changes) {
      const { roleCodes, ...fields } = changes;
      return projectAccount(
        await tx.userAccount.update({
          where: { id },
          data: {
            ...fields,
            ...(roleCodes
              ? {
                  roles: {
                    deleteMany: {},
                    create: roleCodes.map((roleCode) => ({ roleCode })),
                  },
                }
              : {}),
          },
          select: accountSelect,
        }),
      );
    },
    async ensureRoles(roles) {
      for (const { code, label } of roles)
        await tx.role.upsert({
          where: { code },
          create: { code, label },
          update: {},
        });
    },
  };
}

function transactionalOperations(tx: Transaction): AccountOperations {
  return {
    async find(type, key) {
      const record = await tx.operationRecord.findUnique({
        where: { type_key: { type, key } },
      });
      return record
        ? {
            id: record.id,
            actorId: record.actorId,
            fingerprintKeyId: record.fingerprintKeyId,
            requestFingerprint: record.requestFingerprint,
            resultReference: referenceSchema.parse(record.resultReference),
          }
        : null;
    },
    async create(input) {
      const record = await tx.operationRecord.create({
        data: input,
        select: { id: true },
      });
      return record.id;
    },
    async complete(id, reference) {
      await tx.operationRecord.update({
        where: { id },
        data: { resultReference: { ...reference }, completedAt: new Date() },
      });
    },
  };
}

export class PrismaAccounts implements AccountsReader, AccountUnitOfWork {
  constructor(
    private readonly database: Database,
    private readonly createAudit: (
      transaction: Transaction,
    ) => AccountAuditWriter,
  ) {}

  findByLogin(login: string) {
    return databaseOperation(async () =>
      projectCredential(
        await this.database.userAccount.findUnique({
          where: { login },
          select: credentialSelect,
        }),
      ),
    );
  }
  findById(id: string) {
    return databaseOperation(async () =>
      projectCredential(
        await this.database.userAccount.findUnique({
          where: { id },
          select: credentialSelect,
        }),
      ),
    );
  }
  list(input: ListUsersInput) {
    return databaseOperation(async () => {
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
    });
  }
  run<T>(
    accountIds: readonly string[],
    work: (transaction: AccountTransaction) => Promise<T>,
  ): Promise<T> {
    return serializable(this.database, async (tx) => {
      // The shared lock serializes bootstrap and transitions affecting the last administrator.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(71482001)`;
      if (accountIds.length)
        await tx.$queryRaw`SELECT id FROM "UserAccount" WHERE id IN (${Prisma.join([...new Set(accountIds)].sort().map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`;
      return work({
        accounts: transactionalAccounts(tx),
        operations: transactionalOperations(tx),
        audit: this.createAudit(tx),
      });
    });
  }
}
