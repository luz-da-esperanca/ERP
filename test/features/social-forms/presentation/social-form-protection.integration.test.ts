import { describe, expect, it } from 'vitest';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
import {
  configureSocialFields,
  createSocialFamily,
  previewSocialForm,
  socialPublicationInput,
} from '../../../support/social-forms-fixture.js';
import {
  socialFormDtoSchema,
  socialFormFieldsSchema,
} from '@erp/contracts/social-forms-api';
import { auditPageSchema } from '@erp/contracts/audit-api';

describe('Social form protected history', () => {
  const fixture = setupIntegrationFixture();
  it('stores only envelopes and filters hidden events before audit totals and pagination', async () => {
    const operator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const selection = await configureSocialFields(fixture, operator.cookie, [
      'members[].health.physicalHealth',
    ]);
    const { family, person } = await createSocialFamily(
      fixture,
      operator.cookie,
    );
    const url = `/api/v1/families/${family.id}/social-forms`;
    const first = await fixture.runtime.app.inject({
      method: 'POST',
      url,
      headers: fixture.headers(operator.cookie),
      payload: {
        ...socialPublicationInput(
          await previewSocialForm(fixture, operator.cookie, family.id),
        ),
        blocks: {},
        members: [{ personId: person.id, health: { physicalHealth: 'GOOD' } }],
      },
    });
    expect(first.statusCode, first.body).toBe(201);
    const firstForm = socialFormDtoSchema.parse(first.json().data);
    const member = await fixture.runtime.database.formMember.findFirstOrThrow({
      where: { socialFormId: firstForm.id },
    });
    const event = await fixture.runtime.database.auditEntry.findFirstOrThrow({
      where: { entityType: 'SocialForm', entityId: firstForm.id },
    });
    for (const stored of [member.payload, event.after]) {
      expect(JSON.stringify(stored)).toContain('ciphertext');
      expect(JSON.stringify(stored)).not.toContain('GOOD');
    }
    const operation =
      await fixture.runtime.database.operationRecord.findUniqueOrThrow({
        where: { id: event.operationId },
      });
    expect(operation.fingerprintKeyId).toBe('v1');
    expect(operation.requestFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(operation.resultReference)).not.toContain('GOOD');

    const expanded = await fixture.runtime.app.inject({
      method: 'POST',
      url: '/api/v1/social-form-field-selections',
      headers: fixture.headers(operator.cookie),
      payload: {
        expectedRevision: 1,
        decisionReference: 'SYNTHETIC-TEST',
        reason: 'Synthetic expansion',
        fields: [
          ...selection.fields,
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
      },
    });
    expect(expanded.statusCode, expanded.body).toBe(201);
    const enabled = await fixture.runtime.app.inject({
      method: 'POST',
      url: '/api/v1/feature-decisions/FIC_HOUSING',
      headers: fixture.headers(operator.cookie),
      payload: {
        enabled: true,
        expectedRevision: null,
        decisionReference: 'SYNTHETIC-TEST',
        reason: 'Synthetic enablement',
      },
    });
    expect(enabled.statusCode, enabled.body).toBe(200);
    const second = await fixture.runtime.app.inject({
      method: 'POST',
      url,
      headers: fixture.headers(operator.cookie),
      payload: {
        ...socialPublicationInput(
          await previewSocialForm(fixture, operator.cookie, family.id),
        ),
        blocks: { housing: { roomCount: 0 } },
        members: [
          { personId: person.id, health: { physicalHealth: 'REGULAR' } },
        ],
        reason: 'Synthetic restricted correction context',
      },
    });
    expect(second.statusCode, second.body).toBe(201);
    const disabled = await fixture.runtime.app.inject({
      method: 'POST',
      url: '/api/v1/feature-decisions/FIC_HEALTH',
      headers: fixture.headers(operator.cookie),
      payload: {
        enabled: false,
        expectedRevision: 1,
        decisionReference: 'SYNTHETIC-TEST',
        reason: 'Synthetic suspension',
      },
    });
    expect(disabled.statusCode, disabled.body).toBe(200);
    const audit = await fixture.runtime.app.inject({
      method: 'GET',
      url: '/api/v1/audit-entries?entityType=SocialForm&pageSize=1',
      headers: fixture.headers(operator.cookie),
    });
    expect(audit.statusCode, audit.body).toBe(200);
    const page = auditPageSchema.parse(audit.json());
    expect(page.pagination.total).toBe(1);
    expect(page.data[0]?.entityId).toBe(second.json().data.id);
    expect(page.data[0]?.reason).toBeNull();
    expect(audit.body).not.toContain('ciphertext');
    expect(audit.body).not.toContain('REGULAR');
    const hidden = await fixture.runtime.app.inject({
      method: 'GET',
      url: `/api/v1/audit-entries/${event.id}`,
      headers: fixture.headers(operator.cookie),
    });
    expect(hidden.statusCode).toBe(404);
    const detail = await fixture.runtime.app.inject({
      method: 'GET',
      url: `/api/v1/social-forms/${firstForm.id}`,
      headers: fixture.headers(operator.cookie),
    });
    expect(
      socialFormDtoSchema.parse(detail.json().data).members[0]?.blocks,
    ).toEqual({});
    const fields = await fixture.runtime.app.inject({
      method: 'GET',
      url: '/api/v1/social-form-fields',
      headers: fixture.headers(operator.cookie),
    });
    expect(
      socialFormFieldsSchema
        .parse(fields.json().data)
        .selection?.fields.map((field) => field.fieldKey),
    ).toEqual(['housing.roomCount']);
  });
  it('preserves a published label after deactivation and rejects the choice in the next version', async () => {
    const operator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    await configureSocialFields(fixture, operator.cookie, [
      'housing.housingTenure',
    ]);
    const { family } = await createSocialFamily(fixture, operator.cookie);
    const url = `/api/v1/families/${family.id}/social-forms`;
    const created = await fixture.runtime.app.inject({
      method: 'POST',
      url,
      headers: fixture.headers(operator.cookie),
      payload: {
        ...socialPublicationInput(
          await previewSocialForm(fixture, operator.cookie, family.id),
        ),
        blocks: { housing: { housingTenure: [{ code: 'OWNED' }] } },
      },
    });
    expect(created.statusCode, created.body).toBe(201);
    const option =
      await fixture.runtime.database.socialFormOption.findUniqueOrThrow({
        where: {
          fieldKey_code: { fieldKey: 'housing.housingTenure', code: 'OWNED' },
        },
      });
    const changed = await fixture.runtime.app.inject({
      method: 'PATCH',
      url: `/api/v1/social-form-options/${option.id}`,
      headers: fixture.headers(operator.cookie),
      payload: {
        expectedRevision: 1,
        active: false,
        label: 'Nova descrição sintética',
        decisionReference: 'SYNTHETIC-TEST',
        reason: 'Synthetic deactivation',
      },
    });
    expect(changed.statusCode, changed.body).toBe(200);
    const old = await fixture.runtime.app.inject({
      method: 'GET',
      url: `/api/v1/social-forms/${created.json().data.id}`,
      headers: fixture.headers(operator.cookie),
    });
    expect(old.json().data.blocks.housing.housingTenure).toEqual([
      { code: 'OWNED', label: 'Própria' },
    ]);
    const refused = await fixture.runtime.app.inject({
      method: 'POST',
      url,
      headers: fixture.headers(operator.cookie),
      payload: {
        ...socialPublicationInput(
          await previewSocialForm(fixture, operator.cookie, family.id),
        ),
        blocks: { housing: { housingTenure: [{ code: 'OWNED' }] } },
      },
    });
    expect(refused.statusCode, refused.body).toBe(422);
    expect(refused.json().error.details.rule).toBe('INVALID_OPTION');
  });
});
