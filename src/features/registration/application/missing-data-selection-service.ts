import type { MissingDataSelectionStore } from './missing-data-ports.js';
import type { PublishMissingDataSelection } from '../domain/data-quality.js';
import type {
  CommandContext,
  Principal,
} from '../../access/application/ports.js';
import type { OperationFingerprints } from '../../access/application/account-transactions.js';
import { assertPermission } from '../../access/domain/permissions.js';
import { AuthenticationRequiredError } from '../../access/application/access-errors.js';
import { IdempotencyConflictError } from '../../../core/application/errors.js';
import { RegistrationRevisionConflictError } from '../domain/registration-errors.js';
import { reconcileMissingData } from './missing-data.js';

export class MissingDataSelectionService {
  constructor(
    private readonly store: MissingDataSelectionStore,
    private readonly fingerprints: OperationFingerprints,
    private readonly now: () => string,
  ) {}
  current(actor: Principal) {
    assertPermission(
      actor.user.roleCodes,
      actor.user.mustChangePassword,
      'registration.read',
    );
    return this.store.current();
  }
  publish(context: CommandContext, input: PublishMissingDataSelection) {
    return this.store.run(context.actor.user.id, async (tx) => {
      const actor = await tx.findActor(context.actor.user.id);
      if (
        !actor?.user.active ||
        actor.authVersion !== context.actor.authVersion
      )
        throw new AuthenticationRequiredError();
      assertPermission(
        actor.user.roleCodes,
        actor.user.mustChangePassword,
        'featureDecisions.manage',
      );
      const type = 'registration.missing-data.selection';
      const fingerprint = this.fingerprints.calculate({ type, input }, null);
      const existing = await tx.findOperation(type, context.key);
      if (existing) {
        if (
          existing.actorId !== actor.user.id ||
          !this.fingerprints.matches(existing.fingerprint, fingerprint) ||
          !('entityId' in existing.resultReference)
        )
          throw new IdempotencyConflictError();
        return tx.selectionRevision(existing.resultReference.entityId);
      }
      const current = await tx.missingData.selection();
      if ((current?.version ?? null) !== input.expectedVersion)
        throw new RegistrationRevisionConflictError(current?.version ?? null);
      const operationId = await tx.createOperation(
        type,
        context.key,
        actor.user.id,
        fingerprint,
      );
      const selection = await tx.publishSelection({
        version: (current?.version ?? 0) + 1,
        personFields: input.personFields,
        familyFields: input.familyFields,
        decisionReference: input.decisionReference,
        recordedAt: this.now(),
        recordedBy: actor.user.id,
      });
      await tx.auditSelection(operationId, actor.user.id, selection);
      for (const entity of await tx.entities())
        await reconcileMissingData(
          tx.missingData,
          operationId,
          actor.user.id,
          entity.entityType,
          entity.id,
          entity.fields,
        );
      await tx.completeOperation(operationId, {
        entityType: 'RegistrationFieldSelection',
        entityId: selection.id,
        revision: 1,
      });
      return selection;
    });
  }
}
