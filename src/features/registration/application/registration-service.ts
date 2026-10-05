import type {
  CreateRegisteredFamily,
  CreateRegisteredPerson,
  FamilyPatch,
  PeopleQuery,
  MembershipTransfer,
  ReferenceChange,
  RegisteredMembership,
} from '../domain/registration.js';
import type {
  RegistrationReader,
  RegistrationUnitOfWork,
} from './registration-ports.js';
import type {
  CommandContext,
  Principal,
} from '../../access/application/ports.js';
import type { OperationFingerprints } from '../../access/application/account-transactions.js';
import {
  assertPermission,
  capabilitiesFor,
} from '../../access/domain/permissions.js';
import { PermissionDeniedError } from '../../access/domain/account-errors.js';
import { AuthenticationRequiredError } from '../../access/application/access-errors.js';
import {
  ResourceNotFoundError,
  IdempotencyConflictError,
} from '../../../core/application/errors.js';
import {
  RegistrationRevisionConflictError,
  RegistrationRuleError,
  RegistrationConflictError,
} from '../domain/registration-errors.js';
import {
  assertMembershipPlan,
  isMembershipCurrent,
} from '../domain/membership-rules.js';
import {
  identifyDuplicateCandidates,
  assertDuplicateReview,
} from '../domain/duplicate-rules.js';
import type { DuplicateQuery } from '../domain/duplicate-rules.js';
import type {
  FamiliesQuery,
  MembershipClosure,
  PersonPatch,
  SizesInput,
} from '../domain/registration.js';
import type { RegistrationTransaction } from './registration-ports.js';
import type { MembershipCorrection } from '../domain/registration.js';
import {
  invalidateCoverage,
  changedCivilPeriods,
} from '../../attendance/application/coverage-invalidation.js';
import type {
  QualityQuery,
  ResolveQualityIssue,
} from '../domain/data-quality.js';

export class RegistrationService {
  constructor(
    private readonly reader: RegistrationReader,
    private readonly unitOfWork: RegistrationUnitOfWork,
    private readonly fingerprints: OperationFingerprints,
    private readonly now: () => string,
    private readonly today: () => string,
    private readonly timeZone: string,
  ) {}
  private async assertMembershipFacts(
    tx: RegistrationTransaction,
    next: RegisteredMembership,
  ) {
    const invalid = (await tx.membershipMarkings(next.id)).filter(
      (row) => !isMembershipCurrent(next, row.occurredAt),
    );
    if (invalid.length)
      throw new RegistrationConflictError(
        'MEMBERSHIP_ATTENDANCE_CONFLICT',
        invalid.map((row) => row.id),
      );
  }
  private async invalidateMembershipCoverage(
    tx: RegistrationTransaction,
    operationId: string,
    actorId: string,
    before: RegisteredMembership,
    after: RegisteredMembership,
  ) {
    await invalidateCoverage(
      tx.coverage,
      await tx.personCoverage(before.personId),
      changedCivilPeriods(before, after, this.timeZone),
      operationId,
      actorId,
      this.now(),
      'MEMBERSHIP_CHANGED',
    );
  }

  private async authorizedActor(
    tx: RegistrationTransaction,
    context: CommandContext,
  ) {
    const actor = await tx.findActor(context.actor.user.id);
    if (!actor?.user.active || actor.authVersion !== context.actor.authVersion)
      throw new AuthenticationRequiredError();
    assertPermission(
      actor.user.roleCodes,
      actor.user.mustChangePassword,
      'registration.write',
    );
    return actor;
  }

  async createFamily(context: CommandContext, input: CreateRegisteredFamily) {
    return this.unitOfWork.run(context.actor.user.id, [], async (tx) => {
      const actor = await this.authorizedActor(tx, context);
      const fingerprint = this.fingerprints.calculate(
        { type: 'registration.families.create', input },
        null,
      );
      const existing = await tx.findOperation(
        'registration.families.create',
        context.key,
      );
      if (existing) {
        if (
          existing.actorId !== actor.user.id ||
          !this.fingerprints.matches(existing.fingerprint, fingerprint)
        )
          throw new IdempotencyConflictError();
        if (!('entityId' in existing.resultReference))
          throw new IdempotencyConflictError();
        return tx.readFamilyRevision(
          existing.resultReference.entityId,
          existing.resultReference.revision,
        );
      }
      const query: DuplicateQuery = {
        entityType: 'FAMILY',
        referenceName: input.referenceName ?? undefined,
        address: input.address ?? undefined,
      };
      const candidates = identifyDuplicateCandidates(
        await tx.duplicateRecords(query),
        query,
      );
      assertDuplicateReview(candidates, input.duplicateReview);
      const operationId = await tx.createOperation(
        'registration.families.create',
        context.key,
        actor.user.id,
        fingerprint,
      );
      const { duplicateReview, ...fields } = input;
      const family = await tx.createFamily(fields);
      await tx.appendFamilyAudit(operationId, actor.user.id, family);
      if (duplicateReview)
        await tx.recordDuplicateReview(
          operationId,
          actor.user.id,
          'FAMILY',
          family.id,
          duplicateReview,
        );
      await tx.completeOperation(operationId, {
        entityType: 'Family',
        entityId: family.id,
        revision: family.revision,
      });
      return family;
    });
  }
  async createPerson(context: CommandContext, input: CreateRegisteredPerson) {
    return this.unitOfWork.run(
      context.actor.user.id,
      [input.familyId],
      async (tx) => {
        const actor = await this.authorizedActor(tx, context);
        const type = 'registration.people.create';
        const fingerprint = this.fingerprints.calculate({ type, input }, null);
        const existing = await tx.findOperation(type, context.key);
        if (existing) {
          if (
            existing.actorId !== actor.user.id ||
            !this.fingerprints.matches(existing.fingerprint, fingerprint) ||
            !('person' in existing.resultReference)
          )
            throw new IdempotencyConflictError();
          const refs = existing.resultReference;
          return {
            person: await tx.readPersonRevision(
              refs.person.entityId,
              refs.person.revision,
            ),
            membership: await tx.readMembershipRevision(
              refs.membership.entityId,
              refs.membership.revision,
            ),
            family: await tx.readFamilyRevision(
              refs.family.entityId,
              refs.family.revision,
            ),
          };
        }
        const {
          familyId,
          expectedFamilyRevision,
          validFrom,
          relationshipToReference,
          isReference,
          duplicateReview,
          ...fields
        } = input;
        const before = await tx.findFamily(familyId);
        if (!before) throw new ResourceNotFoundError();
        if (before.revision !== expectedFamilyRevision)
          throw new RegistrationRevisionConflictError(before.revision);
        if (input.birthDate && input.birthDate > this.today())
          throw new RegistrationRuleError('FUTURE_BIRTH_DATE');
        const query: DuplicateQuery = {
          entityType: 'PERSON',
          name: input.name,
          birthDate: input.birthDate ?? undefined,
          cpf: input.cpf ?? undefined,
        };
        assertDuplicateReview(
          identifyDuplicateCandidates(await tx.duplicateRecords(query), query),
          input.duplicateReview,
        );
        const operationId = await tx.createOperation(
          type,
          context.key,
          actor.user.id,
          fingerprint,
        );
        const person = await tx.createPerson(fields);
        const membership = await tx.createMembership({
          personId: person.id,
          familyId,
          validFrom,
          validUntil: null,
          relationshipToReference,
          isReference,
        });
        assertMembershipPlan(
          [...(await tx.memberships([familyId]))],
          this.now(),
        );
        const family = await tx.reviseFamily(familyId);
        await tx.appendPersonAudit(operationId, actor.user.id, person);
        if (duplicateReview)
          await tx.recordDuplicateReview(
            operationId,
            actor.user.id,
            'PERSON',
            person.id,
            duplicateReview,
          );
        await tx.appendMembershipAudit(operationId, actor.user.id, membership);
        await tx.appendFamilyUpdateAudit(
          operationId,
          actor.user.id,
          before,
          family,
        );
        await tx.completeOperation(operationId, {
          person: {
            entityType: 'Person',
            entityId: person.id,
            revision: person.revision,
          },
          membership: {
            entityType: 'FamilyMembership',
            entityId: membership.id,
            revision: membership.revision,
          },
          family: {
            entityType: 'Family',
            entityId: family.id,
            revision: family.revision,
          },
        });
        return { person, membership, family };
      },
    );
  }
  async duplicateCandidates(actor: Principal, query: DuplicateQuery) {
    assertPermission(
      actor.user.roleCodes,
      actor.user.mustChangePassword,
      'registration.read',
    );
    return identifyDuplicateCandidates(
      await this.reader.duplicateRecords(query),
      query,
    );
  }
  async updateFamily(context: CommandContext, id: string, input: FamilyPatch) {
    return this.unitOfWork.run(context.actor.user.id, [id], async (tx) => {
      const actor = await this.authorizedActor(tx, context);
      const type = 'registration.families.update';
      const fingerprint = this.fingerprints.calculate(
        { type, id, input },
        null,
      );
      const existing = await tx.findOperation(type, context.key);
      if (existing) {
        if (
          existing.actorId !== actor.user.id ||
          !this.fingerprints.matches(existing.fingerprint, fingerprint) ||
          !('entityId' in existing.resultReference)
        )
          throw new IdempotencyConflictError();
        return tx.readFamilyRevision(
          existing.resultReference.entityId,
          existing.resultReference.revision,
        );
      }
      const before = await tx.findFamily(id);
      if (!before) throw new ResourceNotFoundError();
      const { expectedRevision, ...changes } = input;
      if (before.revision !== expectedRevision)
        throw new RegistrationRevisionConflictError(before.revision);
      const changed = (
        Object.keys(changes) as Array<keyof typeof changes>
      ).some((key) => before[key] !== changes[key]);
      const operationId = await tx.createOperation(
        type,
        context.key,
        actor.user.id,
        fingerprint,
      );
      const family = changed ? await tx.updateFamily(id, changes) : before;
      if (changed) {
        await tx.appendFamilyUpdateAudit(
          operationId,
          actor.user.id,
          before,
          family,
        );
        if (
          changes.referenceName !== undefined ||
          changes.address !== undefined
        ) {
          const query: DuplicateQuery = {
            entityType: 'FAMILY',
            referenceName: family.referenceName ?? undefined,
            address: family.address ?? undefined,
          };
          const candidates = identifyDuplicateCandidates(
            await tx.duplicateRecords(query),
            query,
          ).filter((candidate) => candidate.id !== id);
          if (candidates.length)
            await tx.recordPossibleDuplicates(
              operationId,
              actor.user.id,
              'FAMILY',
              id,
              candidates.map((candidate) => candidate.id),
            );
        }
      }
      await tx.completeOperation(operationId, {
        entityType: 'Family',
        entityId: id,
        revision: family.revision,
      });
      return family;
    });
  }
  async people(
    actor: Principal,
    query: Omit<PeopleQuery, 'asOf'> & { asOf?: string },
  ) {
    const full = capabilitiesFor(actor.user.roleCodes).includes(
      'registration.read',
    );
    assertPermission(
      actor.user.roleCodes,
      actor.user.mustChangePassword,
      full ? 'registration.read' : 'participants.lookup',
    );
    if (!full && (query.birthDate !== undefined || query.cpf !== undefined))
      throw new PermissionDeniedError();
    return this.reader.people(
      { ...query, asOf: query.asOf ?? this.now() },
      !full,
    );
  }
  async transferMembership(
    context: CommandContext,
    personId: string,
    input: MembershipTransfer,
  ) {
    assertPermission(
      context.actor.user.roleCodes,
      context.actor.user.mustChangePassword,
      'registration.write',
    );
    const initial = await this.reader.membership(input.membershipId);
    if (!initial || initial.personId !== personId)
      throw new ResourceNotFoundError();
    return this.unitOfWork.run(
      context.actor.user.id,
      [initial.familyId, input.targetFamilyId],
      async (tx) => {
        const actor = await this.authorizedActor(tx, context);
        const type = 'registration.memberships.transfer';
        const fingerprint = this.fingerprints.calculate(
          { type, personId, input },
          null,
        );
        const existing = await tx.findOperation(type, context.key);
        if (existing) {
          if (
            existing.actorId !== actor.user.id ||
            !this.fingerprints.matches(existing.fingerprint, fingerprint) ||
            !('previousMembership' in existing.resultReference)
          )
            throw new IdempotencyConflictError();
          const refs = existing.resultReference;
          return {
            previousMembership: await tx.readMembershipRevision(
              refs.previousMembership.entityId,
              refs.previousMembership.revision,
            ),
            membership: await tx.readMembershipRevision(
              refs.membership.entityId,
              refs.membership.revision,
            ),
            sourceFamily: await tx.readFamilyRevision(
              refs.sourceFamily.entityId,
              refs.sourceFamily.revision,
            ),
            targetFamily: await tx.readFamilyRevision(
              refs.targetFamily.entityId,
              refs.targetFamily.revision,
            ),
          };
        }
        const before = await tx.findMembership(input.membershipId);
        if (!before || before.personId !== personId)
          throw new ResourceNotFoundError();
        if (before.revision !== input.expectedMembershipRevision)
          throw new RegistrationRevisionConflictError(before.revision);
        if (before.familyId === input.targetFamilyId)
          throw new RegistrationConflictError('SAME_FAMILY_TRANSFER');
        if (
          !isMembershipCurrent(before, input.effectiveAt) ||
          input.effectiveAt === before.validFrom
        )
          throw new RegistrationConflictError('MEMBERSHIP_NOT_CURRENT');
        const sourceBefore = await tx.findFamily(before.familyId);
        const targetBefore = await tx.findFamily(input.targetFamilyId);
        if (!sourceBefore || !targetBefore) throw new ResourceNotFoundError();
        if (sourceBefore.revision !== input.expectedSourceFamilyRevision)
          throw new RegistrationRevisionConflictError(sourceBefore.revision);
        if (targetBefore.revision !== input.expectedTargetFamilyRevision)
          throw new RegistrationRevisionConflictError(targetBefore.revision);
        const plan = (
          await tx.memberships(
            [before.familyId, input.targetFamilyId],
            [personId],
          )
        ).filter((membership) => membership.id !== before.id);
        const predecessor = { ...before, validUntil: input.effectiveAt };
        await this.assertMembershipFacts(tx, predecessor);
        const successor = {
          ...before,
          familyId: input.targetFamilyId,
          validFrom: input.effectiveAt,
          isReference: input.isReference,
          relationshipToReference: input.relationshipToReference,
        };
        assertMembershipPlan([...plan, predecessor, successor], this.now());
        const operationId = await tx.createOperation(
          type,
          context.key,
          actor.user.id,
          fingerprint,
        );
        const previousMembership = await tx.updateMembership(before.id, {
          validUntil: input.effectiveAt,
        });
        await this.invalidateMembershipCoverage(
          tx,
          operationId,
          actor.user.id,
          before,
          previousMembership,
        );
        const membership = await tx.createMembership({
          personId,
          familyId: successor.familyId,
          validFrom: successor.validFrom,
          validUntil: successor.validUntil,
          isReference: successor.isReference,
          relationshipToReference: successor.relationshipToReference,
        });
        const sourceFamily = await tx.reviseFamily(before.familyId);
        const targetFamily = await tx.reviseFamily(input.targetFamilyId);
        await tx.appendMembershipUpdateAudit(
          operationId,
          actor.user.id,
          before,
          previousMembership,
          input.reason,
          'CLOSE',
          input.effectiveAt,
        );
        await tx.appendMembershipAudit(operationId, actor.user.id, membership);
        await tx.appendFamilyUpdateAudit(
          operationId,
          actor.user.id,
          sourceBefore,
          sourceFamily,
        );
        await tx.appendFamilyUpdateAudit(
          operationId,
          actor.user.id,
          targetBefore,
          targetFamily,
        );
        await tx.completeOperation(operationId, {
          previousMembership: {
            entityType: 'FamilyMembership',
            entityId: previousMembership.id,
            revision: previousMembership.revision,
          },
          membership: {
            entityType: 'FamilyMembership',
            entityId: membership.id,
            revision: membership.revision,
          },
          sourceFamily: {
            entityType: 'Family',
            entityId: sourceFamily.id,
            revision: sourceFamily.revision,
          },
          targetFamily: {
            entityType: 'Family',
            entityId: targetFamily.id,
            revision: targetFamily.revision,
          },
        });
        return { previousMembership, membership, sourceFamily, targetFamily };
      },
      [personId],
    );
  }
  async changeReference(
    context: CommandContext,
    familyId: string,
    input: ReferenceChange,
  ) {
    assertPermission(
      context.actor.user.roleCodes,
      context.actor.user.mustChangePassword,
      'registration.write',
    );
    const initial = await this.reader.family(familyId, input.effectiveAt);
    if (!initial) throw new ResourceNotFoundError();
    return this.unitOfWork.run(
      context.actor.user.id,
      [familyId],
      async (tx) => {
        const actor = await this.authorizedActor(tx, context);
        const type = 'registration.families.reference.change';
        const fingerprint = this.fingerprints.calculate(
          { type, familyId, input },
          null,
        );
        const existing = await tx.findOperation(type, context.key);
        if (existing) {
          if (
            existing.actorId !== actor.user.id ||
            !this.fingerprints.matches(existing.fingerprint, fingerprint) ||
            !('memberships' in existing.resultReference)
          )
            throw new IdempotencyConflictError();
          const refs = existing.resultReference;
          return {
            family: await tx.readFamilyRevision(
              refs.family.entityId,
              refs.family.revision,
            ),
            memberships: await Promise.all(
              refs.memberships.map((ref) =>
                tx.readMembershipRevision(ref.entityId, ref.revision),
              ),
            ),
          };
        }
        const beforeFamily = await tx.findFamily(familyId);
        if (!beforeFamily) throw new ResourceNotFoundError();
        if (beforeFamily.revision !== input.expectedRevision)
          throw new RegistrationRevisionConflictError(beforeFamily.revision);
        if (Date.parse(input.effectiveAt) > Date.parse(this.now()))
          throw new RegistrationRuleError('FUTURE_MEMBERSHIP');
        const rows = await tx.memberships([familyId]);
        const target = rows.find(
          (row) =>
            row.id === input.membershipId &&
            isMembershipCurrent(row, input.effectiveAt),
        );
        if (!target)
          throw new RegistrationConflictError('MEMBERSHIP_NOT_CURRENT');
        const changes = rows.filter(
          (row) =>
            isMembershipCurrent(row, input.effectiveAt) &&
            (row.id === target.id || row.isReference),
        );
        for (const row of changes) {
          if (
            row.isReference !== (row.id === target.id) &&
            row.validFrom !== input.effectiveAt
          )
            await this.assertMembershipFacts(tx, {
              ...row,
              validUntil: input.effectiveAt,
            });
        }
        const operationId = await tx.createOperation(
          type,
          context.key,
          actor.user.id,
          fingerprint,
        );
        const memberships: RegisteredMembership[] = [];
        for (const row of changes) {
          const isReference = row.id === target.id;
          if (row.isReference === isReference) continue;
          const atStart = row.validFrom === input.effectiveAt;
          const updated = await tx.updateMembership(
            row.id,
            atStart ? { isReference } : { validUntil: input.effectiveAt },
          );
          await tx.appendMembershipUpdateAudit(
            operationId,
            actor.user.id,
            row,
            updated,
            input.reason,
            atStart ? 'CORRECT' : 'CLOSE',
            input.effectiveAt,
          );
          memberships.push(updated);
          await this.invalidateMembershipCoverage(
            tx,
            operationId,
            actor.user.id,
            row,
            updated,
          );
          if (!atStart) {
            const successor = await tx.createMembership({
              personId: row.personId,
              familyId,
              validFrom: input.effectiveAt,
              validUntil: row.validUntil,
              relationshipToReference: row.relationshipToReference,
              isReference,
            });
            await tx.appendMembershipAudit(
              operationId,
              actor.user.id,
              successor,
            );
            memberships.push(successor);
          }
        }
        assertMembershipPlan(await tx.memberships([familyId]), this.now());
        const family = memberships.length
          ? await tx.reviseFamily(familyId)
          : beforeFamily;
        if (memberships.length)
          await tx.appendFamilyUpdateAudit(
            operationId,
            actor.user.id,
            beforeFamily,
            family,
          );
        await tx.completeOperation(operationId, {
          family: {
            entityType: 'Family',
            entityId: family.id,
            revision: family.revision,
          },
          memberships: memberships.map((row) => ({
            entityType: 'FamilyMembership',
            entityId: row.id,
            revision: row.revision,
          })),
        });
        return { family, memberships };
      },
      initial.members.map((member) => member.person.id),
    );
  }
  async family(actor: Principal, id: string, asOf = this.now()) {
    assertPermission(
      actor.user.roleCodes,
      actor.user.mustChangePassword,
      'registration.read',
    );
    const family = await this.reader.family(id, asOf);
    if (!family) throw new ResourceNotFoundError();
    return family;
  }
  async families(
    actor: Principal,
    query: Omit<FamiliesQuery, 'asOf'> & { asOf?: string },
  ) {
    assertPermission(
      actor.user.roleCodes,
      actor.user.mustChangePassword,
      'registration.read',
    );
    return this.reader.families({ ...query, asOf: query.asOf ?? this.now() });
  }
  async person(actor: Principal, id: string, asOf = this.now()) {
    const full = capabilitiesFor(actor.user.roleCodes).includes(
      'registration.read',
    );
    assertPermission(
      actor.user.roleCodes,
      actor.user.mustChangePassword,
      full ? 'registration.read' : 'participants.lookup',
    );
    const person = await this.reader.person(id, asOf, !full);
    if (!person) throw new ResourceNotFoundError();
    return person;
  }
  async updatePerson(
    context: CommandContext,
    personId: string,
    input: PersonPatch,
  ) {
    return this.unitOfWork.run(
      context.actor.user.id,
      [],
      async (tx) => {
        const actor = await this.authorizedActor(tx, context);
        const type = 'registration.people.update';
        const fingerprint = this.fingerprints.calculate(
          { type, personId, input },
          null,
        );
        const existing = await tx.findOperation(type, context.key);
        if (existing) {
          if (
            existing.actorId !== actor.user.id ||
            !this.fingerprints.matches(existing.fingerprint, fingerprint) ||
            !('entityId' in existing.resultReference)
          )
            throw new IdempotencyConflictError();
          return tx.readPersonRevision(
            existing.resultReference.entityId,
            existing.resultReference.revision,
          );
        }
        const before = await tx.findPerson(personId);
        if (!before) throw new ResourceNotFoundError();
        const { expectedRevision, ...changes } = input;
        if (before.revision !== expectedRevision)
          throw new RegistrationRevisionConflictError(before.revision);
        if (input.birthDate && input.birthDate > this.today())
          throw new RegistrationRuleError('FUTURE_BIRTH_DATE');
        const changed = (
          Object.keys(changes) as Array<keyof typeof changes>
        ).some((key) => before[key] !== changes[key]);
        const operationId = await tx.createOperation(
          type,
          context.key,
          actor.user.id,
          fingerprint,
        );
        const person = changed
          ? await tx.updatePerson(personId, changes)
          : before;
        if (changed) {
          await tx.appendPersonUpdateAudit(
            operationId,
            actor.user.id,
            before,
            person,
          );
          if (
            changes.name !== undefined ||
            changes.birthDate !== undefined ||
            changes.cpf !== undefined
          ) {
            const query: DuplicateQuery = {
              entityType: 'PERSON',
              name: person.name,
              birthDate: person.birthDate ?? undefined,
              cpf: person.cpf ?? undefined,
            };
            const candidates = identifyDuplicateCandidates(
              await tx.duplicateRecords(query),
              query,
            ).filter((candidate) => candidate.id !== personId);
            if (candidates.length)
              await tx.recordPossibleDuplicates(
                operationId,
                actor.user.id,
                'PERSON',
                personId,
                candidates.map((candidate) => candidate.id),
              );
          }
        }
        await tx.completeOperation(operationId, {
          entityType: 'Person',
          entityId: personId,
          revision: person.revision,
        });
        return person;
      },
      [personId],
    );
  }
  async saveSizes(
    context: CommandContext,
    personId: string,
    input: SizesInput,
  ) {
    return this.unitOfWork.run(
      context.actor.user.id,
      [],
      async (tx) => {
        const actor = await this.authorizedActor(tx, context);
        const type = 'registration.people.sizes.update';
        const fingerprint = this.fingerprints.calculate(
          { type, personId, input },
          null,
        );
        const existing = await tx.findOperation(type, context.key);
        if (existing) {
          if (
            existing.actorId !== actor.user.id ||
            !this.fingerprints.matches(existing.fingerprint, fingerprint) ||
            !('entityId' in existing.resultReference)
          )
            throw new IdempotencyConflictError();
          return tx.readSizeRevision(
            existing.resultReference.entityId,
            existing.resultReference.revision,
          );
        }
        if (!(await tx.findPerson(personId))) throw new ResourceNotFoundError();
        const before = await tx.sizeProfile(personId);
        const { expectedRevision, ...fields } = input;
        if ((before?.revision ?? null) !== expectedRevision)
          throw new RegistrationRevisionConflictError(before?.revision ?? null);
        if ((input.shoeSize || input.clothingSize) && !input.informedOn)
          throw new RegistrationRuleError('SIZE_DATE_REQUIRED');
        if (input.informedOn && input.informedOn > this.today())
          throw new RegistrationRuleError('FUTURE_SIZE_DATE');
        const changed =
          !before ||
          (Object.keys(fields) as Array<keyof typeof fields>).some(
            (key) => before[key] !== fields[key],
          );
        const operationId = await tx.createOperation(
          type,
          context.key,
          actor.user.id,
          fingerprint,
        );
        const profile = changed
          ? await tx.saveSizes({
              ...fields,
              personId,
              revision: (before?.revision ?? 0) + 1,
            })
          : before;
        if (changed)
          await tx.appendSizesAudit(
            operationId,
            actor.user.id,
            before,
            profile,
          );
        await tx.completeOperation(operationId, {
          entityType: 'SizeProfile',
          entityId: personId,
          revision: profile.revision,
        });
        return profile;
      },
      [personId],
    );
  }
  closeMembership(
    context: CommandContext,
    membershipId: string,
    input: MembershipClosure,
  ) {
    return this.amendMembership(context, membershipId, input, 'CLOSE');
  }
  correctMembership(
    context: CommandContext,
    membershipId: string,
    input: MembershipCorrection,
  ) {
    return this.amendMembership(context, membershipId, input, 'CORRECT');
  }
  private async amendMembership(
    context: CommandContext,
    membershipId: string,
    input: MembershipCorrection,
    action: 'CLOSE' | 'CORRECT',
  ) {
    assertPermission(
      context.actor.user.roleCodes,
      context.actor.user.mustChangePassword,
      'registration.write',
    );
    const initial = await this.reader.membership(membershipId);
    if (!initial) throw new ResourceNotFoundError();
    return this.unitOfWork.run(
      context.actor.user.id,
      [initial.familyId],
      async (tx) => {
        const actor = await this.authorizedActor(tx, context);
        const type =
          action === 'CLOSE'
            ? 'registration.memberships.close'
            : 'registration.memberships.correct';
        const fingerprint = this.fingerprints.calculate(
          { type, membershipId, input },
          null,
        );
        const existing = await tx.findOperation(type, context.key);
        if (existing) {
          if (
            existing.actorId !== actor.user.id ||
            !this.fingerprints.matches(existing.fingerprint, fingerprint) ||
            !('person' in existing.resultReference)
          )
            throw new IdempotencyConflictError();
          const refs = existing.resultReference;
          return {
            membership: await tx.readMembershipRevision(
              refs.membership.entityId,
              refs.membership.revision,
            ),
            family: await tx.readFamilyRevision(
              refs.family.entityId,
              refs.family.revision,
            ),
          };
        }
        const before = await tx.findMembership(membershipId);
        if (!before) throw new ResourceNotFoundError();
        const beforeFamily = await tx.findFamily(before.familyId);
        if (!beforeFamily) throw new ResourceNotFoundError();
        const { expectedRevision, expectedFamilyRevision, reason, ...changes } =
          input;
        if (before.revision !== expectedRevision)
          throw new RegistrationRevisionConflictError(before.revision);
        if (beforeFamily.revision !== expectedFamilyRevision)
          throw new RegistrationRevisionConflictError(beforeFamily.revision);
        if (
          action === 'CLOSE' &&
          before.validUntil &&
          before.validUntil !== input.validUntil
        )
          throw new RegistrationConflictError('MEMBERSHIP_NOT_CURRENT');
        const changed = (
          Object.keys(changes) as Array<keyof typeof changes>
        ).some((key) => before[key] !== changes[key]);
        if (changed) {
          await this.assertMembershipFacts(tx, { ...before, ...changes });
        }
        assertMembershipPlan(
          (await tx.memberships([before.familyId], [before.personId])).map(
            (row) => (row.id === membershipId ? { ...row, ...changes } : row),
          ),
          this.now(),
        );
        const operationId = await tx.createOperation(
          type,
          context.key,
          actor.user.id,
          fingerprint,
        );
        const membership = changed
          ? await tx.updateMembership(membershipId, changes)
          : before;
        const family = changed
          ? await tx.reviseFamily(before.familyId)
          : beforeFamily;
        if (changed) {
          await this.invalidateMembershipCoverage(
            tx,
            operationId,
            actor.user.id,
            before,
            membership,
          );
          await tx.appendMembershipUpdateAudit(
            operationId,
            actor.user.id,
            before,
            membership,
            reason,
            action,
            input.validUntil ?? input.validFrom ?? this.now(),
          );
          await tx.appendFamilyUpdateAudit(
            operationId,
            actor.user.id,
            beforeFamily,
            family,
          );
        }
        const person = await tx.findPerson(before.personId);
        if (!person) throw new ResourceNotFoundError();
        await tx.completeOperation(operationId, {
          person: {
            entityType: 'Person',
            entityId: person.id,
            revision: person.revision,
          },
          membership: {
            entityType: 'FamilyMembership',
            entityId: membership.id,
            revision: membership.revision,
          },
          family: {
            entityType: 'Family',
            entityId: family.id,
            revision: family.revision,
          },
        });
        return { membership, family };
      },
      [initial.personId],
    );
  }
  async qualityIssues(actor: Principal, query: QualityQuery) {
    assertPermission(
      actor.user.roleCodes,
      actor.user.mustChangePassword,
      'registration.read',
    );
    return this.reader.qualityIssues(query);
  }
  async resolveQualityIssue(
    context: CommandContext,
    issueId: string,
    input: ResolveQualityIssue,
  ) {
    return this.unitOfWork.run(context.actor.user.id, [], async (tx) => {
      const actor = await this.authorizedActor(tx, context);
      const type = 'registration.quality.resolve';
      const fingerprint = this.fingerprints.calculate(
        { type, issueId, input },
        null,
      );
      const existing = await tx.findOperation(type, context.key);
      if (existing) {
        if (
          existing.actorId !== actor.user.id ||
          !this.fingerprints.matches(existing.fingerprint, fingerprint) ||
          !('entityId' in existing.resultReference)
        )
          throw new IdempotencyConflictError();
        return tx.readQualityRevision(
          existing.resultReference.entityId,
          existing.resultReference.revision,
        );
      }
      const before = await tx.findQualityIssue(issueId);
      if (!before) throw new ResourceNotFoundError();
      if (before.revision !== input.expectedRevision)
        throw new RegistrationRevisionConflictError(before.revision);
      if (before.kind !== 'POSSIBLE_DUPLICATE')
        throw new RegistrationRuleError('INVALID_ISSUE_RESOLUTION');
      const changed = before.resolvedAt === null;
      if (
        !changed &&
        (before.resolution !== input.resolution ||
          before.reason !== input.reason)
      )
        throw new RegistrationConflictError('ISSUE_ALREADY_RESOLVED');
      const operationId = await tx.createOperation(
        type,
        context.key,
        actor.user.id,
        fingerprint,
      );
      const issue = changed
        ? await tx.resolveQualityIssue(issueId, actor.user.id, input.reason)
        : before;
      if (changed)
        await tx.appendQualityResolutionAudit(
          operationId,
          actor.user.id,
          before,
          issue,
        );
      await tx.completeOperation(operationId, {
        entityType: 'DataQualityIssue',
        entityId: issueId,
        revision: issue.revision,
      });
      return issue;
    });
  }
}
