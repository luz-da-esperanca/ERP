import type { Capability } from '@erp/contracts/access';
import type {
  CommandContext,
  Principal,
} from '../../access/application/ports.js';
import type { OperationFingerprints } from '../../access/application/account-transactions.js';
import {
  assertPermission,
  capabilitiesFor,
} from '../../access/domain/permissions.js';
import { AuthenticationRequiredError } from '../../access/application/access-errors.js';
import {
  IdempotencyConflictError,
  ResourceNotFoundError,
  FeatureNotEnabledError,
} from '../../../core/application/errors.js';
import type { DataMode } from '../../../core/application/data-mode.js';
import {
  validateFieldSelection,
  validateSocialValues,
  allowsField,
  blockDecision,
  fieldBlock,
  memberApplies,
  catalogFields,
} from '../domain/social-form-rules.js';
import {
  SocialFormConflictError,
  SocialFormRuleError,
  SocialFormRevisionConflictError,
} from '../domain/social-form-errors.js';
import type {
  FieldDefinition,
  FieldSelection,
  FeatureDecision,
} from '../domain/social-forms.js';
import type {
  StoredSocialForm,
  SocialFormPublication,
  FormMember,
  SocialOption,
  Acknowledgement,
  SocialFormListQuery,
} from '../domain/social-forms.js';
import type {
  FeatureDecisionCode,
  SocialFieldKey,
  SocialValues,
  SocialMemberBlocks,
} from '@erp/contracts/social-form-fields';
import type { SensitivePayloads } from './sensitive-payloads.js';
import type {
  SocialEntity,
  SocialSnapshot,
  SocialFormsRepository,
  SocialFormsTransaction,
  SocialFormsReadTransaction,
  SocialConfiguration,
} from './social-forms-ports.js';
import type { AuditEntry } from '../../audit/domain/audit-entry.js';
import {
  familyFormFields,
  familyFormTemplateCode,
  validateFamilyFormSource,
} from '../domain/family-form-template.js';
import { initialSocialOptions } from '../domain/initial-social-options.js';

export class SocialFormsService {
  constructor(
    private readonly repository: SocialFormsRepository,
    private readonly fingerprints: OperationFingerprints,
    private readonly protection: SensitivePayloads,
    private readonly now: () => string,
    private readonly newId: () => string,
    private readonly mode: DataMode,
  ) {}
  private command<T extends SocialSnapshot>(
    context: CommandContext,
    entityType: SocialEntity,
    type: string,
    input: unknown,
    capability: Capability,
    work: (
      tx: SocialFormsTransaction,
      actor: Principal,
      operationId: string,
    ) => Promise<T>,
    project?: (
      tx: SocialFormsTransaction,
      actor: Principal,
      value: T,
    ) => Promise<T>,
  ) {
    return this.repository.run(context.actor.user.id, async (tx) => {
      const actor = await tx.findActor(context.actor.user.id);
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
      if (this.mode === 'REAL') this.enabled(await tx.configuration());
      const existing = await tx.findOperation(type, context.key);
      const fingerprintKeyId =
        existing?.fingerprintKeyId ?? this.fingerprints.currentKeyId;
      const fingerprint = this.fingerprints.calculate(
        { type, input },
        fingerprintKeyId,
      );
      if (existing) {
        if (
          existing.actorId !== actor.user.id ||
          !this.fingerprints.matches(existing.fingerprint, fingerprint) ||
          existing.reference.entityType !== entityType
        )
          throw new IdempotencyConflictError();
        const value = (await tx.readRevision(existing.reference)) as T;
        return project ? project(tx, actor, value) : value;
      }
      const operationId = await tx.createOperation(
        type,
        context.key,
        actor.user.id,
        fingerprint,
        fingerprintKeyId,
      );
      const result = await work(tx, actor, operationId);
      await tx.completeOperation(operationId, {
        entityType,
        id: result.id,
        revision: 'version' in result ? result.version : result.revision,
      });
      return project ? project(tx, actor, result) : result;
    });
  }
  private require<T>(value: T | null) {
    if (!value) throw new ResourceNotFoundError();
    return value;
  }
  private async projectForm(
    tx: SocialFormsReadTransaction,
    actor: Principal,
    form: StoredSocialForm,
  ) {
    const config = await tx.configuration();
    const original = this.require(
      await tx.selection(form.fieldSelectionVersionId),
    );
    const enabled = this.enabled(config);
    const visible = (key: SocialFieldKey, member?: FormMember) => {
      const old = original.fields.find((field) => field.fieldKey === key);
      const current = config.selection?.fields.find(
        (field) => field.fieldKey === key,
      );
      const memberValues = member
        ? {
            personId: member.personId,
            isReference: member.relationshipSnapshot.isReference,
            selectedFieldKeys: member.selectedFieldKeys,
            blocks: member.blocks,
          }
        : undefined;
      return (
        !!old &&
        !!current &&
        allowsField(old, actor.user.roleCodes, enabled) &&
        allowsField(current, actor.user.roleCodes, enabled) &&
        (!memberValues ||
          (memberApplies(old, memberValues) &&
            (config.selection?.decisionReference === familyFormTemplateCode ||
              memberApplies(current, memberValues))))
      );
    };
    let complete = true;
    const project = (
      blocks: StoredSocialForm['blocks'] | SocialMemberBlocks,
      member?: FormMember,
    ) => {
      const result: Record<string, unknown> = {};
      for (const [block, values] of Object.entries(blocks)) {
        if (block === 'medications') {
          if (visible('members[].medications', member)) result[block] = values;
          else complete = false;
        } else
          for (const [field, value] of Object.entries(values ?? {})) {
            if (
              visible(
                `${member ? 'members[].' : ''}${block}.${field}` as SocialFieldKey,
                member,
              )
            )
              ((result[block] ??= {}) as SocialValues)[field] = value;
            else complete = false;
          }
      }
      return result;
    };
    const blocks = project(form.blocks) as StoredSocialForm['blocks'];
    const members = form.members.map((member) => {
      const unprotected: SocialMemberBlocks = { ...member.blocks };
      const { protectedBlocks, ...safe } = member;
      for (const [block, envelope] of Object.entries(protectedBlocks ?? {})) {
        const keyPrefix = `members[].${block}`;
        if (
          !original.fields.some(
            (field) =>
              field.fieldKey.startsWith(keyPrefix) &&
              visible(field.fieldKey, member),
          )
        ) {
          complete = false;
          continue;
        }
        Object.assign(unprotected, {
          [block]: this.protection.open(
            {
              formId: form.id,
              version: form.version,
              memberId: member.id,
              block: block as 'health' | 'medications' | 'religion',
            },
            envelope,
          ),
        });
      }
      return {
        ...safe,
        selectedFieldKeys: member.selectedFieldKeys.filter((key) =>
          visible(key, member),
        ),
        blocks: project(unprotected, member) as SocialMemberBlocks,
      };
    });
    return { ...form, blocks, members, reason: complete ? form.reason : null };
  }
  context(actor: Principal, familyId: string, occurredAt: string) {
    assertPermission(
      actor.user.roleCodes,
      actor.user.mustChangePassword,
      'socialForms.read',
    );
    if (Date.parse(occurredAt) > Date.parse(this.now()))
      throw new SocialFormRuleError('FUTURE_FACT');
    return this.repository.read(async (tx) => {
      const source = this.require(await tx.context(familyId, occurredAt));
      const config = await tx.configuration();
      const enabled = this.enabled(config);
      const fields =
        config.selection?.fields.filter((field) =>
          allowsField(field, actor.user.roleCodes, enabled),
        ) ?? [];
      return {
        occurredAt: new Date(occurredAt).toISOString(),
        family: source.family,
        expectedFamilyRevision: source.family.revision,
        expectedPreviousVersionId: source.expectedPreviousVersionId,
        latestPublishedFormId: source.latestPublishedFormId,
        referencePersonId:
          source.members.find((member) => member.membership.isReference)?.person
            .id ?? null,
        fieldSelectionVersionId: config.selection?.id ?? null,
        memberRevisions: source.members.map((row) => ({
          personId: row.person.id,
          expectedPersonRevision: row.person.revision,
          membershipId: row.membership.id,
          expectedMembershipRevision: row.membership.revision,
          sizeProfilePersonId: row.sizeProfile?.personId ?? null,
          expectedSizeRevision: row.sizeProfile?.revision ?? null,
        })),
        members: source.members.map((row) => ({
          person: {
            id: row.person.id,
            name: row.person.name,
            birthDate: row.person.birthDate,
            sex: row.person.sex,
            revision: row.person.revision,
            ...(config.selection?.decisionReference === familyFormTemplateCode
              ? {
                  cpf: row.person.cpf,
                  rg: row.person.rg,
                  occupation: row.person.occupation,
                  educationLevel: row.person.educationLevel,
                  contactPhone: row.person.contactPhone,
                }
              : {}),
          },
          membership: row.membership,
          sizeProfile: row.sizeProfile,
        })),
        fieldSelection: config.selection
          ? { ...config.selection, fields }
          : null,
        options: this.availableOptions(config, fields),
        latestForm: source.latestPublishedFormId
          ? await this.projectForm(
              tx,
              actor,
              this.require(await tx.form(source.latestPublishedFormId)),
            )
          : null,
      };
    });
  }
  get(actor: Principal, id: string) {
    assertPermission(
      actor.user.roleCodes,
      actor.user.mustChangePassword,
      'socialForms.read',
    );
    return this.repository.read(async (tx) =>
      this.projectForm(tx, actor, this.require(await tx.form(id))),
    );
  }
  list(actor: Principal, familyId: string, query: SocialFormListQuery) {
    assertPermission(
      actor.user.roleCodes,
      actor.user.mustChangePassword,
      'socialForms.read',
    );
    return this.repository.read(async (tx) => {
      this.enabled(await tx.configuration());
      return this.require(await tx.forms(familyId, query));
    });
  }
  publish(
    context: CommandContext,
    familyId: string,
    input: SocialFormPublication,
  ) {
    return this.command<StoredSocialForm>(
      context,
      'SocialForm',
      'socialForms.publish',
      { familyId, ...input },
      'socialForms.write',
      async (tx, actor, operationId) => {
        if (
          !Number.isFinite(Date.parse(input.occurredAt)) ||
          Date.parse(input.occurredAt) > Date.parse(this.now())
        )
          throw new SocialFormRuleError('FUTURE_FACT');
        const source = this.require(
          await tx.context(familyId, input.occurredAt),
        );
        if (source.family.revision !== input.expectedFamilyRevision)
          throw new SocialFormRevisionConflictError(source.family.revision);
        if (
          source.expectedPreviousVersionId !== input.expectedPreviousVersionId
        )
          throw new SocialFormConflictError('PREVIOUS_VERSION_CHANGED');
        const config = await tx.configuration();
        if (
          !config.selection ||
          config.selection.id !== input.fieldSelectionVersionId
        )
          throw new SocialFormConflictError('FIELD_SELECTION_CHANGED');
        if (
          new Set(input.memberRevisions.map((member) => member.personId))
            .size !== source.members.length ||
          input.memberRevisions.length !== source.members.length ||
          new Set(input.members.map((member) => member.personId)).size !==
            input.members.length ||
          input.members.some(
            (member) =>
              !source.members.some((row) => row.person.id === member.personId),
          )
        )
          throw new SocialFormRuleError('INVALID_MEMBERS');
        for (const member of source.members) {
          const revision = input.memberRevisions.find(
            (row) => row.personId === member.person.id,
          );
          if (!revision || revision.membershipId !== member.membership.id)
            throw new SocialFormConflictError('MEMBERSHIP_CHANGED');
          if (revision.expectedPersonRevision !== member.person.revision)
            throw new SocialFormRevisionConflictError(member.person.revision);
          if (
            revision.expectedMembershipRevision !== member.membership.revision
          )
            throw new SocialFormRevisionConflictError(
              member.membership.revision,
            );
          if (
            revision.expectedSizeRevision !== undefined &&
            (revision.expectedSizeRevision !==
              (member.sizeProfile?.revision ?? null) ||
              revision.sizeProfilePersonId !==
                (member.sizeProfile?.personId ?? null))
          )
            throw new SocialFormConflictError('SIZE_PROFILE_CHANGED');
        }
        const referenceId =
          input.referencePersonId === undefined
            ? (source.members.find((member) => member.membership.isReference)
                ?.person.id ?? null)
            : input.referencePersonId;
        if (
          referenceId &&
          !source.members.some((member) => member.person.id === referenceId)
        )
          throw new SocialFormRuleError('INVALID_REFERENCE_MEMBER');
        if (config.selection.decisionReference === familyFormTemplateCode) {
          const enabled = this.enabled(config);
          if (
            familyFormFields().some(
              (field) =>
                !enabled.includes(blockDecision(fieldBlock(field.fieldKey))),
            )
          )
            throw new SocialFormRuleError('BLOCK_DISABLED');
          validateFamilyFormSource(source, input, referenceId);
          const observations = input.blocks.situation?.observations;
          if (
            Array.isArray(observations) &&
            observations.some(
              (row) =>
                'occurredOn' in row && row.occurredOn > this.now().slice(0, 10),
            )
          )
            throw new SocialFormRuleError('FUTURE_FACT');
        }
        if (input.correctionOfFormId) {
          const correction = this.require(
            await tx.form(input.correctionOfFormId),
          );
          if (
            !source.familyIds.includes(correction.familyId) ||
            !input.reason?.trim()
          )
            throw new SocialFormRuleError('INVALID_CORRECTION');
        }
        const normalized = validateSocialValues({
          fields: config.selection.fields,
          enabledCodes: this.enabled(config),
          roles: actor.user.roleCodes,
          blocks: input.blocks,
          options: config.options,
          members: source.members.map((row) => {
            const submitted = input.members.find(
              (member) => member.personId === row.person.id,
            );
            const { personId, selectedFieldKeys, ...blocks } = submitted ?? {
              personId: row.person.id,
            };
            return {
              personId,
              isReference: row.membership.isReference,
              selectedFieldKeys: selectedFieldKeys ?? [],
              blocks,
            };
          }),
        });
        const formId = this.newId();
        const version = source.previousVersion + 1;
        const members: FormMember[] = source.members.map((row) => {
          const data = normalized.members.find(
            (member) => member.personId === row.person.id,
          )!;
          const id = this.newId();
          const blocks = { ...data.blocks };
          const protectedBlocks: NonNullable<FormMember['protectedBlocks']> =
            {};
          for (const block of ['health', 'medications', 'religion'] as const)
            if (blocks[block] !== undefined) {
              protectedBlocks[block] = this.protection.seal(
                { formId, version, memberId: id, block },
                blocks[block]!,
              );
              delete blocks[block];
            }
          const revision = input.memberRevisions.find(
            (member) => member.personId === row.person.id,
          )!;
          const size =
            revision.expectedSizeRevision === undefined
              ? null
              : row.sizeProfile;
          const {
            id: personId,
            name,
            birthDate,
            sex,
            revision: personRevision,
          } = row.person;
          return {
            id,
            socialFormId: formId,
            personId: row.person.id,
            membershipId: row.membership.id,
            membershipRevision: row.membership.revision,
            personSnapshot: {
              id: personId,
              name,
              birthDate,
              sex,
              revision: personRevision,
              ...(config.selection?.decisionReference === familyFormTemplateCode
                ? {
                    cpf: row.person.cpf,
                    rg: row.person.rg,
                    occupation: row.person.occupation,
                    educationLevel: row.person.educationLevel,
                    contactPhone: row.person.contactPhone,
                  }
                : {}),
            },
            relationshipSnapshot: {
              isReference: row.membership.isReference,
              relationshipToReference: row.membership.relationshipToReference,
            },
            sizeProfilePersonId: size?.personId ?? null,
            sizeRevision: size?.revision ?? null,
            sizeSnapshot: size,
            blocks,
            protectedBlocks,
            selectedFieldKeys: data.selectedFieldKeys,
          };
        });
        const form: StoredSocialForm = {
          id: formId,
          familyId: source.family.id,
          version,
          previousVersionId: input.expectedPreviousVersionId,
          correctionOfFormId: input.correctionOfFormId ?? null,
          referenceMemberId:
            members.find((member) => member.personId === referenceId)?.id ??
            null,
          occurredAt: new Date(input.occurredAt).toISOString(),
          recordedAt: this.now(),
          recordedBy: actor.user.id,
          familySnapshot: { ...source.family },
          fieldSelectionVersionId: config.selection.id,
          originFamilyId: null,
          originalVersion: null,
          reason: input.reason ?? null,
          blocks: normalized.blocks,
          members,
          acknowledgement: null,
        };
        await tx.createForm(form);
        if (input.acknowledgement) {
          if (
            !members.some(
              (member) =>
                member.personId === input.acknowledgement!.referencePersonId,
            ) ||
            Date.parse(input.acknowledgement.acknowledgedOn) >
              Date.parse(this.now())
          )
            throw new SocialFormRuleError('INVALID_ACKNOWLEDGEMENT');
          form.acknowledgement = {
            id: this.newId(),
            socialFormId: form.id,
            ...input.acknowledgement,
            recordedAt: form.recordedAt,
            recordedBy: actor.user.id,
            revision: 1,
          };
          await tx.saveAcknowledgement(form.acknowledgement);
          await tx.audit({
            operationId,
            actorId: actor.user.id,
            entityType: 'Acknowledgement',
            before: null,
            after: form.acknowledgement,
            action: 'CREATE',
            occurredAt: `${input.acknowledgement.acknowledgedOn}T00:00:00Z`,
          });
        }
        await tx.audit({
          operationId,
          actorId: actor.user.id,
          entityType: 'SocialForm',
          before: null,
          after: form,
          action: input.correctionOfFormId ? 'CORRECT' : 'CREATE',
          reason: input.reason,
          occurredAt: input.occurredAt,
        });
        return form;
      },
      (tx, actor, form) => this.projectForm(tx, actor, form),
    );
  }
  configureSelection(
    context: CommandContext,
    input: {
      expectedRevision: number | null;
      fields: FieldDefinition[];
      decisionReference: string;
      reason: string;
    },
  ) {
    return this.command<FieldSelection>(
      context,
      'FieldSelectionVersion',
      'socialForms.fields.publish',
      input,
      'featureDecisions.manage',
      async (tx, actor, operationId) => {
        const current = (await tx.configuration()).selection;
        if (
          current?.decisionReference === familyFormTemplateCode ||
          input.decisionReference === familyFormTemplateCode ||
          input.fields.some(
            (field) => field.decisionReference === familyFormTemplateCode,
          )
        )
          throw new SocialFormRuleError('INVALID_FIELD_SELECTION');
        if ((current?.version ?? null) !== input.expectedRevision)
          throw new SocialFormRevisionConflictError(current?.version ?? null);
        validateFieldSelection(input.fields);
        const after: FieldSelection = {
          id: this.newId(),
          version: (current?.version ?? 0) + 1,
          recordedAt: this.now(),
          recordedBy: actor.user.id,
          fields: input.fields,
          decisionReference: input.decisionReference,
        };
        await tx.saveSelection(after);
        await tx.audit({
          operationId,
          actorId: actor.user.id,
          entityType: 'FieldSelectionVersion',
          before: null,
          after,
          action: 'CREATE',
          reason: input.reason,
        });
        return after;
      },
    );
  }
  prepareTemplate(context: CommandContext) {
    return this.command<FieldSelection>(
      context,
      'FieldSelectionVersion',
      'socialForms.template.prepare',
      { template: familyFormTemplateCode },
      'socialForms.write',
      async (tx, actor, operationId) => {
        const config = await tx.configuration();
        const fields = familyFormFields();
        const codes = [
          ...new Set(
            fields.map((field) => blockDecision(fieldBlock(field.fieldKey))),
          ),
        ];
        if (
          !this.protection.available() ||
          ((this.mode === 'REAL' ||
            config.selection?.decisionReference === familyFormTemplateCode) &&
            codes.some((code) => !this.enabled(config).includes(code)))
        )
          throw new SocialFormRuleError('DECISION_DEPENDENCY');
        if (config.selection?.decisionReference === familyFormTemplateCode)
          return config.selection;
        const selection: FieldSelection = {
          id: this.newId(),
          version: (config.selection?.version ?? 0) + 1,
          recordedAt: this.now(),
          recordedBy: actor.user.id,
          fields,
          decisionReference: familyFormTemplateCode,
        };
        await tx.saveSelection(selection);
        await tx.audit({
          operationId,
          actorId: actor.user.id,
          entityType: 'FieldSelectionVersion',
          before: null,
          after: selection,
          action: 'CREATE',
          reason: 'Adoção do formulário fixo de cadastro de famílias de 2025',
        });
        for (const option of initialSocialOptions) {
          const before = config.options.find(
            (current) =>
              current.fieldKey === option.fieldKey &&
              current.code === option.code,
          );
          if (
            before?.active &&
            before.label === option.label &&
            before.isOther === option.isOther
          )
            continue;
          const after: SocialOption = {
            ...option,
            id: before?.id ?? this.newId(),
            revision: (before?.revision ?? 0) + 1,
          };
          await tx.saveOption(after);
          await tx.audit({
            operationId,
            actorId: actor.user.id,
            entityType: 'SocialFormOption',
            before: before ?? null,
            after,
            action: before ? 'UPDATE' : 'CREATE',
            reason: 'Opções do formulário fixo de 2025',
          });
        }
        if (this.mode === 'SYNTHETIC')
          for (const code of codes) {
            const before = config.decisions.find(
              (decision) => decision.code === code,
            );
            const after: FeatureDecision = {
              id: before?.id ?? this.newId(),
              code,
              enabled: true,
              revision: (before?.revision ?? 0) + 1,
              decidedAt: this.now(),
              decidedBy: actor.user.id,
              decisionReference: 'SYNTHETIC-FAMILY-REGISTRATION-2025',
            };
            await tx.saveDecision(after);
            await tx.audit({
              operationId,
              actorId: actor.user.id,
              entityType: 'FeatureDecision',
              before: before ?? null,
              after,
              action: before ? 'UPDATE' : 'CREATE',
              reason: 'Formulário fixo para dados sintéticos',
            });
          }
        return selection;
      },
    );
  }
  private enabled(configuration: SocialConfiguration): FeatureDecisionCode[] {
    if (
      this.mode === 'REAL' &&
      !configuration.decisions.some(
        (decision) =>
          decision.code === 'REAL_PERSONAL_DATA' &&
          decision.enabled &&
          !!decision.decisionReference.trim(),
      )
    )
      throw new FeatureNotEnabledError();
    return configuration.decisions
      .filter(
        (decision) => decision.enabled && !!decision.decisionReference.trim(),
      )
      .map((decision) => decision.code);
  }
  private availableOptions(
    config: SocialConfiguration,
    fields: FieldDefinition[],
  ) {
    return config.options.filter(
      (option) =>
        fields.some((field) => field.fieldKey === option.fieldKey) &&
        (config.selection?.decisionReference !== familyFormTemplateCode ||
          initialSocialOptions.some(
            (candidate) =>
              candidate.fieldKey === option.fieldKey &&
              candidate.code === option.code,
          )),
    );
  }
  configuration(actor: Principal) {
    assertPermission(
      actor.user.roleCodes,
      actor.user.mustChangePassword,
      'featureDecisions.manage',
    );
    // Configuration metadata must include disabled fields so replacement preserves the full selection.
    return this.repository.read((tx) => tx.configuration());
  }
  fields(actor: Principal) {
    assertPermission(
      actor.user.roleCodes,
      actor.user.mustChangePassword,
      'socialForms.read',
    );
    return this.repository.read(async (tx) => {
      const config = await tx.configuration();
      const enabled = this.enabled(config);
      const fields =
        config.selection?.fields.filter((field) =>
          allowsField(field, actor.user.roleCodes, enabled),
        ) ?? [];
      return {
        selection: config.selection ? { ...config.selection, fields } : null,
        options: this.availableOptions(config, fields),
        decisions: capabilitiesFor(actor.user.roleCodes).includes(
          'featureDecisions.manage',
        )
          ? config.decisions
          : [],
      };
    });
  }
  configureDecision(
    context: CommandContext,
    code: FeatureDecisionCode,
    input: {
      expectedRevision: number | null;
      enabled: boolean;
      decisionReference: string;
      reason: string;
    },
  ) {
    return this.command<FeatureDecision>(
      context,
      'FeatureDecision',
      'socialForms.decisions.configure',
      { code, ...input },
      'featureDecisions.manage',
      async (tx, actor, operationId) => {
        const config = await tx.configuration();
        const before =
          config.decisions.find((decision) => decision.code === code) ?? null;
        if ((before?.revision ?? null) !== input.expectedRevision)
          throw new SocialFormRevisionConflictError(before?.revision ?? null);
        if (input.enabled && code !== 'REAL_PERSONAL_DATA') {
          if (
            (this.mode === 'REAL' &&
              !this.enabled(config).includes('REAL_PERSONAL_DATA')) ||
            !config.selection?.fields.some(
              (field) =>
                field.included &&
                blockDecision(fieldBlock(field.fieldKey)) === code,
            ) ||
            (['FIC_HEALTH', 'FIC_MEDICATION', 'FIC_RELIGION'].includes(code) &&
              !this.protection.available())
          )
            throw new SocialFormRuleError('DECISION_DEPENDENCY');
        }
        if (
          before?.enabled === input.enabled &&
          before.decisionReference === input.decisionReference
        )
          return before;
        const after: FeatureDecision = {
          id: before?.id ?? this.newId(),
          code,
          enabled: input.enabled,
          decisionReference: input.decisionReference,
          revision: (before?.revision ?? 0) + 1,
          decidedAt: this.now(),
          decidedBy: actor.user.id,
        };
        await tx.saveDecision(after);
        await tx.audit({
          operationId,
          actorId: actor.user.id,
          entityType: 'FeatureDecision',
          before,
          after,
          action: before ? 'UPDATE' : 'CREATE',
          reason: input.reason,
        });
        return after;
      },
    );
  }
  createOption(
    context: CommandContext,
    input: {
      fieldKey: SocialFieldKey;
      code: string;
      label: string;
      active: boolean;
      isOther: boolean;
      decisionReference: string;
    },
  ) {
    return this.command<SocialOption>(
      context,
      'SocialFormOption',
      'socialForms.options.create',
      input,
      'featureDecisions.manage',
      async (tx, actor, operationId) => {
        if (!catalogFields.has(input.fieldKey))
          throw new SocialFormRuleError('INVALID_OPTION');
        const config = await tx.configuration();
        if (config.selection?.decisionReference === familyFormTemplateCode)
          throw new SocialFormRuleError('INVALID_OPTION');
        if (
          config.options.some(
            (option) =>
              option.fieldKey === input.fieldKey && option.code === input.code,
          )
        )
          throw new SocialFormRuleError('OPTION_CODE_EXISTS');
        const after: SocialOption = {
          id: this.newId(),
          fieldKey: input.fieldKey,
          code: input.code,
          label: input.label,
          active: input.active,
          isOther: input.isOther,
          revision: 1,
        };
        await tx.saveOption(after);
        await tx.audit({
          operationId,
          actorId: actor.user.id,
          entityType: 'SocialFormOption',
          before: null,
          after,
          action: 'CREATE',
          reason: input.decisionReference,
        });
        return after;
      },
    );
  }
  updateOption(
    context: CommandContext,
    id: string,
    input: {
      expectedRevision: number;
      label?: string;
      active?: boolean;
      decisionReference: string;
      reason: string;
    },
  ) {
    return this.command<SocialOption>(
      context,
      'SocialFormOption',
      'socialForms.options.update',
      { id, ...input },
      'featureDecisions.manage',
      async (tx, actor, operationId) => {
        const config = await tx.configuration();
        if (config.selection?.decisionReference === familyFormTemplateCode)
          throw new SocialFormRuleError('INVALID_OPTION');
        const before = this.require(
          config.options.find((option) => option.id === id) ?? null,
        );
        if (before.revision !== input.expectedRevision)
          throw new SocialFormRevisionConflictError(before.revision);
        if (
          (input.label === undefined || input.label === before.label) &&
          (input.active === undefined || input.active === before.active)
        )
          return before;
        const after = {
          ...before,
          label: input.label ?? before.label,
          active: input.active ?? before.active,
          revision: before.revision + 1,
        };
        await tx.saveOption(after);
        await tx.audit({
          operationId,
          actorId: actor.user.id,
          entityType: 'SocialFormOption',
          before,
          after,
          action: 'UPDATE',
          reason: `${input.reason} (${input.decisionReference})`,
        });
        return after;
      },
    );
  }
  acknowledge(
    context: CommandContext,
    id: string,
    input: {
      expectedRevision: number | null;
      referencePersonId: string;
      method: 'PAPER_SIGNATURE';
      acknowledgedOn: string;
      reason?: string;
    },
  ) {
    return this.command<Acknowledgement>(
      context,
      'Acknowledgement',
      'socialForms.acknowledgements.record',
      { id, ...input },
      'socialForms.write',
      async (tx, actor, operationId) => {
        const form = this.require(await tx.form(id));
        const before = form.acknowledgement;
        if ((before?.revision ?? null) !== input.expectedRevision)
          throw new SocialFormRevisionConflictError(before?.revision ?? null);
        if (
          !form.members.some(
            (member) => member.personId === input.referencePersonId,
          ) ||
          !Number.isFinite(Date.parse(input.acknowledgedOn)) ||
          Date.parse(input.acknowledgedOn) > Date.parse(this.now())
        )
          throw new SocialFormRuleError('INVALID_ACKNOWLEDGEMENT');
        if (
          before?.acknowledgedOn === input.acknowledgedOn &&
          before.method === input.method &&
          before.referencePersonId === input.referencePersonId
        )
          return before;
        if (before && !input.reason?.trim())
          throw new SocialFormRuleError('INVALID_ACKNOWLEDGEMENT');
        const after: Acknowledgement = {
          id: before?.id ?? this.newId(),
          socialFormId: id,
          referencePersonId: input.referencePersonId,
          method: input.method,
          acknowledgedOn: input.acknowledgedOn,
          recordedAt: this.now(),
          recordedBy: actor.user.id,
          revision: (before?.revision ?? 0) + 1,
        };
        await tx.saveAcknowledgement(after);
        await tx.audit({
          operationId,
          actorId: actor.user.id,
          entityType: 'Acknowledgement',
          before,
          after,
          action: before ? 'CORRECT' : 'CREATE',
          reason: input.reason,
        });
        return after;
      },
    );
  }
  async projectAudit(
    actor: Principal,
    entry: AuditEntry,
  ): Promise<AuditEntry | null> {
    if (entry.classification === 'FEATURE_DECISIONS') {
      assertPermission(
        actor.user.roleCodes,
        actor.user.mustChangePassword,
        'featureDecisions.manage',
      );
      return entry;
    }
    if (entry.classification !== 'SOCIAL_FORMS') return entry;
    assertPermission(
      actor.user.roleCodes,
      actor.user.mustChangePassword,
      'socialForms.read',
    );
    if (entry.entityType !== 'SocialForm') return entry;
    return this.repository.read(async (tx) => {
      const after = await this.projectForm(
        tx,
        actor,
        entry.after as StoredSocialForm,
      );
      const hasVisibleValues =
        Object.values(after.blocks).some(
          (block) => block && Object.keys(block).length,
        ) ||
        after.members.some((member) => Object.keys(member.blocks).length > 0);
      if (!hasVisibleValues) return null;
      const before = entry.before
        ? await this.projectForm(tx, actor, entry.before as StoredSocialForm)
        : null;
      return {
        ...entry,
        before,
        after,
        reason: after.reason === null ? null : entry.reason,
      };
    });
  }
}
