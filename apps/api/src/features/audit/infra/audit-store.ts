import { Prisma, type AuditAction } from '../../../generated/prisma/client.js';
import type { UserDto } from '@erp/contracts/access-api';
import { userDtoSchema } from '@erp/contracts/access-api';
import type { Transaction, Database } from '../../../core/database.js';
import { notFound } from '../../../core/errors.js';
import type { Principal } from '../../access/application/ports.js';
import {
  assertPermission,
  capabilitiesFor,
} from '../../access/domain/permissions.js';
import { z } from 'zod';
import { paginationSchema } from '@erp/contracts/access-api';
export type AccountAuditAction = AuditAction;

export async function appendAccountAudit(
  tx: Transaction,
  input: {
    operationId: string;
    actorId: string | null;
    action: AccountAuditAction;
    before: UserDto | null;
    after: UserDto;
    reason?: string;
  },
) {
  const passwordChanged = ['PASSWORD_CHANGE', 'PASSWORD_RESET'].includes(
    input.action,
  );
  await tx.auditEntry.create({
    data: {
      operationId: input.operationId,
      entityType: 'UserAccount',
      entityId: input.after.id,
      revision: input.after.revision,
      action: input.action,
      actorType: input.actorId ? 'USER' : 'SYSTEM_BOOTSTRAP',
      actorId: input.actorId,
      classification: 'ACCOUNTS',
      before: input.before ?? Prisma.DbNull,
      after: {
        ...input.after,
        ...(passwordChanged ? { passwordChanged: true } : {}),
      },
      reason: input.reason,
    },
  });
}
export async function readAccountRevision(
  tx: Transaction,
  id: string,
  revision: number,
) {
  const entry = await tx.auditEntry.findUnique({
    where: {
      entityType_entityId_revision: {
        entityType: 'UserAccount',
        entityId: id,
        revision,
      },
    },
    select: { after: true },
  });
  if (!entry) throw notFound();
  return userDtoSchema.parse(entry.after);
}
export const auditQuerySchema = paginationSchema
  .extend({
    entityType: z.literal('UserAccount'),
    entityId: z.uuid().optional(),
    actorId: z.uuid().optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
    action: z
      .enum([
        'CREATE',
        'UPDATE',
        'ACTIVATE',
        'DEACTIVATE',
        'PASSWORD_CHANGE',
        'PASSWORD_RESET',
      ])
      .optional(),
  })
  .strict()
  .refine(
    (value) =>
      !value.from || !value.to || new Date(value.from) < new Date(value.to),
  );
export class AuditStore {
  constructor(private readonly database: Database) {}
  private canRead(principal: Principal) {
    assertPermission(
      principal.user.roleCodes,
      principal.user.mustChangePassword,
      'accounts.manage',
    );
    assertPermission(principal.user.roleCodes, false, 'audit.read');
  }
  async list(principal: Principal, input: z.infer<typeof auditQuerySchema>) {
    this.canRead(principal);
    const where: Prisma.AuditEntryWhereInput = {
      entityType: 'UserAccount',
      classification: 'ACCOUNTS',
      entityId: input.entityId,
      actorId: input.actorId,
      action: input.action,
      recordedAt: {
        gte: input.from ? new Date(input.from) : undefined,
        lt: input.to ? new Date(input.to) : undefined,
      },
    };
    const [entries, total] = await this.database.$transaction(
      [
        this.database.auditEntry.findMany({
          where,
          select: auditSelect,
          orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        this.database.auditEntry.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      data: entries.map(projectEntry),
      pagination: { page: input.page, pageSize: input.pageSize, total },
    };
  }
  async get(principal: Principal, id: string) {
    if (
      !principal.user.mustChangePassword &&
      !capabilitiesFor(principal.user.roleCodes).includes('accounts.manage')
    )
      throw notFound();
    this.canRead(principal);
    const entry = await this.database.auditEntry.findFirst({
      where: { id, entityType: 'UserAccount', classification: 'ACCOUNTS' },
      select: auditSelect,
    });
    if (!entry) throw notFound();
    return projectEntry(entry);
  }
}
const auditSelect = {
  id: true,
  operationId: true,
  entityType: true,
  entityId: true,
  revision: true,
  action: true,
  actorType: true,
  actorId: true,
  actor: { select: { id: true, displayName: true, active: true } },
  recordedAt: true,
  occurredAt: true,
  before: true,
  after: true,
  reason: true,
  classification: true,
} satisfies Prisma.AuditEntrySelect;
type SelectedEntry = Prisma.AuditEntryGetPayload<{
  select: typeof auditSelect;
}>;
function projectSnapshot(value: Prisma.JsonValue | null) {
  if (!value) return null;
  const parsed = userDtoSchema.parse(value);
  const changed = z
    .object({ passwordChanged: z.boolean().optional() })
    .parse(value).passwordChanged;
  return { ...parsed, ...(changed ? { passwordChanged: true } : {}) };
}
function projectEntry(entry: SelectedEntry) {
  return {
    ...entry,
    recordedAt: entry.recordedAt.toISOString(),
    occurredAt: entry.occurredAt?.toISOString() ?? null,
    before: projectSnapshot(entry.before),
    after: projectSnapshot(entry.after),
  };
}
