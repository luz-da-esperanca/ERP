import { auditScopes, auditScope } from '../domain/audit-scopes.js';
import {
  attendanceAuditEntrySchema,
  eligibilityAuditEntrySchema,
} from '@erp/contracts/audit-api';
import { z } from 'zod';
import { userDtoSchema } from '@erp/contracts/access-api';
import { accountAuditActionSchema } from '@erp/contracts/account-audit-api';
import {
  familyDtoSchema,
  personDtoSchema,
  membershipDtoSchema,
  sizeProfileSchema,
} from '@erp/contracts/registration-api';
import { dataQualityIssueSchema } from '@erp/contracts/audit-api';
import { projectsAuditEntrySchema } from '@erp/contracts/audit-api';
import type {
  AuditEntity,
  AuditEntry,
  RegistrationAuditEntry,
} from '../domain/audit-entry.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { ResourceNotFoundError } from '../../../core/application/errors.js';
import {
  databaseOperation,
  type Database,
  type Transaction,
} from '../../../core/infra/database.js';
import type {
  AccountAuditChange,
  AccountAuditWriter,
} from '../application/account-audit.js';
import type {
  AuditReader,
  AuditQueryInput,
} from '../application/audit-reader.js';
import type { AuditProjector } from '../application/audit-reader.js';
import { socialSnapshotSchemas } from '../../social-forms/infra/social-form-projections.js';
import type { AccountAuditSnapshot } from '../domain/account-audit.js';

export class PrismaAccountAudit implements AccountAuditWriter {
  constructor(private readonly tx: Transaction) {}

  async append(input: AccountAuditChange) {
    const passwordChanged = ['PASSWORD_CHANGE', 'PASSWORD_RESET'].includes(
      input.action,
    );
    await this.tx.auditEntry.create({
      data: {
        operationId: input.operationId,
        entityType: 'UserAccount',
        entityId: input.after.id,
        revision: input.after.revision,
        action: input.action,
        actorType: input.actorId ? 'USER' : 'SYSTEM_BOOTSTRAP',
        actorId: input.actorId,
        classification: 'ACCOUNTS',
        before: input.before ? { ...input.before } : Prisma.DbNull,
        after: {
          ...input.after,
          ...(passwordChanged ? { passwordChanged: true } : {}),
        },
        reason: input.reason,
      },
    });
  }

  async readRevision(id: string, revision: number) {
    const entry = await this.tx.auditEntry.findUnique({
      where: {
        entityType_entityId_revision: {
          entityType: 'UserAccount',
          entityId: id,
          revision,
        },
      },
      select: { after: true },
    });
    if (!entry) throw new ResourceNotFoundError();
    return userDtoSchema.parse(entry.after);
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

function projectSnapshot(value: Prisma.JsonValue): AccountAuditSnapshot {
  const account = userDtoSchema.parse(value);
  const changed = z
    .object({ passwordChanged: z.boolean().optional() })
    .parse(value).passwordChanged;
  return { ...account, ...(changed ? { passwordChanged: true } : {}) };
}

function projectEntry(entry: SelectedEntry): AuditEntry {
  if (
    entry.classification === 'SOCIAL_FORMS' ||
    entry.classification === 'FEATURE_DECISIONS'
  ) {
    const entityType = z
      .enum([
        'SocialForm',
        'Acknowledgement',
        'FieldSelectionVersion',
        'SocialFormOption',
        'FeatureDecision',
      ])
      .parse(entry.entityType);
    return {
      ...entry,
      entityType,
      classification: entry.classification,
      action: z
        .enum(['CREATE', 'UPDATE', 'CLOSE', 'CORRECT'])
        .parse(entry.action),
      recordedAt: entry.recordedAt.toISOString(),
      occurredAt: entry.occurredAt?.toISOString() ?? null,
      before: entry.before
        ? socialSnapshotSchemas[entityType].parse(entry.before)
        : null,
      after: socialSnapshotSchemas[entityType].parse(entry.after),
    };
  }
  if (entry.classification === 'ATTENDANCE')
    return attendanceAuditEntrySchema.parse({
      ...entry,
      recordedAt: entry.recordedAt.toISOString(),
      occurredAt: entry.occurredAt?.toISOString() ?? null,
    });
  if (entry.classification === 'ELIGIBILITY')
    return eligibilityAuditEntrySchema.parse({
      ...entry,
      recordedAt: entry.recordedAt.toISOString(),
      occurredAt: entry.occurredAt?.toISOString() ?? null,
    });
  if (entry.classification === 'PROJECTS')
    return projectsAuditEntrySchema.parse({
      ...entry,
      recordedAt: entry.recordedAt.toISOString(),
      occurredAt: entry.occurredAt?.toISOString() ?? null,
    });
  if (entry.classification === 'REGISTRATION') {
    const schemas = {
      Family: familyDtoSchema,
      Person: personDtoSchema,
      FamilyMembership: membershipDtoSchema,
      SizeProfile: sizeProfileSchema,
      DataQualityIssue: dataQualityIssueSchema,
    };
    const entityType = z
      .enum([
        'Family',
        'Person',
        'FamilyMembership',
        'SizeProfile',
        'DataQualityIssue',
      ])
      .parse(entry.entityType);
    return {
      id: entry.id,
      operationId: entry.operationId,
      entityType,
      entityId: entry.entityId,
      revision: entry.revision,
      action: z
        .enum(['CREATE', 'UPDATE', 'CLOSE', 'CORRECT'])
        .parse(entry.action),
      actorType: entry.actorType,
      actorId: entry.actorId,
      actor: entry.actor,
      recordedAt: entry.recordedAt.toISOString(),
      occurredAt: entry.occurredAt?.toISOString() ?? null,
      before:
        entry.before === null ? null : schemas[entityType].parse(entry.before),
      after: schemas[entityType].parse(entry.after),
      reason: entry.reason,
      classification: 'REGISTRATION',
    } satisfies RegistrationAuditEntry;
  }
  return {
    id: entry.id,
    operationId: entry.operationId,
    entityType: 'UserAccount',
    entityId: entry.entityId,
    revision: entry.revision,
    action: accountAuditActionSchema.parse(entry.action),
    actorType: entry.actorType,
    actorId: entry.actorId,
    actor: entry.actor,
    recordedAt: entry.recordedAt.toISOString(),
    occurredAt: entry.occurredAt?.toISOString() ?? null,
    before: entry.before === null ? null : projectSnapshot(entry.before),
    after: projectSnapshot(entry.after),
    reason: entry.reason,
    classification: 'ACCOUNTS',
  };
}

export class PrismaAuditReader implements AuditReader {
  constructor(private readonly database: Database) {}

  list(input: AuditQueryInput, project?: AuditProjector) {
    return databaseOperation(async () => {
      const where: Prisma.AuditEntryWhereInput = {
        entityType: input.entityType,
        classification: auditScope(input.entityType).classification,
        entityId: input.entityId,
        actorId: input.actorId,
        action: input.action,
        recordedAt: {
          gte: input.from ? new Date(input.from) : undefined,
          lt: input.to ? new Date(input.to) : undefined,
        },
      };
      if (project)
        return this.database.$transaction(
          async (tx) => {
            const entries = await tx.auditEntry.findMany({
              where,
              select: auditSelect,
              orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
            });
            const visible: AuditEntry[] = [];
            for (const entry of entries) {
              const value = await project(projectEntry(entry));
              if (value) visible.push(value);
            }
            return {
              data: visible.slice(
                (input.page - 1) * input.pageSize,
                input.page * input.pageSize,
              ),
              pagination: {
                page: input.page,
                pageSize: input.pageSize,
                total: visible.length,
              },
            };
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
            timeout: 10000,
          },
        );
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
    });
  }

  get(
    id: string,
    entityTypes: readonly AuditEntity[] = ['UserAccount'],
    project?: AuditProjector,
  ) {
    return databaseOperation(async () => {
      const entry = await this.database.auditEntry.findFirst({
        where: {
          id,
          OR: auditScopes.map((scope) => ({
            classification: scope.classification,
            entityType: {
              in: entityTypes.filter((type) => scope.entities.includes(type)),
            },
          })),
        },
        select: auditSelect,
      });
      return entry
        ? project
          ? project(projectEntry(entry))
          : projectEntry(entry)
        : null;
    });
  }
}
