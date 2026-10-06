import { describe, expect, it, vi } from 'vitest';
import { SocialFormsService } from '../../../../src/features/social-forms/application/social-forms-service.js';
import type {
  SocialFormsTransaction,
  SocialFormsRepository,
  SocialConfiguration,
} from '../../../../src/features/social-forms/application/social-forms-ports.js';
import type {
  FeatureDecision,
  FieldSelection,
  SocialOption,
} from '../../../../src/features/social-forms/domain/social-forms.js';
import { createAccessServiceFixture } from '../../../support/access-service-fixture.js';
import { readConfig } from '../../../../src/core/infra/config.js';
import { createOperationFingerprints } from '../../../../src/core/infra/operation-fingerprint.js';
import { createSensitivePayloads } from '../../../../src/features/social-forms/infra/sensitive-payloads.js';
import type { Principal } from '../../../../src/features/access/application/ports.js';
import type {
  StoredSocialForm,
  Acknowledgement,
} from '../../../../src/features/social-forms/domain/social-forms.js';
import { randomBytes } from 'node:crypto';
import type { AuditEntry } from '../../../../src/features/audit/domain/audit-entry.js';
import type { SocialSnapshot } from '../../../../src/features/social-forms/domain/social-forms.js';
import type { SocialOperationReference } from '../../../../src/features/social-forms/application/social-forms-ports.js';
import { SocialFormRevisionConflictError } from '../../../../src/features/social-forms/domain/social-form-errors.js';

function fixture(
  protection = createSensitivePayloads('', {}),
  mode: 'SYNTHETIC' | 'REAL' = 'SYNTHETIC',
) {
  const { principal: original } = createAccessServiceFixture();
  const principal: Principal = {
    ...original,
    user: { ...original.user, roleCodes: ['COORDINATION'] },
  };
  const findActor = vi
    .fn<SocialFormsTransaction['findActor']>()
    .mockResolvedValue(principal);
  const configuration: SocialConfiguration = {
    selection: null,
    decisions: [],
    options: [],
  };
  const source = {
    family: {
      id: 'family',
      code: '1',
      referenceName: null,
      address: 'Old address',
      neighborhood: null,
      postalCode: null,
      location: null,
      contactPhone: null,
      revision: 1,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    familyIds: ['family'],
    members: [
      {
        person: {
          id: 'person',
          name: 'Old name',
          birthDate: null,
          sex: null,
          cpf: null,
          rg: null,
          occupation: null,
          educationLevel: null,
          contactPhone: null,
          revision: 1,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        membership: {
          id: 'membership',
          personId: 'person',
          familyId: 'family',
          validFrom: '2026-01-01T00:00:00Z',
          validUntil: null,
          relationshipToReference: null,
          isReference: true,
          revision: 1,
        },
        sizeProfile: null,
      },
    ],
    latestPublishedFormId: null as string | null,
    expectedPreviousVersionId: null as string | null,
    previousVersion: 0,
  };
  const forms = new Map<string, StoredSocialForm>();
  const snapshots = new Map<string, SocialSnapshot>();
  const findOperation = vi
    .fn<SocialFormsTransaction['findOperation']>()
    .mockResolvedValue(null);
  const ports = {
    findActor,
    configuration: async () => structuredClone(configuration),
    findOperation,
    createOperation: async () => 'operation',
    completeOperation: async () => {},
    audit: async (input: Parameters<SocialFormsTransaction['audit']>[0]) => {
      snapshots.set(
        `${input.entityType}:${input.after.id}:${'version' in input.after ? input.after.version : input.after.revision}`,
        structuredClone(input.after),
      );
    },
    readRevision: async (reference: SocialOperationReference) =>
      structuredClone(
        snapshots.get(
          `${reference.entityType}:${reference.id}:${reference.revision}`,
        )!,
      ),
    saveSelection: async (value: FieldSelection) => {
      configuration.selection = structuredClone(value);
    },
    saveDecision: async (value: FeatureDecision) => {
      configuration.decisions = [
        ...configuration.decisions.filter((row) => row.code !== value.code),
        structuredClone(value),
      ];
    },
    saveOption: async (value: SocialOption) => {
      configuration.options = [
        ...configuration.options.filter((row) => row.id !== value.id),
        structuredClone(value),
      ];
    },
    context: async () => structuredClone(source),
    selection: async () => configuration.selection,
    form: async (id: string) => structuredClone(forms.get(id) ?? null),
    createForm: async (value: StoredSocialForm) => {
      forms.set(value.id, structuredClone(value));
      source.latestPublishedFormId = value.id;
      source.expectedPreviousVersionId = value.id;
      source.previousVersion = value.version;
    },
    saveAcknowledgement: async (value: Acknowledgement) => {
      forms.get(value.socialFormId)!.acknowledgement = structuredClone(value);
    },
  };
  const tx = new Proxy(ports, {
    get(target, key) {
      if (key in target) return Reflect.get(target, key);
      throw new Error(`Unexpected transaction port: ${String(key)}`);
    },
  }) as unknown as SocialFormsTransaction;
  const repository: SocialFormsRepository = {
    run: async (_actor, work) => work(tx),
    read: async (work) => work(tx),
  };
  let sequence = 0;
  const fingerprints = createOperationFingerprints(
    readConfig({
      APP_ORIGIN: 'http://localhost:5173',
      DATABASE_URL: 'postgresql://localhost/erp_test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET_BASE64: randomBytes(32).toString('base64'),
      OPERATION_HMAC_CURRENT_KEY_ID: 'v1',
      OPERATION_HMAC_KEYS_JSON: JSON.stringify({
        v1: randomBytes(32).toString('base64'),
        v2: randomBytes(32).toString('base64'),
      }),
      COOKIE_SECURE: 'false',
    }),
  );
  const service = new SocialFormsService(
    repository,
    fingerprints,
    protection,
    () => '2026-10-05T12:00:00.000Z',
    () => `generated-${++sequence}`,
    mode,
  );
  return {
    service,
    principal,
    findActor,
    findOperation,
    fingerprints,
    configuration,
    source,
    forms,
    context: { actor: principal, key: '00000000-0000-4000-8000-000000000003' },
  };
}
describe('Social form command authorization', () => {
  it.each(['revoked', 'inactive', 'roles', 'password'] as const)(
    'revalidates a %s author before configuration or replay',
    async (state) => {
      const { service, principal, findActor, context } = fixture();
      findActor.mockResolvedValue(
        state === 'revoked'
          ? { ...principal, authVersion: principal.authVersion + 1 }
          : {
              ...principal,
              user: {
                ...principal.user,
                ...(state === 'inactive'
                  ? { active: false }
                  : state === 'roles'
                    ? { roleCodes: ['ADMINISTRATOR'] as const }
                    : { mustChangePassword: true }),
              },
            },
      );
      await expect(
        service.configureSelection(context, {
          expectedRevision: null,
          fields: [],
          decisionReference: 'SYNTHETIC-TEST',
          reason: 'Synthetic setup',
        }),
      ).rejects.toThrow(
        state === 'revoked' || state === 'inactive'
          ? 'Authentication required'
          : 'Operation not permitted',
      );
    },
  );
});
describe('Social form protected projection and acknowledgement', () => {
  it('removes protected content from historical reads when its block is disabled', async () => {
    const f = fixture(createSensitivePayloads('v1', { v1: randomBytes(32) }));
    const selection = await f.service.configureSelection(f.context, {
      expectedRevision: null,
      fields: [
        {
          fieldKey: 'members[].health.physicalHealth',
          included: true,
          required: false,
          appliesTo: 'REFERENCE_MEMBER',
          allowedRoleCodes: ['COORDINATION'],
          cardinality: 'SINGLE',
          purpose: 'Synthetic evaluation',
          decisionReference: 'SYNTHETIC-TEST',
        },
      ],
      decisionReference: 'SYNTHETIC-TEST',
      reason: 'Synthetic setup',
    });
    const decision = await f.service.configureDecision(
      f.context,
      'FIC_HEALTH',
      {
        expectedRevision: null,
        enabled: true,
        decisionReference: 'SYNTHETIC-TEST',
        reason: 'Synthetic setup',
      },
    );
    const form = await f.service.publish(f.context, 'family', {
      occurredAt: '2026-10-01T12:00:00Z',
      expectedFamilyRevision: 1,
      expectedPreviousVersionId: null,
      fieldSelectionVersionId: selection.id,
      memberRevisions: [
        {
          personId: 'person',
          expectedPersonRevision: 1,
          membershipId: 'membership',
          expectedMembershipRevision: 1,
        },
      ],
      blocks: {},
      members: [{ personId: 'person', health: { physicalHealth: 'GOOD' } }],
    });
    expect(form.members[0]?.blocks.health).toEqual({ physicalHealth: 'GOOD' });
    expect(form.members[0]).not.toHaveProperty('protectedBlocks');
    expect(JSON.stringify(f.forms.get(form.id))).not.toContain('GOOD');
    const entry = {
      id: 'audit',
      operationId: 'operation',
      entityType: 'SocialForm',
      entityId: form.id,
      revision: 1,
      action: 'CREATE',
      actorType: 'USER',
      actorId: f.principal.user.id,
      actor: {
        id: f.principal.user.id,
        displayName: 'Synthetic author',
        active: true,
      },
      recordedAt: form.recordedAt,
      occurredAt: form.occurredAt,
      classification: 'SOCIAL_FORMS',
      before: null,
      after: f.forms.get(form.id)!,
      reason: 'Synthetic protected reason',
    } as AuditEntry;
    expect(
      JSON.stringify(await f.service.projectAudit(f.principal, entry)),
    ).not.toContain('ciphertext');
    await f.service.configureDecision(f.context, 'FIC_HEALTH', {
      expectedRevision: decision.revision,
      enabled: false,
      decisionReference: 'SYNTHETIC-TEST',
      reason: 'Synthetic suspension',
    });
    expect(
      (await f.service.get(f.principal, form.id)).members[0]?.blocks,
    ).toEqual({});
    expect((await f.service.fields(f.principal)).selection?.fields).toEqual([]);
    expect(await f.service.projectAudit(f.principal, entry)).toBeNull();
  });
  it('records and corrects dated acknowledgement while preserving the published form', async () => {
    const f = fixture();
    const selection = await f.service.configureSelection(f.context, {
      expectedRevision: null,
      fields: [],
      decisionReference: 'SYNTHETIC-TEST',
      reason: 'Synthetic setup',
    });
    const form = await f.service.publish(f.context, 'family', {
      occurredAt: '2026-10-01T12:00:00Z',
      expectedFamilyRevision: 1,
      expectedPreviousVersionId: null,
      fieldSelectionVersionId: selection.id,
      memberRevisions: [
        {
          personId: 'person',
          expectedPersonRevision: 1,
          membershipId: 'membership',
          expectedMembershipRevision: 1,
        },
      ],
      blocks: {},
      members: [],
    });
    expect(form.acknowledgement).toBeNull();
    const acknowledgement = await f.service.acknowledge(f.context, form.id, {
      expectedRevision: null,
      referencePersonId: 'person',
      method: 'PAPER_SIGNATURE',
      acknowledgedOn: '2026-10-01',
    });
    expect(acknowledgement).toMatchObject({
      revision: 1,
      acknowledgedOn: '2026-10-01',
    });
    await expect(
      f.service.acknowledge(f.context, form.id, {
        expectedRevision: 1,
        referencePersonId: 'person',
        method: 'PAPER_SIGNATURE',
        acknowledgedOn: '2026-09-30',
      }),
    ).rejects.toThrow('INVALID_ACKNOWLEDGEMENT');
    const corrected = await f.service.acknowledge(f.context, form.id, {
      expectedRevision: 1,
      referencePersonId: 'person',
      method: 'PAPER_SIGNATURE',
      acknowledgedOn: '2026-09-30',
      reason: 'Synthetic date correction',
    });
    expect(corrected.revision).toBe(2);
    expect((await f.service.get(f.principal, form.id)).version).toBe(1);
    expect(form.acknowledgement).toBeNull();
  });
});
describe('Social form ancillary commands', () => {
  it('manages versioned catalog options without creating arbitrary form keys', async () => {
    const f = fixture();
    const option = await f.service.createOption(f.context, {
      fieldKey: 'housing.housingTenure',
      code: 'OWNED',
      label: 'Própria',
      active: true,
      isOther: false,
      decisionReference: 'SYNTHETIC-TEST',
    });
    expect(option).toMatchObject({ revision: 1, code: 'OWNED' });
    const changed = await f.service.updateOption(f.context, option.id, {
      expectedRevision: 1,
      active: false,
      decisionReference: 'SYNTHETIC-TEST',
      reason: 'Synthetic deactivation',
    });
    expect(changed).toMatchObject({
      revision: 2,
      active: false,
      code: 'OWNED',
    });
    await expect(
      f.service.createOption(f.context, {
        fieldKey: 'housing.roomCount',
        code: 'CUSTOM',
        label: 'Invalid',
        active: true,
        isOther: false,
        decisionReference: 'SYNTHETIC-TEST',
      }),
    ).rejects.toThrow('INVALID_OPTION');
  });
});
describe('Social form publication', () => {
  it('replays immutable evidence with the original HMAC key after rotation and rejects another intention', async () => {
    const f = fixture();
    const selection = await f.service.configureSelection(f.context, {
      expectedRevision: null,
      fields: [],
      decisionReference: 'SYNTHETIC-TEST',
      reason: 'Synthetic setup',
    });
    const input = {
      occurredAt: '2026-10-01T12:00:00Z',
      expectedFamilyRevision: 1,
      expectedPreviousVersionId: null,
      fieldSelectionVersionId: selection.id,
      memberRevisions: [
        {
          personId: 'person',
          expectedPersonRevision: 1,
          membershipId: 'membership',
          expectedMembershipRevision: 1,
        },
      ],
      blocks: {},
      members: [],
    };
    const form = await f.service.publish(f.context, 'family', input);
    f.findOperation.mockResolvedValue({
      actorId: f.principal.user.id,
      fingerprintKeyId: 'v1',
      fingerprint: f.fingerprints.calculate(
        {
          type: 'socialForms.publish',
          input: { familyId: 'family', ...input },
        },
        'v1',
      ),
      reference: {
        entityType: 'SocialForm',
        id: form.id,
        revision: form.version,
      },
    });
    f.fingerprints.currentKeyId = 'v2';
    f.source.members[0]!.person.name = 'Synthetic current name';
    expect(await f.service.publish(f.context, 'family', input)).toEqual(form);
    await expect(
      f.service.publish(f.context, 'family', {
        ...input,
        occurredAt: '2026-09-30T12:00:00Z',
      }),
    ).rejects.toThrow(
      'Idempotency key was used with different content or author',
    );
  });
  it('requires the global decision inside the read transaction before exposing real identity', async () => {
    const f = fixture(createSensitivePayloads('', {}), 'REAL');
    await expect(
      f.service.context(f.principal, 'family', '2026-10-01T12:00:00Z'),
    ).rejects.toThrow('Real personal data requires an institutional decision');
  });
  it('exposes the verified revision base without publishing or transporting an obsolete member', async () => {
    const f = fixture();
    const before = await f.service.context(
      f.principal,
      'family',
      '2026-10-01T12:00:00Z',
    );
    expect(before).toMatchObject({
      expectedFamilyRevision: 1,
      expectedPreviousVersionId: null,
      memberRevisions: [
        {
          personId: 'person',
          expectedPersonRevision: 1,
          membershipId: 'membership',
          expectedMembershipRevision: 1,
          sizeProfilePersonId: null,
          expectedSizeRevision: null,
        },
      ],
    });
    expect(f.forms.size).toBe(0);
    f.source.members = [];
    expect(
      (await f.service.context(f.principal, 'family', '2026-10-02T12:00:00Z'))
        .members,
    ).toEqual([]);
  });
  it('returns the preview fact instant in UTC independently from the submitted offset', async () => {
    const f = fixture();
    expect(
      (
        await f.service.context(
          f.principal,
          'family',
          '2026-10-01T09:00:00-03:00',
        )
      ).occurredAt,
    ).toBe('2026-10-01T12:00:00.000Z');
  });
  it('freezes the verified composition and creates a separate version for an older correction', async () => {
    const f = fixture();
    const selection = await f.service.configureSelection(f.context, {
      expectedRevision: null,
      fields: [
        {
          fieldKey: 'housing.roomCount',
          included: true,
          required: false,
          appliesTo: 'FAMILY',
          allowedRoleCodes: ['COORDINATION'],
          cardinality: 'SINGLE',
          purpose: 'Synthetic evaluation',
          decisionReference: 'SYNTHETIC-TEST',
        },
      ],
      decisionReference: 'SYNTHETIC-TEST',
      reason: 'Synthetic setup',
    });
    await f.service.configureDecision(f.context, 'FIC_HOUSING', {
      expectedRevision: null,
      enabled: true,
      decisionReference: 'SYNTHETIC-TEST',
      reason: 'Synthetic setup',
    });
    const input = {
      occurredAt: '2026-10-01T12:00:00Z',
      expectedFamilyRevision: 1,
      expectedPreviousVersionId: null,
      fieldSelectionVersionId: selection.id,
      memberRevisions: [
        {
          personId: 'person',
          expectedPersonRevision: 1,
          membershipId: 'membership',
          expectedMembershipRevision: 1,
          sizeProfilePersonId: null,
          expectedSizeRevision: null,
        },
      ],
      blocks: { housing: { roomCount: 0 } },
      members: [],
    };
    const first = await f.service.publish(f.context, 'family', input);
    f.source.family.address = 'New address';
    f.source.members[0]!.person.name = 'New name';
    expect(await f.service.get(f.principal, first.id)).toMatchObject({
      version: 1,
      familySnapshot: { address: 'Old address' },
      members: [{ personSnapshot: { name: 'Old name' } }],
      blocks: { housing: { roomCount: 0 } },
    });
    const correction = await f.service.publish(f.context, 'family', {
      ...input,
      occurredAt: '2026-09-30T12:00:00Z',
      expectedPreviousVersionId: first.id,
      correctionOfFormId: first.id,
      reason: 'Synthetic correction',
    });
    expect(correction).toMatchObject({
      version: 2,
      previousVersionId: first.id,
      correctionOfFormId: first.id,
      familySnapshot: { address: 'New address' },
    });
    await expect(f.service.publish(f.context, 'family', input)).rejects.toThrow(
      'PREVIOUS_VERSION_CHANGED',
    );
    await expect(
      f.service.publish(f.context, 'family', {
        ...input,
        expectedPreviousVersionId: correction.id,
        memberRevisions: [
          { ...input.memberRevisions[0]!, expectedPersonRevision: 2 },
        ],
      }),
    ).rejects.toEqual(new SocialFormRevisionConflictError(1));
  });
});
describe('Social form configuration', () => {
  it('reports a stale numeric configuration revision without replacing the current decision', async () => {
    const f = fixture();
    await f.service.configureSelection(f.context, {
      expectedRevision: null,
      fields: [],
      decisionReference: 'SYNTHETIC-TEST',
      reason: 'Synthetic setup',
    });
    await expect(
      f.service.configureSelection(f.context, {
        expectedRevision: null,
        fields: [],
        decisionReference: 'SYNTHETIC-TEST',
        reason: 'Synthetic update',
      }),
    ).rejects.toEqual(new SocialFormRevisionConflictError(1));
    expect(f.configuration.selection?.version).toBe(1);
  });
  it('requires an explicit selection and hides fields until their block is enabled', async () => {
    const { service, principal, context } = fixture();
    await service.configureSelection(context, {
      expectedRevision: null,
      fields: [
        {
          fieldKey: 'housing.roomCount',
          included: true,
          required: false,
          appliesTo: 'FAMILY',
          allowedRoleCodes: ['COORDINATION'],
          cardinality: 'SINGLE',
          purpose: 'Synthetic evaluation',
          decisionReference: 'SYNTHETIC-TEST',
        },
      ],
      decisionReference: 'SYNTHETIC-TEST',
      reason: 'Synthetic setup',
    });
    expect((await service.fields(principal)).selection?.fields).toEqual([]);
    await service.configureDecision(context, 'FIC_HOUSING', {
      expectedRevision: null,
      enabled: true,
      decisionReference: 'SYNTHETIC-TEST',
      reason: 'Synthetic setup',
    });
    expect(
      (await service.fields(principal)).selection?.fields.map(
        (field) => field.fieldKey,
      ),
    ).toEqual(['housing.roomCount']);
    await expect(
      service.configureDecision(context, 'FIC_HEALTH', {
        expectedRevision: null,
        enabled: true,
        decisionReference: 'SYNTHETIC-TEST',
        reason: 'Synthetic setup',
      }),
    ).rejects.toThrow('DECISION_DEPENDENCY');
  });
});
