import { socialFormInputSchema } from '@erp/contracts/social-forms';
import { ApplicationError } from '@erp/contracts/common';
import type { DemoRuntime } from '../../../demo/runtime';
import { requireFound, requireRevision } from '../../../demo/runtime';
import { familyMemberships } from '../../registration/domain/memberships';
import type { SocialFormsGateway } from '../application/social-forms-gateway';

export function createDemoSocialForms(
  runtime: DemoRuntime,
): SocialFormsGateway {
  return {
    async list(familyId) {
      return runtime.read('socialForms.read', (s) =>
        s.socialForms
          .filter((f) => f.familyId === familyId)
          .sort((a, b) => b.version - a.version),
      );
    },
    async publish(raw) {
      const input = socialFormInputSchema.parse(raw);
      return runtime.execute('socialForms.write', (s, actor) => {
        const family = requireFound(
          s.families.find((f) => f.id === input.familyId),
        );
        requireRevision(family.revision, input.expectedFamilyRevision);
        const previous = s.socialForms
          .filter((f) => f.familyId === family.id)
          .sort((a, b) => b.version - a.version)[0];
        if ((previous?.id ?? null) !== input.expectedPreviousVersionId)
          throw new ApplicationError(
            'REVISION_CONFLICT',
            'A social form was published after this draft was opened',
          );
        const memberships = familyMemberships(
          s.memberships,
          family.id,
          input.occurredAt,
        );
        if (
          Date.parse(input.occurredAt) > Date.parse(runtime.now()) ||
          new Set(input.members.map((m) => m.personId)).size !==
            input.members.length ||
          input.members.length !== memberships.length ||
          input.members.some(
            (m) =>
              !memberships.some(
                (membership) => membership.personId === m.personId,
              ),
          )
        )
          throw new ApplicationError(
            'DOMAIN_CONFLICT',
            'The form must represent the family composition on its reference date',
          );
        const form = {
          ...input,
          id: runtime.id(),
          version: (previous?.version ?? 0) + 1,
          recordedAt: runtime.now(),
          recordedBy: actor.id,
          familySnapshot: {
            code: family.code,
            referenceName: family.referenceName,
            address: family.address,
          },
          memberSnapshots: memberships.map((membership) => ({
            personId: membership.personId,
            name: requireFound(
              s.people.find((p) => p.id === membership.personId),
            ).name,
            isReference: membership.isReference,
            relationshipToReference: membership.relationshipToReference,
          })),
        };
        s.socialForms.push(form);
        return {
          result: form,
          change: {
            entityId: family.id,
            entityLabel: `Ficha da família ${family.code} · versão ${form.version}`,
            action: 'PUBLISH',
            occurredAt: form.occurredAt,
            reason: null,
            readCapability: 'socialForms.read',
            before: null,
            after: { ...form },
          },
        };
      });
    },
  };
}
