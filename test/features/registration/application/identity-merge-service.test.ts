import { describe, expect, it, vi } from 'vitest';
import { IdentityMergeService } from '../../../../src/features/registration/application/identity-merge-service.js';
import type {
  IdentityMergeTransaction,
  MergeAuditEntry,
} from '../../../../src/features/registration/application/identity-merge-ports.js';
import type {
  IdentityMerge,
  MergeCommand,
  PersonMergeSources,
} from '../../../../src/features/registration/domain/identity-merge.js';
import type { RegisteredPerson } from '../../../../src/features/registration/domain/registration.js';
import type { Principal } from '../../../../src/features/access/application/ports.js';
import type { Role } from '@erp/contracts/access';
import { createAccessServiceFixture } from '../../../support/access-service-fixture.js';

const id = (value: number) =>
  `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const sourceId = id(11);
const targetId = id(12);
const person = (
  personId: string,
  changes: Partial<RegisteredPerson> = {},
): RegisteredPerson => ({
  id: personId,
  name: 'Synthetic Person',
  birthDate: null,
  sex: null,
  cpf: null,
  rg: null,
  occupation: null,
  educationLevel: null,
  contactPhone: null,
  revision: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...changes,
});

function fixture(roles: Role[] = ['SOCIAL_ASSISTANCE']) {
  const { principal: original } = createAccessServiceFixture();
  const principal: Principal = {
    ...original,
    user: { ...original.user, roleCodes: roles },
  };
  const sources: PersonMergeSources = {
    entityType: 'PERSON',
    source: person(sourceId, { cpf: '11111111111', rg: '10' }),
    target: person(targetId, { name: 'Synthetic Person B', revision: 4 }),
    memberships: [],
    families: [],
    enrollments: [],
    attendances: [],
    sessions: [],
    sizeProfiles: { source: null, target: null },
    issues: [],
    preserved: { socialForms: 0, eligibilityAssessments: 0 },
  };
  const audits: MergeAuditEntry[] = [];
  const merges: IdentityMerge[] = [];
  const writes = {
    missingData: {
      selection: vi.fn().mockResolvedValue(null),
      openIssues: vi.fn().mockResolvedValue([]),
      createIssue: vi.fn(),
      closeIssue: vi.fn(),
    },
    actor: vi
      .fn<IdentityMergeTransaction['actor']>()
      .mockResolvedValue(principal),
    operation: vi.fn<IdentityMergeTransaction['operation']>(),
    sources: vi
      .fn<IdentityMergeTransaction['sources']>()
      .mockImplementation(async () => sources),
    createOperation: vi
      .fn<IdentityMergeTransaction['createOperation']>()
      .mockResolvedValue(id(90)),
    completeOperation: vi.fn<IdentityMergeTransaction['completeOperation']>(),
    updateTarget: vi
      .fn<IdentityMergeTransaction['updateTarget']>()
      .mockImplementation(async (_identities, changes) => ({
        ...sources.target,
        ...changes,
        revision: sources.target.revision + 1,
      })),
    markMerged: vi.fn<IdentityMergeTransaction['markMerged']>(),
    createMerge: vi
      .fn<IdentityMergeTransaction['createMerge']>()
      .mockImplementation(async (input) => {
        const merge = {
          ...input,
          id: id(91),
          recordedAt: '2026-10-05T12:00:00.000Z',
        };
        merges.push(merge);
        return merge;
      }),
    audit: vi
      .fn<IdentityMergeTransaction['audit']>()
      .mockImplementation(async (entry) => {
        audits.push(entry);
      }),
  };
  // Any other effect would mean the merge touched records it should not.
  const tx = new Proxy(writes, {
    get(target, key) {
      if (key in target) return Reflect.get(target, key);
      throw new Error(`Unexpected transaction port: ${String(key)}`);
    },
  }) as unknown as IdentityMergeTransaction;
  const service = new IdentityMergeService(
    { read: (work) => work({ sources: writes.sources }) },
    { run: async (_actor, _identities, work) => work(tx) },
    {
      currentKeyId: 'v1',
      calculate: (content) => JSON.stringify(content),
      matches: (first, second) => first === second,
    },
    () => '2026-10-05T12:00:00.000Z',
    'America/Fortaleza',
  );
  const identities = { entityType: 'PERSON' as const, sourceId, targetId };
  async function command(changes: Partial<MergeCommand> = {}) {
    const preview = await service.preview(principal, identities);
    return {
      ...identities,
      expectedSourceRevision: preview.expectedSourceRevision,
      expectedTargetRevision: preview.expectedTargetRevision,
      expectedSourceFingerprint: preview.sourceFingerprint,
      fieldSelections: { name: 'TARGET' as const },
      membershipResolutions: [],
      enrollmentResolutions: [],
      attendanceResolutions: [],
      sizeProfileResolution: null,
      reason: 'Synthetic duplicate registration',
      ...changes,
    } satisfies MergeCommand;
  }
  return {
    service,
    principal,
    sources,
    writes,
    audits,
    merges,
    identities,
    command,
    context: { actor: principal, key: id(3) },
  };
}

describe('Identity merge preview', () => {
  it('requires the merge capability before reading any history', async () => {
    const { service, principal, writes, identities } = fixture([
      'ACTIVITY_MANAGER',
    ]);
    await expect(service.preview(principal, identities)).rejects.toMatchObject({
      message: 'Operation not permitted',
    });
    expect(writes.sources).not.toHaveBeenCalled();
  });
  it('lists divergent fields and source-only values without changing anything', async () => {
    const { service, principal, writes, identities } = fixture();
    const preview = await service.preview(principal, identities);
    expect(preview).toMatchObject({
      ...identities,
      expectedSourceRevision: 1,
      expectedTargetRevision: 4,
      fieldConflicts: [
        {
          field: 'name',
          source: 'Synthetic Person',
          target: 'Synthetic Person B',
        },
      ],
      adoptedFields: ['cpf', 'rg'],
      membershipConflicts: [],
      attendanceConflicts: [],
      sizeProfileConflict: null,
    });
    expect(writes.createOperation).not.toHaveBeenCalled();
    expect(writes.markMerged).not.toHaveBeenCalled();
  });
  it('answers not found when an identity is missing or already merged', async () => {
    const { service, principal, writes, identities } = fixture();
    writes.sources.mockResolvedValue(null);
    await expect(service.preview(principal, identities)).rejects.toMatchObject({
      message: 'Resource not found',
    });
  });
  it('refuses to merge an identity into itself', async () => {
    const { service, principal, writes } = fixture();
    await expect(
      service.preview(principal, {
        entityType: 'PERSON',
        sourceId,
        targetId: sourceId,
      }),
    ).rejects.toMatchObject({ rule: 'MERGE_SAME_IDENTITY' });
    expect(writes.sources).not.toHaveBeenCalled();
  });
});

describe('Identity merge confirmation', () => {
  it('adopts the source CPF without assigning it to two canonical identities', async () => {
    const { service, sources, writes, context, command } = fixture();
    let sourceIsCanonical = true;
    writes.markMerged.mockImplementation(async () => {
      sourceIsCanonical = false;
    });
    writes.updateTarget.mockImplementation(async (_identities, changes) => {
      if (sourceIsCanonical && changes.cpf === sources.source.cpf)
        throw new Error('Canonical CPF unique constraint violated');
      return {
        ...sources.target,
        ...changes,
        revision: sources.target.revision + 1,
      };
    });
    const result = await service.merge(context, await command());
    expect(result.target).toMatchObject({ cpf: sources.source.cpf });
  });
  it.each(['revoked', 'inactive'] as const)(
    'rejects a %s author before looking up an idempotent result',
    async (state) => {
      const { service, principal, writes, context, command } = fixture();
      const input = await command();
      writes.actor.mockResolvedValue(
        state === 'revoked'
          ? { ...principal, authVersion: principal.authVersion + 1 }
          : { ...principal, user: { ...principal.user, active: false } },
      );
      await expect(service.merge(context, input)).rejects.toMatchObject({
        message: 'Authentication required',
      });
      expect(writes.operation).not.toHaveBeenCalled();
    },
  );
  it('conflicts without effects when the histories changed after the preview', async () => {
    const { service, sources, writes, context, command } = fixture();
    const input = await command();
    sources.target = { ...sources.target, revision: 5 };
    await expect(service.merge(context, input)).rejects.toMatchObject({
      currentRevision: 5,
    });
    await expect(
      service.merge(context, { ...input, expectedTargetRevision: 5 }),
    ).rejects.toMatchObject({ rule: 'MERGE_SOURCES_CHANGED' });
    expect(writes.createOperation).not.toHaveBeenCalled();
  });
  it('never chooses a divergent field automatically', async () => {
    const { service, writes, context, command } = fixture();
    await expect(
      service.merge(context, await command({ fieldSelections: {} })),
    ).rejects.toMatchObject({ rule: 'MERGE_RESOLUTION_REQUIRED' });
    expect(writes.createOperation).not.toHaveBeenCalled();
  });
  it('rejects resolutions that do not answer a conflict of this merge', async () => {
    const { service, writes, context, command } = fixture();
    await expect(
      service.merge(
        context,
        await command({ sizeProfileResolution: { keep: 'SOURCE' } }),
      ),
    ).rejects.toMatchObject({ rule: 'MERGE_RESOLUTION_INVALID' });
    expect(writes.createOperation).not.toHaveBeenCalled();
  });
  it('supersedes the duplicate marking before moving the effective one, whatever their order', async () => {
    const { service, sources, writes, context, command } = fixture();
    const mark = (attendanceId: string, personId: string) =>
      ({
        id: attendanceId,
        sessionId: id(50),
        personId,
        familyId: id(60),
        membershipId: id(70),
        membershipRevision: 1,
        status: 'PRESENT',
        recordedAt: '2026-01-05T13:00:00.000Z',
        recordedBy: id(1),
        revision: 1,
        supersededById: null,
      }) as const;
    // The source marking sorts first, so a naive loop would move it onto the still effective duplicate.
    sources.attendances = [mark(id(41), sourceId), mark(id(42), targetId)];
    sources.sessions = [
      {
        id: id(50),
        activityId: id(51),
        responsibleId: id(1),
        occurredAt: '2026-01-05T13:00:00.000Z',
        recordedAt: '2026-01-05T13:00:00.000Z',
        recordedBy: id(1),
        status: 'COMPLETED',
        revision: 1,
      },
    ];
    const order: string[] = [];
    Object.assign(writes, {
      updateAttendance: vi.fn(async (attendanceId: string, changes: object) => {
        order.push(
          `${attendanceId === id(41) ? 'source' : 'target'}:${Object.keys(changes).join()}`,
        );
        return {
          ...sources.attendances.find((row) => row.id === attendanceId)!,
          ...changes,
          revision: 2,
        };
      }),
      reviseSession: vi.fn(async () => ({
        ...sources.sessions[0]!,
        revision: 2,
      })),
    });
    await service.merge(
      context,
      await command({
        attendanceResolutions: [
          { sessionId: id(50), effectiveAttendanceId: id(41) },
        ],
      }),
    );
    expect(order).toEqual(['target:supersededById', 'source:personId']);
  });
  it('maps the source to the canonical target with reason, author and one operation', async () => {
    const { service, writes, audits, merges, context, command, identities } =
      fixture();
    const result = await service.merge(context, await command());
    expect(writes.updateTarget).toHaveBeenCalledWith(identities, {
      cpf: '11111111111',
      rg: '10',
    });
    expect(writes.markMerged).toHaveBeenCalledWith(identities);
    expect(result.target).toMatchObject({
      id: targetId,
      name: 'Synthetic Person B',
      cpf: '11111111111',
      revision: 5,
    });
    expect(merges).toEqual([result.merge]);
    expect(result.merge).toMatchObject({
      ...identities,
      recordedBy: context.actor.user.id,
      reason: 'Synthetic duplicate registration',
      operationId: id(90),
      resolution: {
        fieldSelections: { name: 'TARGET' },
        adoptedFields: ['cpf', 'rg'],
        supersededAttendances: [],
      },
    });
    expect(
      audits.map((row) => [row.entityType, row.entityId, row.reason]),
    ).toEqual([
      ['Person', targetId, 'Synthetic duplicate registration'],
      ['IdentityMerge', result.merge.id, 'Synthetic duplicate registration'],
    ]);
    expect(new Set(audits.map((row) => row.operationId))).toEqual(
      new Set([id(90)]),
    );
    expect(writes.completeOperation).toHaveBeenCalledWith(id(90), {
      merge: { entityType: 'IdentityMerge', entityId: result.merge.id },
      target: { entityType: 'Person', entityId: targetId, revision: 5 },
    });
  });
});
