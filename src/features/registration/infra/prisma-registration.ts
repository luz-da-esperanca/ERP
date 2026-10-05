import { Prisma } from '../../../generated/prisma/client.js';
import {
  attendanceTransactionPorts,
  coverageSelect,
  coverageRecord,
} from '../../attendance/infra/prisma-attendance.js';
import {
  databaseOperation,
  serializable,
  type Database,
  type Transaction,
} from '../../../core/infra/database.js';
import type {
  RegistrationReader,
  RegistrationTransaction,
  RegistrationUnitOfWork,
} from '../application/registration-ports.js';
import type {
  RegisteredFamily,
  FamilyLocation,
  RegisteredPerson,
  RegisteredMembership,
  PeopleQuery,
  FamiliesQuery,
  SizeProfile,
} from '../domain/registration.js';
import type { Role } from '@erp/contracts/access';
import { z } from 'zod';
import {
  familyDtoSchema,
  personDtoSchema,
  membershipDtoSchema,
  sizeProfileSchema,
} from '@erp/contracts/registration-api';
import { ResourceNotFoundError } from '../../../core/application/errors.js';
import { normalizeSearch } from '../domain/duplicate-rules.js';
import type {
  DuplicateQuery,
  DuplicateRecord,
} from '../domain/duplicate-rules.js';
import type { QualityQuery, QualityIssue } from '../domain/data-quality.js';
import { dataQualityIssueSchema } from '@erp/contracts/data-quality-api';

const familySelect = {
  id: true,
  code: true,
  referenceName: true,
  address: true,
  neighborhood: true,
  postalCode: true,
  location: true,
  contactPhone: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.FamilySelect;
function projectFamily(
  family: Prisma.FamilyGetPayload<{ select: typeof familySelect }>,
): RegisteredFamily {
  return {
    ...family,
    code: String(family.code),
    location: family.location as FamilyLocation | null,
    createdAt: family.createdAt.toISOString(),
    updatedAt: family.updatedAt.toISOString(),
  };
}
const personSelect = {
  id: true,
  name: true,
  birthDate: true,
  sex: true,
  cpf: true,
  rg: true,
  occupation: true,
  educationLevel: true,
  contactPhone: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PersonSelect;
const membershipSelect = {
  id: true,
  personId: true,
  familyId: true,
  relationshipToReference: true,
  isReference: true,
  validFrom: true,
  validUntil: true,
  revision: true,
} satisfies Prisma.FamilyMembershipSelect;
function projectPerson(
  person: Prisma.PersonGetPayload<{ select: typeof personSelect }>,
): RegisteredPerson {
  return {
    ...person,
    birthDate: person.birthDate?.toISOString().slice(0, 10) ?? null,
    createdAt: person.createdAt.toISOString(),
    updatedAt: person.updatedAt.toISOString(),
  };
}
function projectMembership(
  membership: Prisma.FamilyMembershipGetPayload<{
    select: typeof membershipSelect;
  }>,
): RegisteredMembership {
  return {
    ...membership,
    validFrom: membership.validFrom.toISOString(),
    validUntil: membership.validUntil?.toISOString() ?? null,
  };
}
const sizesSelect = {
  personId: true,
  shoeSize: true,
  clothingSize: true,
  informedOn: true,
  revision: true,
} satisfies Prisma.SizeProfileSelect;
function projectSizes(
  profile: Prisma.SizeProfileGetPayload<{ select: typeof sizesSelect }>,
): SizeProfile {
  return {
    ...profile,
    informedOn: profile.informedOn?.toISOString().slice(0, 10) ?? null,
  };
}
function currentMembershipWhere(
  asOf: string,
): Prisma.FamilyMembershipWhereInput {
  return {
    supersededById: null,
    validFrom: { lte: new Date(asOf) },
    OR: [{ validUntil: null }, { validUntil: { gt: new Date(asOf) } }],
  };
}
const qualitySelect = {
  id: true,
  entityType: true,
  entityId: true,
  kind: true,
  candidateIds: true,
  fieldKeys: true,
  identifiedAt: true,
  resolvedAt: true,
  resolution: true,
  resolvedBy: true,
  reason: true,
  revision: true,
} satisfies Prisma.DataQualityIssueSelect;
function projectQuality(
  issue: Prisma.DataQualityIssueGetPayload<{ select: typeof qualitySelect }>,
): QualityIssue {
  return dataQualityIssueSchema.parse({
    ...issue,
    identifiedAt: issue.identifiedAt.toISOString(),
    resolvedAt: issue.resolvedAt?.toISOString() ?? null,
  });
}
async function duplicateRecords(
  tx: Transaction | Database,
  query: DuplicateQuery,
): Promise<DuplicateRecord[]> {
  const name = normalizeSearch(query.name ?? query.referenceName ?? '');
  const address = normalizeSearch(query.address ?? '');
  if (query.entityType === 'FAMILY') {
    const or: Prisma.FamilyWhereInput[] = [];
    if (name.length >= 2) or.push({ nameSearch: { contains: name } });
    if (address.length >= 2) or.push({ addressSearch: { contains: address } });
    if (!or.length) return [];
    return (
      await tx.family.findMany({
        where: { mergedIntoId: null, OR: or },
        select: { id: true, referenceName: true, address: true },
      })
    ).map((family) => ({
      id: family.id,
      entityType: 'FAMILY',
      name: family.referenceName,
      address: family.address,
      birthDate: null,
      cpf: null,
    }));
  }
  const or: Prisma.PersonWhereInput[] = [];
  if (name.length >= 2) or.push({ nameSearch: { contains: name } });
  if (query.cpf) or.push({ cpf: query.cpf });
  if (!or.length) return [];
  return (
    await tx.person.findMany({
      where: { mergedIntoId: null, OR: or },
      select: { id: true, name: true, birthDate: true, cpf: true },
    })
  ).map((person) => ({
    id: person.id,
    entityType: 'PERSON',
    name: person.name,
    address: null,
    birthDate: person.birthDate?.toISOString().slice(0, 10) ?? null,
    cpf: person.cpf,
  }));
}
export function registrationTransactionPorts(
  tx: Transaction,
): RegistrationTransaction {
  const reference = z
    .object({
      entityType: z.string(),
      entityId: z.uuid(),
      revision: z.number().int().positive(),
    })
    .strict();
  async function readRevision(
    entityType: string,
    entityId: string,
    revision: number,
  ) {
    const entry = await tx.auditEntry.findUnique({
      where: {
        entityType_entityId_revision: { entityType, entityId, revision },
      },
      select: { after: true },
    });
    if (!entry) throw new ResourceNotFoundError();
    return entry.after;
  }
  return {
    coverage: attendanceTransactionPorts(tx, false),
    async personCoverage(personId) {
      return (
        await tx.attendanceCoverage.findMany({
          where: {
            activity: {
              OR: [
                { enrollments: { some: { personId, supersededById: null } } },
                {
                  sessions: {
                    some: {
                      attendances: { some: { personId, supersededById: null } },
                    },
                  },
                },
              ],
            },
          },
          select: coverageSelect,
        })
      ).map(coverageRecord);
    },
    async membershipMarkings(membershipId) {
      return (
        await tx.attendance.findMany({
          where: {
            membershipId,
            supersededById: null,
            session: { status: 'COMPLETED' },
          },
          select: { id: true, session: { select: { occurredAt: true } } },
        })
      ).map((row) => ({
        id: row.id,
        occurredAt: row.session.occurredAt.toISOString(),
      }));
    },
    async recordPossibleDuplicates(
      operationId,
      actorId,
      entityType,
      entityId,
      candidateIds,
    ) {
      const issue = projectQuality(
        await tx.dataQualityIssue.create({
          data: {
            entityType,
            entityId,
            kind: 'POSSIBLE_DUPLICATE',
            candidateIds,
            fieldKeys: [],
          },
          select: qualitySelect,
        }),
      );
      await tx.auditEntry.create({
        data: {
          operationId,
          actorId,
          actorType: 'USER',
          entityType: 'DataQualityIssue',
          entityId: issue.id,
          action: 'CREATE',
          revision: issue.revision,
          classification: 'REGISTRATION',
          after: { ...issue },
        },
      });
    },
    async findQualityIssue(id) {
      await tx.$queryRaw`SELECT id FROM "DataQualityIssue" WHERE id = ${id}::uuid FOR UPDATE`;
      const issue = await tx.dataQualityIssue.findUnique({
        where: { id },
        select: qualitySelect,
      });
      return issue ? projectQuality(issue) : null;
    },
    async resolveQualityIssue(id, actorId, reason) {
      return projectQuality(
        await tx.dataQualityIssue.update({
          where: { id },
          data: {
            resolution: 'DISTINCT',
            reason,
            resolvedBy: actorId,
            resolvedAt: new Date(),
            revision: { increment: 1 },
          },
          select: qualitySelect,
        }),
      );
    },
    async readQualityRevision(id, revision) {
      return dataQualityIssueSchema.parse(
        await readRevision('DataQualityIssue', id, revision),
      );
    },
    async appendQualityResolutionAudit(operationId, actorId, before, after) {
      await tx.auditEntry.create({
        data: {
          operationId,
          actorId,
          actorType: 'USER',
          entityType: 'DataQualityIssue',
          entityId: after.id,
          action: 'UPDATE',
          revision: after.revision,
          classification: 'REGISTRATION',
          reason: after.reason,
          before: { ...before },
          after: { ...after },
        },
      });
    },
    async findPerson(id) {
      const person = await tx.person.findUnique({
        where: { id },
        select: personSelect,
      });
      return person ? projectPerson(person) : null;
    },
    async updatePerson(id, changes) {
      return projectPerson(
        await tx.person.update({
          where: { id },
          data: {
            ...changes,
            revision: { increment: 1 },
            ...(changes.name !== undefined
              ? { nameSearch: normalizeSearch(changes.name) }
              : {}),
            ...(changes.birthDate !== undefined
              ? {
                  birthDate: changes.birthDate
                    ? new Date(changes.birthDate)
                    : null,
                }
              : {}),
          },
          select: personSelect,
        }),
      );
    },
    async appendPersonUpdateAudit(operationId, actorId, before, after) {
      await tx.auditEntry.create({
        data: {
          operationId,
          actorId,
          actorType: 'USER',
          entityType: 'Person',
          entityId: after.id,
          action: 'UPDATE',
          revision: after.revision,
          classification: 'REGISTRATION',
          before: { ...before },
          after: { ...after },
        },
      });
    },
    async sizeProfile(personId) {
      const profile = await tx.sizeProfile.findUnique({
        where: { personId },
        select: sizesSelect,
      });
      return profile ? projectSizes(profile) : null;
    },
    async saveSizes(input) {
      const data = {
        ...input,
        informedOn: input.informedOn ? new Date(input.informedOn) : null,
      };
      return projectSizes(
        await tx.sizeProfile.upsert({
          where: { personId: input.personId },
          create: data,
          update: data,
          select: sizesSelect,
        }),
      );
    },
    async readSizeRevision(id, revision) {
      return sizeProfileSchema.parse(
        await readRevision('SizeProfile', id, revision),
      );
    },
    async appendSizesAudit(operationId, actorId, before, after) {
      await tx.auditEntry.create({
        data: {
          operationId,
          actorId,
          actorType: 'USER',
          entityType: 'SizeProfile',
          entityId: after.personId,
          action: before ? 'UPDATE' : 'CREATE',
          revision: after.revision,
          classification: 'REGISTRATION',
          before: before ? { ...before } : Prisma.DbNull,
          after: { ...after },
        },
      });
    },
    async findMembership(id) {
      const membership = await tx.familyMembership.findUnique({
        where: { id },
        select: membershipSelect,
      });
      return membership ? projectMembership(membership) : null;
    },
    async updateMembership(id, changes) {
      return projectMembership(
        await tx.familyMembership.update({
          where: { id },
          data: {
            ...changes,
            revision: { increment: 1 },
            ...(changes.validFrom !== undefined
              ? { validFrom: new Date(changes.validFrom) }
              : {}),
            ...(changes.validUntil !== undefined
              ? {
                  validUntil: changes.validUntil
                    ? new Date(changes.validUntil)
                    : null,
                }
              : {}),
          },
          select: membershipSelect,
        }),
      );
    },
    async appendMembershipUpdateAudit(
      operationId,
      actorId,
      before,
      after,
      reason,
      action,
      occurredAt,
    ) {
      await tx.auditEntry.create({
        data: {
          operationId,
          actorId,
          actorType: 'USER',
          entityType: 'FamilyMembership',
          entityId: after.id,
          action,
          revision: after.revision,
          classification: 'REGISTRATION',
          reason,
          occurredAt: new Date(occurredAt),
          before: { ...before },
          after: { ...after },
        },
      });
    },
    duplicateRecords: (query) => duplicateRecords(tx, query),
    async recordDuplicateReview(
      operationId,
      actorId,
      entityType,
      entityId,
      review,
    ) {
      const issue = await tx.dataQualityIssue.create({
        data: {
          entityType,
          entityId,
          kind: 'POSSIBLE_DUPLICATE',
          candidateIds: review.candidateIds,
          fieldKeys: [],
          resolvedAt: new Date(),
          resolvedBy: actorId,
          resolution: 'DISTINCT',
          reason: review.reason,
        },
      });
      await tx.auditEntry.create({
        data: {
          operationId,
          actorId,
          actorType: 'USER',
          entityType: 'DataQualityIssue',
          entityId: issue.id,
          action: 'CREATE',
          revision: 1,
          classification: 'REGISTRATION',
          reason: review.reason,
          after: {
            ...issue,
            identifiedAt: issue.identifiedAt.toISOString(),
            resolvedAt: issue.resolvedAt?.toISOString() ?? null,
          },
        },
      });
    },
    async findOperation(type, key) {
      const operation = await tx.operationRecord.findUnique({
        where: { type_key: { type, key } },
      });
      return operation
        ? {
            actorId: operation.actorId,
            fingerprint: operation.requestFingerprint,
            resultReference: z
              .union([
                reference,
                z
                  .object({
                    person: reference,
                    membership: reference,
                    family: reference,
                  })
                  .strict(),
                z
                  .object({
                    previousMembership: reference,
                    membership: reference,
                    sourceFamily: reference,
                    targetFamily: reference,
                  })
                  .strict(),
              ])
              .or(
                z
                  .object({
                    family: reference,
                    memberships: z.array(reference),
                  })
                  .strict(),
              )
              .parse(operation.resultReference),
          }
        : null;
    },
    async readFamilyRevision(entityId, revision) {
      return familyDtoSchema.parse(
        await readRevision('Family', entityId, revision),
      );
    },
    async readPersonRevision(id, revision) {
      return personDtoSchema.parse(await readRevision('Person', id, revision));
    },
    async readMembershipRevision(id, revision) {
      return membershipDtoSchema.parse(
        await readRevision('FamilyMembership', id, revision),
      );
    },
    async findFamily(id) {
      const family = await tx.family.findUnique({
        where: { id },
        select: familySelect,
      });
      return family ? projectFamily(family) : null;
    },
    async memberships(familyIds, personIds = []) {
      return (
        await tx.familyMembership.findMany({
          where: {
            OR: [
              { familyId: { in: [...familyIds] } },
              { personId: { in: [...personIds] } },
            ],
            supersededById: null,
          },
          select: membershipSelect,
        })
      ).map(projectMembership);
    },
    async createPerson(input) {
      return projectPerson(
        await tx.person.create({
          data: {
            ...input,
            nameSearch: normalizeSearch(input.name),
            birthDate: input.birthDate ? new Date(input.birthDate) : null,
          },
          select: personSelect,
        }),
      );
    },
    async createMembership(input) {
      return projectMembership(
        await tx.familyMembership.create({
          data: {
            ...input,
            validFrom: new Date(input.validFrom),
            validUntil: input.validUntil ? new Date(input.validUntil) : null,
          },
          select: membershipSelect,
        }),
      );
    },
    async reviseFamily(id) {
      return projectFamily(
        await tx.family.update({
          where: { id },
          data: { revision: { increment: 1 } },
          select: familySelect,
        }),
      );
    },
    async updateFamily(id, changes) {
      return projectFamily(
        await tx.family.update({
          where: { id },
          data: {
            ...changes,
            revision: { increment: 1 },
            ...(changes.referenceName !== undefined
              ? { nameSearch: normalizeSearch(changes.referenceName ?? '') }
              : {}),
            ...(changes.address !== undefined
              ? { addressSearch: normalizeSearch(changes.address ?? '') }
              : {}),
          },
          select: familySelect,
        }),
      );
    },
    async appendPersonAudit(operationId, actorId, person) {
      await tx.auditEntry.create({
        data: {
          operationId,
          actorId,
          actorType: 'USER',
          entityType: 'Person',
          entityId: person.id,
          action: 'CREATE',
          revision: person.revision,
          classification: 'REGISTRATION',
          after: { ...person },
        },
      });
    },
    async appendMembershipAudit(operationId, actorId, membership) {
      await tx.auditEntry.create({
        data: {
          operationId,
          actorId,
          actorType: 'USER',
          entityType: 'FamilyMembership',
          entityId: membership.id,
          action: 'CREATE',
          revision: membership.revision,
          classification: 'REGISTRATION',
          occurredAt: new Date(membership.validFrom),
          after: { ...membership },
        },
      });
    },
    async appendFamilyUpdateAudit(operationId, actorId, before, after) {
      await tx.auditEntry.create({
        data: {
          operationId,
          actorId,
          actorType: 'USER',
          entityType: 'Family',
          entityId: after.id,
          action: 'UPDATE',
          revision: after.revision,
          classification: 'REGISTRATION',
          before: { ...before },
          after: { ...after },
        },
      });
    },
    async findActor(id) {
      const account = await tx.userAccount.findUnique({
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
      if (!account) return null;
      return {
        authVersion: account.authVersion,
        sessionId: '',
        user: {
          id: account.id,
          login: account.login,
          displayName: account.displayName,
          active: account.active,
          mustChangePassword: account.mustChangePassword,
          revision: account.revision,
          roleCodes: account.roles.map((role) => role.roleCode as Role),
          createdAt: account.createdAt.toISOString(),
          updatedAt: account.updatedAt.toISOString(),
        },
      };
    },
    async createFamily(input) {
      return projectFamily(
        await tx.family.create({
          data: {
            ...input,
            nameSearch: normalizeSearch(input.referenceName ?? ''),
            addressSearch: normalizeSearch(input.address ?? ''),
          },
          select: familySelect,
        }),
      );
    },
    async createOperation(type, key, actorId, requestFingerprint) {
      return (
        await tx.operationRecord.create({
          data: { type, key, actorId, actorType: 'USER', requestFingerprint },
          select: { id: true },
        })
      ).id;
    },
    async appendFamilyAudit(operationId, actorId, family) {
      await tx.auditEntry.create({
        data: {
          operationId,
          actorId,
          actorType: 'USER',
          entityType: 'Family',
          entityId: family.id,
          action: 'CREATE',
          revision: family.revision,
          classification: 'REGISTRATION',
          after: { ...family },
        },
      });
    },
    async completeOperation(id, reference) {
      const resultReference =
        'entityId' in reference
          ? { ...reference }
          : 'person' in reference
            ? {
                person: { ...reference.person },
                membership: { ...reference.membership },
                family: { ...reference.family },
              }
            : 'previousMembership' in reference
              ? {
                  previousMembership: { ...reference.previousMembership },
                  membership: { ...reference.membership },
                  sourceFamily: { ...reference.sourceFamily },
                  targetFamily: { ...reference.targetFamily },
                }
              : {
                  family: { ...reference.family },
                  memberships: reference.memberships.map((ref) => ({ ...ref })),
                };
      await tx.operationRecord.update({
        where: { id },
        data: { resultReference, completedAt: new Date() },
      });
    },
  };
}
export class PrismaRegistration
  implements RegistrationReader, RegistrationUnitOfWork
{
  constructor(private readonly database: Database) {}
  qualityIssues(query: QualityQuery) {
    const where: Prisma.DataQualityIssueWhereInput = {
      entityType: query.entityType,
      kind: query.kind,
      ...(query.status === 'OPEN'
        ? { resolvedAt: null }
        : query.status === 'RESOLVED'
          ? { resolvedAt: { not: null } }
          : {}),
    };
    return databaseOperation(() =>
      this.database.$transaction(
        async (tx) => {
          const total = await tx.dataQualityIssue.count({ where });
          const rows = await tx.dataQualityIssue.findMany({
            where,
            select: qualitySelect,
            orderBy: [{ identifiedAt: 'desc' }, { id: 'desc' }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
          });
          return {
            data: rows.map(projectQuality),
            pagination: { page: query.page, pageSize: query.pageSize, total },
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      ),
    );
  }
  families(query: FamiliesQuery) {
    const where: Prisma.FamilyWhereInput = {
      mergedIntoId: null,
      ...(query.code ? { code: BigInt(query.code) } : {}),
      ...(query.q
        ? {
            OR: [
              { nameSearch: { contains: normalizeSearch(query.q) } },
              { addressSearch: { contains: normalizeSearch(query.q) } },
            ],
          }
        : {}),
    };
    return databaseOperation(() =>
      this.database.$transaction(
        async (tx) => {
          const total = await tx.family.count({ where });
          const families = await tx.family.findMany({
            where,
            orderBy: [{ code: 'asc' }, { id: 'asc' }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
            select: {
              ...familySelect,
              memberships: {
                where: currentMembershipWhere(query.asOf),
                select: {
                  personId: true,
                  isReference: true,
                  person: { select: { name: true } },
                },
              },
            },
          });
          return {
            data: families.map(({ memberships, ...family }) => ({
              ...projectFamily(family),
              memberCount: new Set(memberships.map((row) => row.personId)).size,
              referencePersonName:
                memberships.find((row) => row.isReference)?.person.name ?? null,
            })),
            pagination: { page: query.page, pageSize: query.pageSize, total },
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      ),
    );
  }
  person(id: string, asOf: string, minimal: boolean) {
    return databaseOperation(() =>
      this.database.$transaction(
        async (tx) => {
          const current = await tx.familyMembership.findFirst({
            where: { personId: id, ...currentMembershipWhere(asOf) },
            select: { family: { select: { id: true, code: true } } },
          });
          const family = current
            ? { id: current.family.id, code: String(current.family.code) }
            : null;
          if (minimal) {
            const person = await tx.person.findUnique({
              where: { id },
              select: { id: true, name: true },
            });
            return person ? { ...person, family } : null;
          }
          const person = await tx.person.findUnique({
            where: { id },
            select: {
              ...personSelect,
              memberships: {
                where: { supersededById: null },
                select: membershipSelect,
                orderBy: [{ validFrom: 'asc' }, { id: 'asc' }],
              },
              sizeProfile: { select: sizesSelect },
            },
          });
          if (!person) return null;
          const { memberships, sizeProfile, ...fields } = person;
          return {
            person: projectPerson(fields),
            memberships: memberships.map(projectMembership),
            currentFamily: family,
            sizeProfile: sizeProfile ? projectSizes(sizeProfile) : null,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      ),
    );
  }
  membership(id: string) {
    return databaseOperation(async () => {
      const membership = await this.database.familyMembership.findUnique({
        where: { id },
        select: membershipSelect,
      });
      return membership ? projectMembership(membership) : null;
    });
  }
  duplicateRecords(query: DuplicateQuery) {
    return databaseOperation(() => duplicateRecords(this.database, query));
  }
  people(query: PeopleQuery, minimal: boolean) {
    const membershipWhere: Prisma.FamilyMembershipWhereInput = {
      supersededById: null,
      validFrom: { lte: new Date(query.asOf) },
      OR: [{ validUntil: null }, { validUntil: { gt: new Date(query.asOf) } }],
    };
    const where: Prisma.PersonWhereInput = {
      mergedIntoId: null,
      ...(query.q
        ? { nameSearch: { contains: normalizeSearch(query.q) } }
        : {}),
      ...(query.birthDate ? { birthDate: new Date(query.birthDate) } : {}),
      ...(query.cpf ? { cpf: query.cpf } : {}),
      ...(query.familyId
        ? {
            memberships: {
              some: { ...membershipWhere, familyId: query.familyId },
            },
          }
        : {}),
    };
    return databaseOperation(() =>
      this.database.$transaction(
        async (tx) => {
          const options = {
            where,
            orderBy: [{ name: 'asc' as const }, { id: 'asc' as const }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
          };
          const total = await tx.person.count({ where });
          if (minimal) {
            const rows = await tx.person.findMany({
              ...options,
              select: {
                id: true,
                name: true,
                memberships: {
                  where: membershipWhere,
                  select: { family: { select: { id: true, code: true } } },
                },
              },
            });
            return {
              data: rows.map((row) => ({
                id: row.id,
                name: row.name,
                family: row.memberships[0]
                  ? {
                      id: row.memberships[0].family.id,
                      code: String(row.memberships[0].family.code),
                    }
                  : null,
              })),
              pagination: { page: query.page, pageSize: query.pageSize, total },
            };
          }
          return {
            data: (
              await tx.person.findMany({ ...options, select: personSelect })
            ).map(projectPerson),
            pagination: { page: query.page, pageSize: query.pageSize, total },
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      ),
    );
  }
  family(id: string, asOf: string) {
    return databaseOperation(async () => {
      return this.database.$transaction(
        async (tx) => {
          const family = await tx.family.findUnique({
            where: { id },
            select: familySelect,
          });
          if (!family) return null;
          const memberships = await tx.familyMembership.findMany({
            where: {
              familyId: id,
              supersededById: null,
              validFrom: { lte: new Date(asOf) },
              OR: [
                { validUntil: null },
                { validUntil: { gt: new Date(asOf) } },
              ],
            },
            select: { ...membershipSelect, person: { select: personSelect } },
            orderBy: [{ personId: 'asc' }, { id: 'asc' }],
          });
          const members = memberships.map(({ person, ...membership }) => ({
            person: projectPerson(person),
            membership: projectMembership(membership),
          }));
          return {
            family: {
              ...projectFamily(family),
              memberCount: new Set(members.map((member) => member.person.id))
                .size,
              referencePersonName:
                members.find((member) => member.membership.isReference)?.person
                  .name ?? null,
            },
            members,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    });
  }
  run<T>(
    actorId: string,
    familyIds: readonly string[],
    work: (tx: RegistrationTransaction) => Promise<T>,
    personIds: readonly string[] = [],
  ) {
    return serializable(this.database, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "UserAccount" WHERE id = ${actorId}::uuid FOR UPDATE`;
      if (personIds.length)
        await tx.$queryRaw`SELECT id FROM "Person" WHERE id IN (${Prisma.join([...new Set(personIds)].sort().map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`;
      if (familyIds.length)
        await tx.$queryRaw`SELECT id FROM "Family" WHERE id IN (${Prisma.join([...new Set(familyIds)].sort().map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`;
      return work(registrationTransactionPorts(tx));
    });
  }
}
