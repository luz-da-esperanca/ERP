import { describe, expect, it, vi } from 'vitest';
import { EligibilityService } from '../../../../src/features/eligibility/application/eligibility-service.js';
import type {
  EligibilityReaderPorts,
  EligibilityTransaction,
} from '../../../../src/features/eligibility/application/eligibility-ports.js';
import type {
  EligibilityAssessment,
  EligibilityPolicy,
} from '../../../../src/features/eligibility/domain/eligibility.js';
import type { Principal } from '../../../../src/features/access/application/ports.js';
import type { Role } from '@erp/contracts/access';
import { createAccessServiceFixture } from '../../../support/access-service-fixture.js';
import {
  activityId,
  evidenceBuilder,
  familyId,
  personId,
  policyDraft,
  publishedPolicy,
} from '../../../support/eligibility-fixture.js';

const now = '2026-06-01T12:00:00.000Z';
function fixture(roles: Role[] = ['COORDINATION']) {
  const { principal: original } = createAccessServiceFixture();
  const principal: Principal = {
    ...original,
    user: { ...original.user, roleCodes: roles },
  };
  const sources = evidenceBuilder();
  const stored = {
    policies: [] as EligibilityPolicy[],
    assessments: [] as EligibilityAssessment[],
    audits: [] as { entityType: string; entityId: string; reason?: string }[],
    natures: new Map([[activityId, 'PERIODIC' as const]]),
  };
  const reads: EligibilityReaderPorts = {
    policies: async () => stored.policies,
    assessment: async (id) =>
      stored.assessments.find((row) => row.id === id) ?? null,
    familyExists: async (id) => id === familyId,
    activities: async (ids) =>
      ids.flatMap((id) => {
        const nature = stored.natures.get(id);
        return nature ? [{ id, nature }] : [];
      }),
    evidence: async () => sources.snapshot,
  };
  const tx: EligibilityTransaction = {
    ...reads,
    actor: vi
      .fn<EligibilityTransaction['actor']>()
      .mockResolvedValue(principal),
    operation: vi.fn<EligibilityTransaction['operation']>(),
    createOperation: vi
      .fn<EligibilityTransaction['createOperation']>()
      .mockResolvedValue('synthetic-operation'),
    completeOperation: vi.fn<EligibilityTransaction['completeOperation']>(),
    async createPolicy(input) {
      const policy = {
        ...input,
        id: `00000000-0000-4000-8000-00000000b0${stored.policies.length + 2}0`,
        recordedAt: now,
      };
      stored.policies.push(policy);
      return policy;
    },
    async createAssessment(input) {
      const assessment = {
        ...input,
        id: '00000000-0000-4000-8000-0000000a55e5',
      };
      stored.assessments.push(assessment);
      return assessment;
    },
    async audit(_operation, _actor, entityType, after, reason) {
      stored.audits.push({ entityType, entityId: after.id, reason });
    },
  };
  const run = vi.fn(
    async (
      _actorId: string,
      work: (ports: EligibilityTransaction) => Promise<unknown>,
    ) => work(tx),
  );
  const service = new EligibilityService(
    { read: (work) => work(reads) },
    { run: run as never },
    {
      currentKeyId: 'v1',
      calculate: (content) => JSON.stringify(content),
      matches: (first, second) => first === second,
    },
    () => now,
    'America/Fortaleza',
  );
  const publication = (changes = {}) => ({
    definition: policyDraft(),
    effectiveFrom: '2026-07-01',
    expectedLatestPolicyId: null as string | null,
    decisionReference: 'Synthetic decision reference',
    reason: 'Synthetic publication',
    retroactive: false,
    ...changes,
  });
  return {
    service,
    principal,
    sources,
    stored,
    tx,
    run,
    publication,
    context: { actor: principal, key: '00000000-0000-4000-8000-000000000003' },
  };
}

describe('Eligibility policy publication', () => {
  it.each(['revoked', 'inactive'] as const)(
    'rejects a %s author before looking up an idempotent result',
    async (state) => {
      const { service, principal, tx, context, publication } = fixture();
      vi.mocked(tx.actor).mockResolvedValue(
        state === 'revoked'
          ? { ...principal, authVersion: principal.authVersion + 1 }
          : { ...principal, user: { ...principal.user, active: false } },
      );
      await expect(
        service.publishPolicy(context, publication()),
      ).rejects.toMatchObject({ message: 'Authentication required' });
      expect(tx.operation).not.toHaveBeenCalled();
    },
  );
  it('is reserved to coordination', async () => {
    const { service, context, stored, publication } = fixture([
      'SOCIAL_ASSISTANCE',
    ]);
    await expect(
      service.publishPolicy(context, publication()),
    ).rejects.toMatchObject({ message: 'Operation not permitted' });
    expect(stored.policies).toEqual([]);
  });
  it('publishes an immutable version with its reason audited in the same unit of work', async () => {
    const { service, context, stored, tx, publication } = fixture();
    const policy = await service.publishPolicy(context, publication());
    expect(policy).toMatchObject({
      effectiveFrom: '2026-07-01',
      effectiveUntilExclusive: null,
      recordedBy: context.actor.user.id,
      definition: { schemaVersion: 1, toleranceRule: 'NONE' },
    });
    expect(stored.audits).toEqual([
      {
        entityType: 'EligibilityPolicy',
        entityId: policy.id,
        reason: 'Synthetic publication',
      },
    ]);
    expect(tx.completeOperation).toHaveBeenCalledWith('synthetic-operation', {
      entityType: 'EligibilityPolicy',
      entityId: policy.id,
    });
  });
  it('requires explicit confirmation for a retroactive start', async () => {
    const { service, context, stored, publication } = fixture();
    const past = publication({ effectiveFrom: '2026-05-31' });
    await expect(service.publishPolicy(context, past)).rejects.toMatchObject({
      rule: 'RETROACTIVE_CONFIRMATION_REQUIRED',
    });
    expect(stored.policies).toEqual([]);
    await expect(
      service.publishPolicy(context, { ...past, retroactive: true }),
    ).resolves.toMatchObject({ effectiveFrom: '2026-05-31' });
  });
  it('conflicts when another version was published after the one the author saw', async () => {
    const { service, context, stored, publication } = fixture();
    stored.policies.push(publishedPolicy());
    await expect(
      service.publishPolicy(context, publication()),
    ).rejects.toMatchObject({
      rule: 'POLICY_CHANGED',
      ids: [stored.policies[0]!.id],
    });
    await expect(
      service.publishPolicy(
        context,
        publication({
          expectedLatestPolicyId: stored.policies[0]!.id,
          effectiveFrom: stored.policies[0]!.effectiveFrom,
          retroactive: true,
        }),
      ),
    ).rejects.toMatchObject({ rule: 'POLICY_EFFECTIVE_DATE_TAKEN' });
    expect(stored.policies).toHaveLength(1);
  });
  it('rejects unsupported modalities and activities that are unknown or not periodic', async () => {
    const { service, context, stored, publication } = fixture();
    await expect(
      service.publishPolicy(
        context,
        publication({
          definition: policyDraft({ justificationRule: 'EXCUSED_COUNTS' }),
        }),
      ),
    ).rejects.toMatchObject({ rule: 'UNSUPPORTED_POLICY_MODALITY' });
    stored.natures.set(activityId, 'ONE_OFF' as never);
    await expect(
      service.publishPolicy(context, publication()),
    ).rejects.toMatchObject({ rule: 'PERIODIC_ACTIVITY_REQUIRED' });
    stored.natures.clear();
    await expect(
      service.publishPolicy(context, publication()),
    ).rejects.toMatchObject({ rule: 'ACTIVITY_NOT_FOUND' });
    expect(stored.policies).toEqual([]);
  });
  it('returns the original version when the same publication is repeated', async () => {
    const { service, context, stored, tx, publication } = fixture();
    const first = await service.publishPolicy(context, publication());
    vi.mocked(tx.operation).mockResolvedValue({
      actorId: context.actor.user.id,
      fingerprint: JSON.stringify({
        type: 'eligibility.policies.publish',
        input: publication(),
      }),
      reference: { entityType: 'EligibilityPolicy', entityId: first.id },
    });
    await expect(
      service.publishPolicy(context, publication()),
    ).resolves.toEqual(first);
    expect(stored.policies).toHaveLength(1);
    await expect(
      service.publishPolicy(context, publication({ reason: 'Another intent' })),
    ).rejects.toMatchObject({
      message: 'Idempotency key was used with different content or author',
    });
  });
});

describe('Eligibility evaluation', () => {
  it('previews with the version in effect on the reference date without writing', async () => {
    const { service, principal, sources, stored, run } = fixture([
      'SOCIAL_ASSISTANCE',
    ]);
    stored.policies.push(publishedPolicy({}, '2026-03-01'));
    sources.member(1);
    sources
      .enroll(1)
      .session('2026-03-10', { 1: 'PRESENT' })
      .session('2026-03-17', { 1: 'PRESENT' });
    await expect(
      service.preview(principal, familyId, '2026-02-28'),
    ).resolves.toMatchObject({
      status: 'PENDING',
      policyId: null,
      pendingReasons: ['POLICY_UNDEFINED'],
    });
    const preview = await service.preview(principal, familyId, '2026-03-31');
    expect(preview).toMatchObject({
      status: 'ELIGIBLE',
      policyId: stored.policies[0]!.id,
      evaluatedAt: now,
      explanation: { qualifyingPersonIds: [personId(1)] },
    });
    expect(run).not.toHaveBeenCalled();
    expect(stored.assessments).toEqual([]);
  });
  it('keeps the same source fingerprint while the sources do not change', async () => {
    const { service, principal, sources, stored } = fixture();
    stored.policies.push(publishedPolicy());
    sources.member(1);
    sources.enroll(1).session('2026-03-10', { 1: 'PRESENT' });
    const first = await service.preview(principal, familyId, '2026-03-31');
    const again = await service.preview(principal, familyId, '2026-03-31');
    expect(again.sourceFingerprint).toBe(first.sourceFingerprint);
    sources.session('2026-03-17', { 1: 'PRESENT' });
    const changed = await service.preview(principal, familyId, '2026-03-31');
    expect(changed.sourceFingerprint).not.toBe(first.sourceFingerprint);
  });
  it('denies the family result to activity managers and to accounts that must change password', async () => {
    const manager = fixture(['ACTIVITY_MANAGER']);
    await expect(
      manager.service.preview(manager.principal, familyId, '2026-03-31'),
    ).rejects.toMatchObject({ message: 'Operation not permitted' });
    await expect(
      manager.service.assess(manager.context, familyId, '2026-03-31'),
    ).rejects.toMatchObject({ message: 'Operation not permitted' });
    const { service, principal } = fixture();
    await expect(
      service.preview(
        { ...principal, user: { ...principal.user, mustChangePassword: true } },
        familyId,
        '2026-03-31',
      ),
    ).rejects.toMatchObject({ rule: 'PASSWORD_CHANGE_REQUIRED' });
  });
  it('answers not found for an unknown family instead of evaluating it', async () => {
    const { service, principal, context } = fixture();
    const unknown = '00000000-0000-4000-8000-00000000dead';
    await expect(
      service.preview(principal, unknown, '2026-03-31'),
    ).rejects.toMatchObject({ message: 'Resource not found' });
    await expect(
      service.assess(context, unknown, '2026-03-31'),
    ).rejects.toMatchObject({ message: 'Resource not found' });
  });
  it('persists the assessment with its requester and evidences, audited without an invented reason', async () => {
    const { service, context, sources, stored, tx } = fixture([
      'SOCIAL_ASSISTANCE',
    ]);
    stored.policies.push(publishedPolicy());
    sources.member(1);
    sources
      .enroll(1)
      .session('2026-03-10', { 1: 'PRESENT' })
      .session('2026-03-17', { 1: 'PRESENT' });
    const assessment = await service.assess(context, familyId, '2026-03-31');
    expect(assessment).toMatchObject({
      status: 'ELIGIBLE',
      requestedBy: context.actor.user.id,
      policyId: stored.policies[0]!.id,
      evidences: [{ presenceCount: 2 }],
    });
    expect(stored.assessments).toEqual([assessment]);
    expect(stored.audits).toEqual([
      {
        entityType: 'EligibilityAssessment',
        entityId: assessment.id,
        reason: undefined,
      },
    ]);
    expect(tx.completeOperation).toHaveBeenCalledWith('synthetic-operation', {
      entityType: 'EligibilityAssessment',
      entityId: assessment.id,
    });
  });
  it('keeps a saved assessment unchanged after its sources are corrected', async () => {
    const { service, context, principal, sources, stored } = fixture();
    stored.policies.push(publishedPolicy());
    sources.member(1);
    sources
      .enroll(1)
      .session('2026-03-10', { 1: 'PRESENT' })
      .session('2026-03-17', { 1: 'PRESENT' });
    const saved = await service.assess(context, familyId, '2026-03-31');
    sources.snapshot.activities[0]!.sessions[0]!.status = 'CANCELED';
    await expect(service.assessment(principal, saved.id)).resolves.toEqual(
      saved,
    );
    await expect(
      service.preview(principal, familyId, '2026-03-31'),
    ).resolves.toMatchObject({ status: 'PENDING' });
  });
});
