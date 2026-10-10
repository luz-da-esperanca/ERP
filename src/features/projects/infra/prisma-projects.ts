import {
  projectSelect,
  activitySelect,
  enrollmentSelect,
  projectRecord,
  activityRecord,
  enrollmentRecord,
} from './project-projections.js';
import {
  attendanceTransactionPorts,
  sessionSelect,
  sessionRecord,
  coverageSelect,
  coverageRecord,
} from '../../attendance/infra/prisma-attendance.js';
import { z } from 'zod';
import type { Role } from '@erp/contracts/access';
import {
  instituteDtoSchema,
  serviceTypeDtoSchema,
  projectDtoSchema,
  activityDtoSchema,
  enrollmentDtoSchema,
} from '@erp/contracts/projects-api';
import { Prisma } from '../../../generated/prisma/client.js';
import {
  databaseOperation,
  serializable,
  type Database,
  type Transaction,
} from '../../../core/infra/database.js';
import { ResourceNotFoundError } from '../../../core/application/errors.js';
import { ProjectsConflictError } from '../domain/project-errors.js';
import type {
  CatalogEntity,
  CatalogQuery,
  ProjectsReference,
  ProjectsResultKind,
  ProjectsResults,
  ProjectsSnapshot,
  RevisionReference,
} from '../domain/projects.js';
import type {
  ProjectsReader,
  ProjectsTransaction,
  ProjectsUnitOfWork,
} from '../application/projects-ports.js';
import type { ProjectsQuery, ActivitiesQuery } from '../domain/projects.js';
import type { EnrollmentsQuery } from '../domain/projects.js';
import { normalizeSearch } from '../../registration/domain/duplicate-rules.js';
import { initialInstitutes } from '../domain/initial-institutes.js';

const catalogSelect = {
  id: true,
  code: true,
  name: true,
  active: true,
  revision: true,
} as const;
const snapshotSchemas = {
  Institute: instituteDtoSchema,
  ServiceType: serviceTypeDtoSchema,
  Project: projectDtoSchema,
  Activity: activityDtoSchema,
  ParticipantEnrollment: enrollmentDtoSchema,
};
const referenceSchema = z
  .object({
    entityType: z.enum([
      'Institute',
      'ServiceType',
      'Project',
      'Activity',
      'ParticipantEnrollment',
    ]),
    entityId: z.uuid(),
    revision: z.number().int().positive(),
  })
  .strict();
const operationReferenceSchema = z
  .object({
    kind: z.enum([
      'Institute',
      'ServiceType',
      'Project',
      'Activity',
      'ParticipantEnrollment',
      'ProjectClosure',
      'ActivityClosure',
    ]),
    primary: referenceSchema,
    activities: z.array(referenceSchema),
    enrollments: z.array(referenceSchema),
  })
  .strict();

function transactionPorts(tx: Transaction): ProjectsTransaction {
  async function readRevision(reference: RevisionReference) {
    const entry = await tx.auditEntry.findUnique({
      where: {
        entityType_entityId_revision: {
          entityType: reference.entityType,
          entityId: reference.entityId,
          revision: reference.revision,
        },
      },
      select: { after: true },
    });
    if (
      !entry &&
      reference.entityType === 'Institute' &&
      reference.revision === 1
    ) {
      const row = await tx.institute.findUnique({
        where: { id: reference.entityId },
        select: { code: true },
      });
      const initial = initialInstitutes.find((item) => item.code === row?.code);
      // Migration catalogs have an immutable initial revision without a fabricated operator audit.
      if (initial)
        return {
          id: reference.entityId,
          ...initial,
          active: true,
          revision: 1,
        };
    }
    if (!entry) throw new ResourceNotFoundError();
    return snapshotSchemas[reference.entityType].parse(entry.after);
  }
  const ports: ProjectsTransaction = {
    coverage: attendanceTransactionPorts(tx, false),
    async activitySessions(activityId) {
      return (
        await tx.activitySession.findMany({
          where: { activityId },
          select: sessionSelect,
          orderBy: { id: 'asc' },
        })
      ).map(sessionRecord);
    },
    async activityCoverage(activityId) {
      return (
        await tx.attendanceCoverage.findMany({
          where: { activityId },
          select: coverageSelect,
          orderBy: { id: 'asc' },
        })
      ).map(coverageRecord);
    },
    async findActor(id) {
      const row = await tx.userAccount.findUnique({
        where: { id },
        select: {
          id: true,
          login: true,
          displayName: true,
          active: true,
          mustChangePassword: true,
          authVersion: true,
          revision: true,
          createdAt: true,
          updatedAt: true,
          roles: { select: { roleCode: true } },
        },
      });
      return row
        ? {
            authVersion: row.authVersion,
            sessionId: '',
            user: {
              id: row.id,
              login: row.login,
              displayName: row.displayName,
              active: row.active,
              mustChangePassword: row.mustChangePassword,
              revision: row.revision,
              createdAt: row.createdAt.toISOString(),
              updatedAt: row.updatedAt.toISOString(),
              roleCodes: row.roles.map((role) => role.roleCode as Role),
            },
          }
        : null;
    },
    async findOperation(type, key) {
      const row = await tx.operationRecord.findUnique({
        where: { type_key: { type, key } },
        select: {
          actorId: true,
          requestFingerprint: true,
          resultReference: true,
        },
      });
      return row
        ? {
            actorId: row.actorId,
            fingerprint: row.requestFingerprint,
            reference: operationReferenceSchema.parse(row.resultReference),
          }
        : null;
    },
    async createOperation(type, key, actorId, requestFingerprint) {
      return (
        await tx.operationRecord.create({
          data: { type, key, actorId, actorType: 'USER', requestFingerprint },
          select: { id: true },
        })
      ).id;
    },
    async completeOperation(id, reference) {
      await tx.operationRecord.update({
        where: { id },
        data: {
          completedAt: new Date(),
          resultReference: {
            ...reference,
            primary: { ...reference.primary },
            activities: reference.activities.map((item) => ({ ...item })),
            enrollments: reference.enrollments.map((item) => ({ ...item })),
          },
        },
      });
    },
    async restore<K extends ProjectsResultKind>(
      reference: ProjectsReference & { kind: K },
    ): Promise<ProjectsResults[K]> {
      const primary = await readRevision(reference.primary);
      let result:
        | ProjectsSnapshot
        | ProjectsResults['ProjectClosure']
        | ProjectsResults['ActivityClosure'] = primary;
      if (reference.kind === 'ProjectClosure')
        result = {
          project: projectDtoSchema.parse(primary),
          activities: await Promise.all(
            reference.activities.map(async (item) =>
              activityDtoSchema.parse(await readRevision(item)),
            ),
          ),
          enrollments: await Promise.all(
            reference.enrollments.map(async (item) =>
              enrollmentDtoSchema.parse(await readRevision(item)),
            ),
          ),
        };
      if (reference.kind === 'ActivityClosure')
        result = {
          activity: activityDtoSchema.parse(primary),
          enrollments: await Promise.all(
            reference.enrollments.map(async (item) =>
              enrollmentDtoSchema.parse(await readRevision(item)),
            ),
          ),
        };
      // Snapshot schemas validate the stored result before restoring its command-specific type.
      return result as ProjectsResults[K];
    },
    async findCatalog(entity, id) {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM ${Prisma.raw(entity === 'Institute' ? '"Institute"' : '"ServiceType"')} WHERE id = ${id}::uuid FOR UPDATE`,
      );
      return entity === 'Institute'
        ? tx.institute.findUnique({ where: { id }, select: catalogSelect })
        : tx.serviceType.findUnique({ where: { id }, select: catalogSelect });
    },
    findServiceTypeByCode(code) {
      return tx.serviceType.findUnique({
        where: { code },
        select: catalogSelect,
      });
    },
    createServiceType(input) {
      return tx.serviceType.create({ data: input, select: catalogSelect });
    },
    updateCatalog(entity, id, changes) {
      const args = {
        where: { id },
        data: { ...changes, revision: { increment: 1 } },
        select: catalogSelect,
      };
      return entity === 'Institute'
        ? tx.institute.update(args)
        : tx.serviceType.update(args);
    },
    async findProject(id) {
      await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${id}::uuid FOR UPDATE`;
      const row = await tx.project.findUnique({
        where: { id },
        select: projectSelect,
      });
      return row ? projectRecord(row) : null;
    },
    async createProject(input, actorId) {
      return projectRecord(
        await tx.project.create({
          data: {
            ...input,
            nameSearch: normalizeSearch(input.name),
            startsOn: input.startsOn ? new Date(input.startsOn) : null,
            endsOn: input.endsOn ? new Date(input.endsOn) : null,
            createdBy: actorId,
            updatedBy: actorId,
          },
          select: projectSelect,
        }),
      );
    },
    async updateProject(id, changes, actorId) {
      return projectRecord(
        await tx.project.update({
          where: { id },
          data: {
            ...changes,
            nameSearch:
              changes.name === undefined
                ? undefined
                : normalizeSearch(changes.name),
            startsOn:
              changes.startsOn === undefined
                ? undefined
                : changes.startsOn === null
                  ? null
                  : new Date(changes.startsOn),
            endsOn:
              changes.endsOn === undefined
                ? undefined
                : changes.endsOn === null
                  ? null
                  : new Date(changes.endsOn),
            closedAt:
              changes.closedAt === undefined
                ? undefined
                : new Date(changes.closedAt),
            revision: { increment: 1 },
            updatedBy: actorId,
          },
          select: projectSelect,
        }),
      );
    },
    async findActivity(id, targetProjectId) {
      const context = await tx.activity.findUnique({
        where: { id },
        select: { projectId: true },
      });
      if (!context) return null;
      const projectIds = [
        ...new Set([
          context.projectId,
          ...(targetProjectId ? [targetProjectId] : []),
        ]),
      ].sort();
      await tx.$queryRaw`SELECT id FROM "Project" WHERE id IN (${Prisma.join(projectIds.map((projectId) => Prisma.sql`${projectId}::uuid`))}) ORDER BY id FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Activity" WHERE id = ${id}::uuid FOR UPDATE`;
      const row = await tx.activity.findUnique({
        where: { id },
        select: activitySelect,
      });
      return row ? activityRecord(row) : null;
    },
    async createActivity(projectId, input, actorId) {
      return activityRecord(
        await tx.activity.create({
          data: {
            ...input,
            projectId,
            nameSearch: normalizeSearch(input.name),
            createdBy: actorId,
            updatedBy: actorId,
          },
          select: activitySelect,
        }),
      );
    },
    async updateActivity(id, changes, actorId) {
      return activityRecord(
        await tx.activity.update({
          where: { id },
          data: {
            ...changes,
            nameSearch:
              changes.name === undefined
                ? undefined
                : normalizeSearch(changes.name),
            closedAt:
              changes.closedAt === undefined
                ? undefined
                : new Date(changes.closedAt),
            revision: { increment: 1 },
            updatedBy: actorId,
          },
          select: activitySelect,
        }),
      );
    },
    async projectActivities(id) {
      return (
        await tx.activity.findMany({
          where: { projectId: id },
          select: activitySelect,
          orderBy: { id: 'asc' },
        })
      ).map(activityRecord);
    },
    async activityEnrollments(id) {
      return (
        await tx.participantEnrollment.findMany({
          where: { activityId: id },
          select: enrollmentSelect,
          orderBy: { id: 'asc' },
        })
      ).map(enrollmentRecord);
    },
    async accountExists(id) {
      return (await tx.userAccount.count({ where: { id } })) > 0;
    },
    async personExists(id) {
      return (await tx.person.count({ where: { id, mergedIntoId: null } })) > 0;
    },
    async hasFamilyMembership(personId, at) {
      return (
        (await tx.familyMembership.count({
          where: {
            personId,
            supersededById: null,
            validFrom: { lte: new Date(at) },
            OR: [{ validUntil: null }, { validUntil: { gt: new Date(at) } }],
          },
        })) > 0
      );
    },
    async findEnrollment(id) {
      const context = await tx.participantEnrollment.findUnique({
        where: { id },
        select: { activityId: true },
      });
      if (!context) return null;
      await ports.findActivity(context.activityId);
      await tx.$queryRaw`SELECT id FROM "ParticipantEnrollment" WHERE id = ${id}::uuid FOR UPDATE`;
      const row = await tx.participantEnrollment.findUnique({
        where: { id },
        select: enrollmentSelect,
      });
      return row ? enrollmentRecord(row) : null;
    },
    async createEnrollment(input, actorId) {
      return enrollmentRecord(
        await tx.participantEnrollment.create({
          data: {
            ...input,
            validFrom: new Date(input.validFrom),
            validUntil:
              input.validUntil === null ? null : new Date(input.validUntil),
            createdBy: actorId,
            updatedBy: actorId,
          },
          select: enrollmentSelect,
        }),
      );
    },
    async updateEnrollment(id, changes, actorId) {
      return enrollmentRecord(
        await tx.participantEnrollment.update({
          where: { id },
          data: {
            validFrom:
              changes.validFrom === undefined
                ? undefined
                : new Date(changes.validFrom),
            validUntil:
              changes.validUntil === undefined
                ? undefined
                : changes.validUntil === null
                  ? null
                  : new Date(changes.validUntil),
            revision: { increment: 1 },
            updatedBy: actorId,
          },
          select: enrollmentSelect,
        }),
      );
    },
    async appendAudit(input) {
      await tx.auditEntry.create({
        data: {
          operationId: input.operationId,
          actorType: 'USER',
          actorId: input.actorId,
          entityType: input.entityType,
          entityId: input.after.id,
          revision: input.after.revision,
          action: input.action,
          classification: 'PROJECTS',
          before: input.before ? { ...input.before } : Prisma.DbNull,
          after: { ...input.after },
          reason: input.reason,
          occurredAt: input.occurredAt ? new Date(input.occurredAt) : null,
        },
      });
    },
  };
  return ports;
}

export class PrismaProjects implements ProjectsReader, ProjectsUnitOfWork {
  constructor(private readonly database: Database) {}
  private read<T>(work: (tx: Transaction) => Promise<T>) {
    return databaseOperation(() =>
      this.database.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      }),
    );
  }
  catalogs(entity: CatalogEntity, query: CatalogQuery) {
    return databaseOperation(() =>
      this.database.$transaction(
        async (tx) => {
          const args = {
            where: { active: query.active },
            select: catalogSelect,
            orderBy: [{ name: 'asc' as const }, { id: 'asc' as const }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
          };
          const data =
            entity === 'Institute'
              ? await tx.institute.findMany(args)
              : await tx.serviceType.findMany(args);
          const total =
            entity === 'Institute'
              ? await tx.institute.count({ where: args.where })
              : await tx.serviceType.count({ where: args.where });
          return {
            data,
            pagination: { page: query.page, pageSize: query.pageSize, total },
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      ),
    );
  }
  projects(query: ProjectsQuery) {
    return this.read(async (tx) => {
      const where: Prisma.ProjectWhereInput = {
        instituteId: query.instituteId,
        status: query.status,
        nameSearch: query.q
          ? { contains: normalizeSearch(query.q) }
          : undefined,
      };
      const data = await tx.project.findMany({
        where,
        select: projectSelect,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      });
      return {
        data: data.map(projectRecord),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total: await tx.project.count({ where }),
        },
      };
    });
  }
  activities(query: ActivitiesQuery) {
    return this.read(async (tx) => {
      const asOfDate = query.asOf ? new Date(query.asOf) : undefined;
      const validFilter = asOfDate
        ? {
            validFrom: { lte: asOfDate },
            OR: [{ validUntil: null }, { validUntil: { gt: asOfDate } }],
            supersededById: null,
          }
        : { supersededById: null };
      const where: Prisma.ActivityWhereInput = {
        projectId: query.projectId,
        nature: query.nature,
        status: query.status,
        nameSearch: query.q
          ? { contains: normalizeSearch(query.q) }
          : undefined,
        enrollments:
          query.personId || query.familyId
            ? {
                some: {
                  ...validFilter,
                  personId: query.personId,
                  person: query.familyId
                    ? {
                        memberships: {
                          some: {
                            familyId: query.familyId,
                            ...validFilter,
                          },
                        },
                      }
                    : undefined,
                },
              }
            : undefined,
      };
      const data = await tx.activity.findMany({
        where,
        select: activitySelect,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      });
      return {
        data: data.map(activityRecord),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total: await tx.activity.count({ where }),
        },
      };
    });
  }
  project(id: string) {
    return this.read(async (tx) => {
      const row = await tx.project.findUnique({
        where: { id },
        select: projectSelect,
      });
      if (!row) return null;
      const activities = await tx.activity.findMany({
        where: { projectId: id },
        select: activitySelect,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      });
      return {
        project: projectRecord(row),
        activities: activities.map(activityRecord),
      };
    });
  }
  activity(id: string, asOf: string) {
    return this.read(async (tx) => {
      const row = await tx.activity.findUnique({
        where: { id },
        select: activitySelect,
      });
      if (!row) return null;
      const project = await tx.project.findUniqueOrThrow({
        where: { id: row.projectId },
        select: projectSelect,
      });
      const people = await tx.participantEnrollment.findMany({
        where: {
          activityId: id,
          supersededById: null,
          validFrom: { lte: new Date(asOf) },
          OR: [{ validUntil: null }, { validUntil: { gt: new Date(asOf) } }],
        },
        select: { personId: true },
        distinct: ['personId'],
      });
      return {
        activity: activityRecord(row),
        project: projectRecord(project),
        asOf,
        participantCount: people.length,
      };
    });
  }
  enrollments(activityId: string, query: EnrollmentsQuery) {
    return this.read(async (tx) => {
      if (!(await tx.activity.count({ where: { id: activityId } })))
        return null;
      const where: Prisma.ParticipantEnrollmentWhereInput = {
        activityId,
        personId: query.personId,
        supersededById: null,
        ...(query.asOf
          ? {
              validFrom: { lte: new Date(query.asOf) },
              OR: [
                { validUntil: null },
                { validUntil: { gt: new Date(query.asOf) } },
              ],
            }
          : {}),
      };
      const rows = await tx.participantEnrollment.findMany({
        where,
        select: {
          ...enrollmentSelect,
          person: { select: { id: true, name: true } },
        },
        orderBy: [{ validFrom: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      });
      const data = [];
      for (const { person, ...row } of rows) {
        const at = query.asOf ? new Date(query.asOf) : row.validFrom;
        const membership = await tx.familyMembership.findFirst({
          where: {
            personId: person.id,
            supersededById: null,
            validFrom: { lte: at },
            OR: [{ validUntil: null }, { validUntil: { gt: at } }],
          },
          select: { family: { select: { id: true, code: true } } },
        });
        data.push({
          enrollment: enrollmentRecord(row),
          person: {
            ...person,
            family: membership
              ? {
                  id: membership.family.id,
                  code: String(membership.family.code),
                }
              : null,
          },
        });
      }
      return {
        data,
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total: await tx.participantEnrollment.count({ where }),
        },
      };
    });
  }
  async run<T>(actorId: string, work: (tx: ProjectsTransaction) => Promise<T>) {
    try {
      return await serializable(this.database, async (tx) => {
        await tx.$queryRaw`SELECT id FROM "UserAccount" WHERE id = ${actorId}::uuid FOR UPDATE`;
        return work(transactionPorts(tx));
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        String(error.meta?.modelName) === 'ServiceType'
      )
        throw new ProjectsConflictError('CATALOG_CODE_EXISTS');
      throw error;
    }
  }
}
