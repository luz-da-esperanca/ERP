import {
  createPersonSchema,
  familyInputSchema,
} from '@erp/contracts/registration';
import { idSchema, instantSchema, reasonSchema } from '@erp/contracts/common';
import { familyMemberships } from '../domain/memberships';
import {
  validatePersonRegistration,
  validateTransfer,
} from '../domain/registration-rules';
import type { RegistrationGateway } from '../application/registration-gateway';
import type { DemoRuntime } from '../../../demo/runtime';
import { requireFound, requireRevision } from '../../../demo/runtime';
import type { DemoState } from '../../../demo/state';

function summarize(state: Readonly<DemoState>, id: string, at: string) {
  const family = requireFound(state.families.find((f) => f.id === id));
  const members = familyMemberships(state.memberships, id, at);
  const reference = members.find((m) => m.isReference);
  return {
    ...family,
    memberCount: new Set(members.map((m) => m.personId)).size,
    referencePersonName:
      state.people.find((p) => p.id === reference?.personId)?.name ?? null,
  };
}
export function createDemoRegistration(
  runtime: DemoRuntime,
): RegistrationGateway {
  return {
    async listFamilies() {
      return runtime.read('registration.read', (s) =>
        s.families.map((f) => summarize(s, f.id, runtime.now())),
      );
    },
    async getFamily(id, asOf) {
      idSchema.parse(id);
      instantSchema.parse(asOf);
      return runtime.read('registration.read', (s) => ({
        family: summarize(s, id, asOf),
        members: familyMemberships(s.memberships, id, asOf).map(
          (membership) => ({
            membership,
            person: requireFound(
              s.people.find((p) => p.id === membership.personId),
            ),
          }),
        ),
      }));
    },
    async createFamily(raw) {
      const input = familyInputSchema.parse(raw);
      return runtime.execute('registration.write', (s) => {
        const family = {
          ...input,
          id: runtime.id(),
          code: String(
            Math.max(0, ...s.families.map((f) => Number(f.code))) + 1,
          ),
          revision: 1,
          createdAt: runtime.now(),
          updatedAt: runtime.now(),
        };
        s.families.push(family);
        return {
          result: family,
          change: {
            entityId: family.id,
            entityLabel: `Família ${family.code}`,
            action: 'CREATE',
            occurredAt: null,
            reason: null,
            readCapability: 'registration.read',
            before: null,
            after: { ...family },
          },
        };
      });
    },
    async updateFamily(id, revision, raw) {
      const input = familyInputSchema.parse(raw);
      return runtime.execute('registration.write', (s) => {
        const family = requireFound(s.families.find((f) => f.id === id));
        requireRevision(family.revision, revision);
        const before = { ...family };
        Object.assign(family, input, {
          revision: family.revision + 1,
          updatedAt: runtime.now(),
        });
        return {
          result: family,
          change: {
            entityId: id,
            entityLabel: `Família ${family.code}`,
            action: 'UPDATE',
            occurredAt: null,
            reason: null,
            readCapability: 'registration.read',
            before,
            after: { ...family },
          },
        };
      });
    },
    async listPeople() {
      return runtime.read('registration.read', (s) => s.people);
    },
    async getPerson(id) {
      return runtime.read('registration.read', (s) => ({
        person: requireFound(s.people.find((p) => p.id === id)),
        memberships: s.memberships
          .filter((m) => m.personId === id)
          .map((m) => ({
            ...m,
            familyCode: requireFound(
              s.families.find((f) => f.id === m.familyId),
            ).code,
          })),
      }));
    },
    async createPerson(raw) {
      const input = createPersonSchema.parse(raw);
      return runtime.execute('registration.write', (s) => {
        const family = requireFound(
          s.families.find((f) => f.id === input.familyId),
        );
        requireRevision(family.revision, input.expectedFamilyRevision);
        validatePersonRegistration(
          input,
          s.people,
          s.memberships,
          runtime.now(),
        );
        const person = {
          ...input.person,
          id: runtime.id(),
          revision: 1,
          updatedAt: runtime.now(),
        };
        const membership = {
          id: runtime.id(),
          personId: person.id,
          familyId: family.id,
          validFrom: input.validFrom,
          validUntil: null,
          relationshipToReference: input.relationshipToReference,
          isReference: input.isReference,
          revision: 1,
        };
        s.people.push(person);
        s.memberships.push(membership);
        family.revision += 1;
        family.updatedAt = runtime.now();
        return {
          result: person,
          change: {
            entityId: person.id,
            entityLabel: person.name,
            action: 'CREATE',
            occurredAt: input.validFrom,
            reason: input.duplicateReason,
            readCapability: 'registration.read',
            before: null,
            after: { person, membership },
          },
        };
      });
    },
    async transfer(raw) {
      const reason = reasonSchema.parse(raw.reason);
      instantSchema.parse(raw.effectiveAt);
      runtime.execute('registration.write', (s) => {
        const person = requireFound(
          s.people.find((p) => p.id === raw.personId),
        );
        const membership = requireFound(
          s.memberships.find(
            (m) => m.id === raw.membershipId && m.personId === person.id,
          ),
        );
        const source = requireFound(
          s.families.find((f) => f.id === membership.familyId),
        );
        const target = requireFound(
          s.families.find((f) => f.id === raw.targetFamilyId),
        );
        requireRevision(person.revision, raw.expectedPersonRevision);
        requireRevision(source.revision, raw.expectedSourceRevision);
        requireRevision(target.revision, raw.expectedTargetRevision);
        validateTransfer(
          membership,
          target.id,
          raw.effectiveAt,
          s.sessions,
          runtime.now(),
        );
        const before = { ...membership };
        const next = {
          ...membership,
          id: runtime.id(),
          familyId: target.id,
          validFrom: raw.effectiveAt,
          isReference: false,
          relationshipToReference: null,
          revision: 1,
        };
        membership.validUntil = raw.effectiveAt;
        membership.revision += 1;
        s.memberships.push(next);
        source.revision += 1;
        target.revision += 1;
        person.revision += 1;
        source.updatedAt = target.updatedAt = person.updatedAt = runtime.now();
        return {
          result: undefined,
          change: {
            entityId: person.id,
            entityLabel: person.name,
            action: 'UPDATE',
            occurredAt: raw.effectiveAt,
            reason,
            readCapability: 'registration.read',
            before,
            after: { closedMembership: membership, membership: next },
          },
        };
      });
    },
  };
}
