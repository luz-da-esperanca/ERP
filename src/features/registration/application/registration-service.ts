import type { CreateRegisteredFamily, CreateRegisteredPerson, FamilyPatch, PeopleQuery } from '../domain/registration.js';
import type { RegistrationReader, RegistrationUnitOfWork } from './registration-ports.js';
import type { CommandContext, Principal } from '../../access/application/ports.js';
import type { OperationFingerprints } from '../../access/application/account-transactions.js';
import { assertPermission, capabilitiesFor } from '../../access/domain/permissions.js';
import { PermissionDeniedError } from '../../access/domain/account-errors.js';
import { AuthenticationRequiredError } from '../../access/application/access-errors.js';
import { ResourceNotFoundError, IdempotencyConflictError } from '../../../core/application/errors.js';
import { RegistrationRevisionConflictError, RegistrationRuleError } from '../domain/registration-errors.js';
import { assertMembershipPlan } from '../domain/membership-rules.js';
import { identifyDuplicateCandidates, assertDuplicateReview } from '../domain/duplicate-rules.js';
import type { DuplicateQuery } from '../domain/duplicate-rules.js';
import type { FamiliesQuery, PersonPatch } from '../domain/registration.js';
import type { RegistrationTransaction } from './registration-ports.js';

export class RegistrationService {
  constructor(
    private readonly reader: RegistrationReader,
    private readonly unitOfWork: RegistrationUnitOfWork,
    private readonly fingerprints: OperationFingerprints,
    private readonly now: () => string,
    private readonly today: () => string,
  ) {}

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
}
