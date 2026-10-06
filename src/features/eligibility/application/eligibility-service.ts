import type { Capability } from '@erp/contracts/access';
import type {
  CommandContext,
  Principal,
} from '../../access/application/ports.js';
import type { OperationFingerprints } from '../../access/application/account-transactions.js';
import { AuthenticationRequiredError } from '../../access/application/access-errors.js';
import { assertPermission } from '../../access/domain/permissions.js';
import {
  IdempotencyConflictError,
  ResourceNotFoundError,
} from '../../../core/application/errors.js';
import { civilDateAt } from '../../projects/domain/activity-rules.js';
import {
  EligibilityConflictError,
  EligibilityRuleError,
} from '../domain/eligibility-errors.js';
import { evaluateEligibility } from '../domain/evaluate-eligibility.js';
import {
  assertPolicyDefinition,
  policyInEffect,
  policyVersions,
} from '../domain/policy-rules.js';
import type {
  EligibilityAssessment,
  EligibilityEntity,
  EligibilityPolicy,
  EligibilityPreview,
  EligibilitySnapshot,
  PolicyPublication,
  PolicyVersion,
} from '../domain/eligibility.js';
import type {
  EligibilityReader,
  EligibilityReaderPorts,
  EligibilityTransaction,
  EligibilityUnitOfWork,
} from './eligibility-ports.js';

export class EligibilityService {
  constructor(
    private readonly reader: EligibilityReader,
    private readonly unitOfWork: EligibilityUnitOfWork,
    private readonly fingerprints: OperationFingerprints,
    private readonly now: () => string,
    private readonly timeZone: string,
  ) {}
  private async read<T>(
    actor: Principal,
    work: (ports: EligibilityReaderPorts) => Promise<T>,
  ) {
    assertPermission(
      actor.user.roleCodes,
      actor.user.mustChangePassword,
      'eligibility.read',
    );
    return this.reader.read(work);
  }
  private command<T extends EligibilitySnapshot>(
    context: CommandContext,
    capability: Capability,
    type: string,
    input: unknown,
    entityType: EligibilityEntity,
    restore: (tx: EligibilityTransaction, id: string) => Promise<T | null>,
    work: (tx: EligibilityTransaction, operationId: string) => Promise<T>,
  ) {
    return this.unitOfWork.run(context.actor.user.id, async (tx) => {
      const actor = await tx.actor(context.actor.user.id);
      if (
        !actor?.user.active ||
        actor.authVersion !== context.actor.authVersion
      )
        throw new AuthenticationRequiredError();
      assertPermission(
        actor.user.roleCodes,
        actor.user.mustChangePassword,
        capability,
      );
      const fingerprint = this.fingerprints.calculate({ type, input }, null);
      const existing = await tx.operation(type, context.key);
      if (existing) {
        if (
          existing.actorId !== actor.user.id ||
          existing.reference.entityType !== entityType ||
          !this.fingerprints.matches(fingerprint, existing.fingerprint)
        )
          throw new IdempotencyConflictError();
        // Published versions and assessments are immutable: the row is the original result.
        const original = await restore(tx, existing.reference.entityId);
        if (!original) throw new ResourceNotFoundError();
        return original;
      }
      const operationId = await tx.createOperation(
        type,
        context.key,
        actor.user.id,
        fingerprint,
      );
      const result = await work(tx, operationId);
      await tx.completeOperation(operationId, {
        entityType,
        entityId: result.id,
      });
      return result;
    });
  }
  private async version(ports: EligibilityReaderPorts, id: string) {
    return (
      policyVersions(await ports.policies()).find((row) => row.id === id) ??
      null
    );
  }
  policies(actor: Principal, query: { page: number; pageSize: number }) {
    return this.read(actor, async (ports) => {
      const rows = policyVersions(await ports.policies());
      return {
        data: rows.slice(
          (query.page - 1) * query.pageSize,
          query.page * query.pageSize,
        ),
        pagination: { ...query, total: rows.length },
      };
    });
  }
  policy(actor: Principal, id: string) {
    return this.read(actor, async (ports) => {
      const policy = await this.version(ports, id);
      if (!policy) throw new ResourceNotFoundError();
      return policy;
    });
  }
  publishPolicy(context: CommandContext, input: PolicyPublication) {
    return this.command<PolicyVersion>(
      context,
      'eligibility.policy.write',
      'eligibility.policies.publish',
      input,
      'EligibilityPolicy',
      (tx, id) => this.version(tx, id),
      async (tx, operationId) => {
        const definition = assertPolicyDefinition(input.definition);
        if (
          input.effectiveFrom < civilDateAt(this.now(), this.timeZone) &&
          !input.retroactive
        )
          throw new EligibilityRuleError('RETROACTIVE_CONFIRMATION_REQUIRED');
        // The serializable unit of work turns a concurrent publication into a retry that lands here.
        const published = await tx.policies();
        const latest = [...published].sort(
          (a, b) =>
            b.recordedAt.localeCompare(a.recordedAt) ||
            b.id.localeCompare(a.id),
        )[0];
        if ((latest?.id ?? null) !== input.expectedLatestPolicyId)
          throw new EligibilityConflictError(
            'POLICY_CHANGED',
            latest ? [latest.id] : [],
          );
        const sameStart = published.find(
          (row) => row.effectiveFrom === input.effectiveFrom,
        );
        if (sameStart)
          throw new EligibilityConflictError('POLICY_EFFECTIVE_DATE_TAKEN', [
            sameStart.id,
          ]);
        const activities = await tx.activities(definition.activityIds);
        if (activities.length !== definition.activityIds.length)
          throw new EligibilityRuleError('ACTIVITY_NOT_FOUND');
        if (activities.some((row) => row.nature !== 'PERIODIC'))
          throw new EligibilityRuleError('PERIODIC_ACTIVITY_REQUIRED');
        const policy = await tx.createPolicy({
          effectiveFrom: input.effectiveFrom,
          definition,
          decisionReference: input.decisionReference,
          reason: input.reason,
          recordedBy: context.actor.user.id,
        });
        await tx.audit(
          operationId,
          context.actor.user.id,
          'EligibilityPolicy',
          policy,
          input.reason,
        );
        return policyVersions([...published, policy]).find(
          (row) => row.id === policy.id,
        )!;
      },
    );
  }
  private async compute(
    ports: EligibilityReaderPorts,
    familyId: string,
    referenceDate: string,
  ): Promise<EligibilityPreview> {
    if (!(await ports.familyExists(familyId)))
      throw new ResourceNotFoundError();
    return this.classify(
      ports,
      familyId,
      referenceDate,
      await ports.policies(),
    );
  }
  private async classify(
    ports: EligibilityReaderPorts,
    familyId: string,
    referenceDate: string,
    policies: readonly EligibilityPolicy[],
  ): Promise<EligibilityPreview> {
    const policy = policyInEffect(policies, referenceDate);
    const result = evaluateEligibility(
      {
        familyId,
        referenceDate,
        evaluatedAt: this.now(),
        timeZone: this.timeZone,
      },
      policy,
      // Without a criterion no fact is read: nothing could be evidence of anything.
      policy
        ? await ports.evidence(familyId, policy.definition.activityIds)
        : { memberships: [], activities: [] },
    );
    return {
      ...result,
      sourceFingerprint: this.fingerprints.calculate(
        {
          familyId,
          referenceDate,
          policyId: result.policyId,
          status: result.status,
          evidences: result.evidences,
        },
        null,
      ),
    };
  }
  /**
   * Internal contract for other modules: the single evaluator over one
   * consistent snapshot. Callers authorize at their own public boundary.
   */
  evaluate(familyId: string, referenceDate: string) {
    return this.reader.read((ports) =>
      this.compute(ports, familyId, referenceDate),
    );
  }
  /**
   * Internal contract for reports: every canonical family classified by the
   * same evaluator over one snapshot, so totals never depend on a page.
   */
  evaluateAll(referenceDate: string, familyId?: string) {
    return this.reader.read(async (ports) => {
      const policies = await ports.policies();
      const rows = [];
      for (const family of await ports.families())
        if (!familyId || family.id === familyId)
          rows.push({
            family,
            preview: await this.classify(
              ports,
              family.id,
              referenceDate,
              policies,
            ),
          });
      return rows;
    });
  }
  preview(actor: Principal, familyId: string, referenceDate: string) {
    return this.read(actor, (ports) =>
      this.compute(ports, familyId, referenceDate),
    );
  }
  assess(context: CommandContext, familyId: string, referenceDate: string) {
    return this.command<EligibilityAssessment>(
      context,
      'eligibility.evaluate',
      'eligibility.assessments.create',
      { familyId, referenceDate },
      'EligibilityAssessment',
      (tx, id) => tx.assessment(id),
      async (tx, operationId) => {
        const assessment = await tx.createAssessment({
          ...(await this.compute(tx, familyId, referenceDate)),
          requestedBy: context.actor.user.id,
        });
        await tx.audit(
          operationId,
          context.actor.user.id,
          'EligibilityAssessment',
          assessment,
        );
        return assessment;
      },
    );
  }
  assessment(actor: Principal, id: string) {
    return this.read(actor, async (ports) => {
      const assessment = await ports.assessment(id);
      if (!assessment) throw new ResourceNotFoundError();
      return assessment;
    });
  }
}
