import { z } from 'zod';
import { Prisma } from '../../../generated/prisma/client.js';
import {
  databaseOperation,
  serializable,
  type Database,
  type Transaction,
} from '../../../core/infra/database.js';
import { ResourceNotFoundError } from '../../../core/application/errors.js';
import { SocialFormConflictError } from '../domain/social-form-errors.js';
import type {
  SocialFormsRepository,
  SocialFormsTransaction,
  SocialFormsReadTransaction,
} from '../application/social-forms-ports.js';
import { registrationTransactionPorts } from '../../registration/infra/prisma-registration.js';
import type {
  StoredSocialForm,
  SocialFormSource,
} from '../domain/social-forms.js';
import {
  fieldSelectionDtoSchema,
  featureDecisionDtoSchema,
  socialOptionDtoSchema,
} from '@erp/contracts/social-forms-api';
import {
  storedSocialFormSchema,
  storedFormMemberSchema,
  socialSnapshotSchemas,
  projectSocialFormSummary,
} from './social-form-projections.js';
import { initialSocialOptions } from '../domain/initial-social-options.js';
import { resolveSizeProfileId } from '../domain/social-form-rules.js';

const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const referenceSchema = z
  .object({
    entityType: z.enum([
      'SocialForm',
      'Acknowledgement',
      'FieldSelectionVersion',
      'FeatureDecision',
      'SocialFormOption',
    ]),
    id: z.uuid(),
    revision: z.number().int().positive(),
  })
  .strict();
const formInclude = {
  members: { orderBy: { personId: 'asc' as const } },
  acknowledgement: true,
  family: { select: { mergedIntoId: true } },
} satisfies Prisma.SocialFormInclude;
type FormRow = Prisma.SocialFormGetPayload<{ include: typeof formInclude }>;
function formRecord(row: FormRow): StoredSocialForm {
  return storedSocialFormSchema.parse({
    id: row.id,
    familyId: row.familyId,
    version: row.version,
    previousVersionId: row.previousVersionId,
    correctionOfFormId: row.correctionOfFormId,
    referenceMemberId: row.referenceMemberId,
    occurredAt: row.occurredAt.toISOString(),
    recordedAt: row.recordedAt.toISOString(),
    recordedBy: row.recordedBy,
    familySnapshot: row.familySnapshot,
    fieldSelectionVersionId: row.fieldSelectionVersionId,
    originFamilyId: row.family.mergedIntoId ? row.familyId : null,
    originalVersion: row.family.mergedIntoId ? row.version : null,
    reason: row.reason,
    blocks: row.blocks,
    members: row.members.map((member) =>
      storedFormMemberSchema.parse(member.payload),
    ),
    acknowledgement: row.acknowledgement
      ? {
          ...row.acknowledgement,
          acknowledgedOn: row.acknowledgement.acknowledgedOn
            .toISOString()
            .slice(0, 10),
          recordedAt: row.acknowledgement.recordedAt.toISOString(),
        }
      : null,
  });
}
async function familyOrigins(tx: Transaction, id: string, lock: boolean) {
  let canonicalId = id;
  const visited = new Set<string>();
  while (!visited.has(canonicalId)) {
    visited.add(canonicalId);
    const family = await tx.family.findUnique({
      where: { id: canonicalId },
      select: { mergedIntoId: true },
    });
    if (!family) return null;
    if (!family.mergedIntoId) break;
    canonicalId = family.mergedIntoId;
  }
  const origins = await tx.$queryRaw<
    Array<{ id: string }>
  >`WITH RECURSIVE origins AS (SELECT id FROM "Family" WHERE id = ${canonicalId}::uuid UNION SELECT family.id FROM "Family" family JOIN origins ON family."mergedIntoId" = origins.id) SELECT id FROM origins ORDER BY id`;
  if (lock)
    await tx.$queryRaw`SELECT id FROM "Family" WHERE id IN (${Prisma.join(origins.map((row) => row.id))}) ORDER BY id FOR UPDATE`;
  return { canonicalId, ids: origins.map((row) => row.id) };
}
function ports(tx: Transaction, lock: boolean): SocialFormsTransaction {
  const registration = registrationTransactionPorts(tx);
  const reader: SocialFormsReadTransaction = {
    async configuration() {
      const selection = await tx.fieldSelectionVersion.findFirst({
        orderBy: { version: 'desc' },
      });
      return {
        selection: selection
          ? fieldSelectionDtoSchema.parse({
              ...selection,
              recordedAt: selection.recordedAt.toISOString(),
            })
          : null,
        options: (
          await tx.socialFormOption.findMany({
            orderBy: [{ fieldKey: 'asc' }, { code: 'asc' }],
          })
        ).map((option) => socialOptionDtoSchema.parse(option)),
        decisions: (
          await tx.featureDecision.findMany({ orderBy: { code: 'asc' } })
        ).map((decision) =>
          featureDecisionDtoSchema.parse({
            ...decision,
            decidedAt: decision.decidedAt.toISOString(),
          }),
        ),
      };
    },
    async selection(id) {
      const row = await tx.fieldSelectionVersion.findUnique({ where: { id } });
      return row
        ? fieldSelectionDtoSchema.parse({
            ...row,
            recordedAt: row.recordedAt.toISOString(),
          })
        : null;
    },
    async form(id) {
      if (lock)
        await tx.$queryRaw`SELECT id FROM "SocialForm" WHERE id = ${id}::uuid FOR UPDATE`;
      const row = await tx.socialForm.findUnique({
        where: { id },
        include: formInclude,
      });
      return row ? formRecord(row) : null;
    },
    async context(familyId, occurredAt) {
      const origins = await familyOrigins(tx, familyId, lock);
      if (!origins) return null;
      const family = await registration.findFamily(origins.canonicalId);
      if (!family) return null;
      const at = new Date(occurredAt);
      const memberships = (await registration.memberships(origins.ids)).filter(
        (member) =>
          Date.parse(member.validFrom) <= at.getTime() &&
          (member.validUntil === null ||
            Date.parse(member.validUntil) > at.getTime()),
      );
      if (lock && memberships.length) {
        await tx.$queryRaw`SELECT id FROM "Person" WHERE id IN (${Prisma.join(memberships.map((member) => member.personId))}) ORDER BY id FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "FamilyMembership" WHERE id IN (${Prisma.join(memberships.map((member) => member.id))}) ORDER BY id FOR UPDATE`;
        await tx.$queryRaw`SELECT "personId" FROM "SizeProfile" WHERE "personId" IN (${Prisma.join(memberships.map((member) => member.personId))}) ORDER BY "personId" FOR UPDATE`;
      }
      const members: SocialFormSource['members'] = [];
      for (const membership of memberships.sort((left, right) =>
        left.personId.localeCompare(right.personId),
      )) {
        let personId = membership.personId;
        const seen = new Set<string>();
        while (!seen.has(personId)) {
          seen.add(personId);
          const alias = await tx.person.findUnique({
            where: { id: personId },
            select: { mergedIntoId: true },
          });
          if (!alias?.mergedIntoId) break;
          personId = alias.mergedIntoId;
        }
        const person = await registration.findPerson(personId);
        if (!person || members.some((member) => member.person.id === person.id))
          throw new SocialFormConflictError('MEMBERSHIP_CHANGED');
        const sizes = await tx.$queryRaw<
          Array<{ personId: string }>
        >`WITH RECURSIVE aliases AS (SELECT id FROM "Person" WHERE id = ${personId}::uuid UNION SELECT person.id FROM "Person" person JOIN aliases ON person."mergedIntoId" = aliases.id) SELECT sizes."personId" FROM "SizeProfile" sizes JOIN aliases ON sizes."personId" = aliases.id ORDER BY (sizes."personId" = ${personId}::uuid) DESC, sizes."personId" ASC`;
        if (lock && personId !== membership.personId)
          await tx.$queryRaw`SELECT id FROM "Person" WHERE id = ${personId}::uuid FOR UPDATE`;
        if (lock && sizes.length)
          await tx.$queryRaw`SELECT "personId" FROM "SizeProfile" WHERE "personId" IN (${Prisma.join(sizes.map((row) => row.personId))}) ORDER BY "personId" FOR UPDATE`;
        const sizeProfilePersonId = resolveSizeProfileId(
          personId,
          sizes.map((row) => row.personId),
        );
        members.push({
          person,
          membership,
          sizeProfile: sizeProfilePersonId
            ? await registration.sizeProfile(sizeProfilePersonId)
            : null,
        });
      }
      const latest = await tx.socialForm.findFirst({
        where: { familyId: { in: origins.ids } },
        orderBy: [
          { recordedAt: 'desc' },
          { familyId: 'asc' },
          { version: 'desc' },
          { id: 'asc' },
        ],
        select: { id: true },
      });
      const previous = await tx.socialForm.findFirst({
        where: { familyId: origins.canonicalId },
        orderBy: { version: 'desc' },
        select: { id: true, version: true },
      });
      return {
        family,
        familyIds: origins.ids,
        members: members.sort((left, right) =>
          left.person.id.localeCompare(right.person.id),
        ),
        latestPublishedFormId: latest?.id ?? null,
        expectedPreviousVersionId: previous?.id ?? null,
        previousVersion: previous?.version ?? 0,
      };
    },
    async forms(familyId, query) {
      const origins = await familyOrigins(tx, familyId, false);
      if (!origins) return null;
      const where = { familyId: { in: origins.ids } };
      const rows = await tx.socialForm.findMany({
        where,
        orderBy: [
          ...(query.orderBy === 'occurredAt'
            ? [{ occurredAt: 'desc' as const }]
            : []),
          { recordedAt: 'desc' },
          { familyId: 'asc' },
          { version: 'desc' },
          { id: 'asc' },
        ],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      });
      return {
        data: rows.map((row) =>
          projectSocialFormSummary(row, origins.canonicalId),
        ),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total: await tx.socialForm.count({ where }),
        },
      };
    },
  };
  return {
    ...reader,
    findActor: (id) => registration.findActor(id),
    async findOperation(type, key) {
      const row = await tx.operationRecord.findUnique({
        where: { type_key: { type, key } },
        select: {
          actorId: true,
          requestFingerprint: true,
          fingerprintKeyId: true,
          resultReference: true,
        },
      });
      return row
        ? {
            actorId: row.actorId,
            fingerprint: row.requestFingerprint,
            fingerprintKeyId: z.string().min(1).parse(row.fingerprintKeyId),
            reference: referenceSchema.parse(row.resultReference),
          }
        : null;
    },
    async createOperation(
      type,
      key,
      actorId,
      requestFingerprint,
      fingerprintKeyId,
    ) {
      return (
        await tx.operationRecord.create({
          data: {
            type,
            key,
            actorId,
            actorType: 'USER',
            requestFingerprint,
            fingerprintKeyId,
          },
          select: { id: true },
        })
      ).id;
    },
    async completeOperation(id, reference) {
      await tx.operationRecord.update({
        where: { id },
        data: { resultReference: json(reference), completedAt: new Date() },
      });
    },
    async readRevision(reference) {
      const entry = await tx.auditEntry.findUnique({
        where: {
          entityType_entityId_revision: {
            entityType: reference.entityType,
            entityId: reference.id,
            revision: reference.revision,
          },
        },
        select: { after: true },
      });
      if (entry)
        return socialSnapshotSchemas[reference.entityType].parse(entry.after);
      if (
        reference.entityType === 'SocialFormOption' &&
        reference.revision === 1
      ) {
        const current = await tx.socialFormOption.findUnique({
          where: { id: reference.id },
        });
        const initial = initialSocialOptions.find(
          (option) =>
            option.fieldKey === current?.fieldKey &&
            option.code === current.code,
        );
        if (initial) return { ...initial, id: reference.id };
      }
      const next = await tx.auditEntry.findUnique({
        where: {
          entityType_entityId_revision: {
            entityType: reference.entityType,
            entityId: reference.id,
            revision: reference.revision + 1,
          },
        },
        select: { before: true },
      });
      if (next?.before)
        return socialSnapshotSchemas[reference.entityType].parse(next.before);
      const config = await reader.configuration();
      const current = [...config.decisions, ...config.options].find(
        (value) =>
          value.id === reference.id && value.revision === reference.revision,
      );
      if (current) return current;
      throw new ResourceNotFoundError();
    },
    async saveSelection(selection) {
      await tx.fieldSelectionVersion.create({
        data: {
          ...selection,
          recordedAt: new Date(selection.recordedAt),
          fields: json(selection.fields),
        },
      });
    },
    async saveDecision(decision) {
      const data = { ...decision, decidedAt: new Date(decision.decidedAt) };
      await tx.featureDecision.upsert({
        where: { code: decision.code },
        create: data,
        update: data,
      });
    },
    async saveOption(option) {
      await tx.socialFormOption.upsert({
        where: { id: option.id },
        create: option,
        update: {
          label: option.label,
          active: option.active,
          revision: option.revision,
        },
      });
    },
    async createForm(form) {
      await tx.socialForm.create({
        data: {
          id: form.id,
          familyId: form.familyId,
          version: form.version,
          previousVersionId: form.previousVersionId,
          correctionOfFormId: form.correctionOfFormId,
          referenceMemberId: form.referenceMemberId,
          occurredAt: new Date(form.occurredAt),
          recordedAt: new Date(form.recordedAt),
          recordedBy: form.recordedBy,
          fieldSelectionVersionId: form.fieldSelectionVersionId,
          familySnapshot: json(form.familySnapshot),
          blocks: json(form.blocks),
          reason: form.reason,
        },
      });
      await tx.formMember.createMany({
        data: form.members.map((member) => ({
          id: member.id,
          socialFormId: form.id,
          personId: member.personId,
          membershipId: member.membershipId,
          membershipRevision: member.membershipRevision,
          payload: json(member),
        })),
      });
    },
    async saveAcknowledgement(acknowledgement) {
      const data = {
        ...acknowledgement,
        acknowledgedOn: new Date(acknowledgement.acknowledgedOn),
        recordedAt: new Date(acknowledgement.recordedAt),
      };
      await tx.acknowledgement.upsert({
        where: { id: acknowledgement.id },
        create: data,
        update: data,
      });
    },
    async audit(input) {
      await tx.auditEntry.create({
        data: {
          operationId: input.operationId,
          actorId: input.actorId,
          actorType: 'USER',
          entityType: input.entityType,
          entityId: input.after.id,
          revision:
            'version' in input.after
              ? input.after.version
              : input.after.revision,
          action: input.action,
          occurredAt: input.occurredAt ? new Date(input.occurredAt) : null,
          recordedAt: new Date(),
          classification: ['SocialForm', 'Acknowledgement'].includes(
            input.entityType,
          )
            ? 'SOCIAL_FORMS'
            : 'FEATURE_DECISIONS',
          before: input.before ? json(input.before) : Prisma.DbNull,
          after: json(input.after),
          reason: input.reason,
        },
      });
    },
  };
}
export class PrismaSocialForms implements SocialFormsRepository {
  constructor(private readonly database: Database) {}
  read<T>(work: (tx: SocialFormsReadTransaction) => Promise<T>) {
    return databaseOperation(() =>
      this.database.$transaction((tx) => work(ports(tx, false)), {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      }),
    );
  }
  async run<T>(
    actorId: string,
    work: (tx: SocialFormsTransaction) => Promise<T>,
  ) {
    try {
      return await serializable(this.database, async (tx) => {
        await tx.$queryRaw`SELECT id FROM "UserAccount" WHERE id = ${actorId}::uuid FOR UPDATE`;
        // Configuration changes and publication share the same lock so a disabled block cannot race a write.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('socialForms.configuration'))`;
        return work(ports(tx, true));
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new SocialFormConflictError('PUBLICATION_BASE_CHANGED');
      throw error;
    }
  }
}
