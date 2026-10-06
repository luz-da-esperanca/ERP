import { describe, expect, it } from 'vitest';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
import {
  configureSocialFields,
  createSocialFamily,
  previewSocialForm,
  socialPublicationInput,
} from '../../../support/social-forms-fixture.js';
import { socialFormDtoSchema } from '@erp/contracts/social-forms-api';

describe('Social form HTTP lifecycle', () => {
  const fixture = setupIntegrationFixture();
  it('keeps historical identity, zero and explicit emptiness after current registration changes', async () => {
    const operator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    await configureSocialFields(fixture, operator.cookie, [
      'housing.roomCount',
      'members[].economy.incomeAmount',
      'needs.declaredNeeds',
    ]);
    const { family, person } = await createSocialFamily(
      fixture,
      operator.cookie,
    );
    const preview = await previewSocialForm(
      fixture,
      operator.cookie,
      family.id,
    );
    const url = `/api/v1/families/${family.id}/social-forms`;
    const headers = fixture.headers(operator.cookie);
    const payload = {
      ...socialPublicationInput(preview),
      blocks: { housing: { roomCount: 0 }, needs: { declaredNeeds: [] } },
      members: [{ personId: person.id, economy: { incomeAmount: '0' } }],
    };
    const created = await fixture.runtime.app.inject({
      method: 'POST',
      url,
      headers,
      payload,
    });
    expect(created.statusCode, created.body).toBe(201);
    const form = socialFormDtoSchema.parse(created.json().data);
    expect(form.members[0]?.blocks.economy?.incomeAmount).toBe('0');
    const changed = await fixture.runtime.app.inject({
      method: 'PATCH',
      url: `/api/v1/people/${person.id}`,
      headers: fixture.headers(operator.cookie),
      payload: {
        expectedRevision: person.revision,
        name: 'Synthetic renamed member',
      },
    });
    expect(changed.statusCode, changed.body).toBe(200);
    const detail = await fixture.runtime.app.inject({
      method: 'GET',
      url: `/api/v1/social-forms/${form.id}`,
      headers,
    });
    expect(detail.json().data.members[0].personSnapshot.name).toBe(
      'Synthetic reference member',
    );
    const replay = await fixture.runtime.app.inject({
      method: 'POST',
      url,
      headers,
      payload,
    });
    expect(replay.json()).toEqual(created.json());
    const stale = await fixture.runtime.app.inject({
      method: 'POST',
      url,
      headers: fixture.headers(operator.cookie),
      payload,
    });
    expect(stale.statusCode).toBe(409);
  });
  it('denies social data and configuration to unrelated profiles and refuses disabled protected input', async () => {
    const coordinator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const manager = await fixture.operator('synthetic.manager', [
      'ACTIVITY_MANAGER',
    ]);
    const social = await fixture.operator('synthetic.social', [
      'SOCIAL_ASSISTANCE',
    ]);
    const { family, person } = await createSocialFamily(
      fixture,
      coordinator.cookie,
    );
    await configureSocialFields(fixture, coordinator.cookie);
    for (const cookie of [manager.cookie, fixture.adminCookie]) {
      const denied = await fixture.runtime.app.inject({
        method: 'GET',
        url: `/api/v1/families/${family.id}/social-forms`,
        headers: fixture.headers(cookie),
      });
      expect(denied.statusCode).toBe(403);
    }
    for (const cookie of [manager.cookie, social.cookie, fixture.adminCookie]) {
      const restricted = await fixture.runtime.app.inject({
        method: 'GET',
        url: '/api/v1/social-form-configuration',
        headers: fixture.headers(cookie),
      });
      expect(restricted.statusCode).toBe(403);
    }
    const configuration = await fixture.runtime.app.inject({
      method: 'GET',
      url: '/api/v1/social-form-configuration',
      headers: fixture.headers(coordinator.cookie),
    });
    expect(configuration.statusCode, configuration.body).toBe(200);
    expect(configuration.json().data.selection.fields.length).toBeGreaterThan(
      0,
    );
    const denied = await fixture.runtime.app.inject({
      method: 'POST',
      url: '/api/v1/feature-decisions/FIC_HEALTH',
      headers: fixture.headers(social.cookie),
      payload: {
        enabled: true,
        expectedRevision: null,
        decisionReference: 'SYNTHETIC-TEST',
        reason: 'Synthetic request',
      },
    });
    expect(denied.statusCode).toBe(403);
    const preview = await previewSocialForm(
      fixture,
      coordinator.cookie,
      family.id,
    );
    const disabled = await fixture.runtime.app.inject({
      method: 'POST',
      url: `/api/v1/families/${family.id}/social-forms`,
      headers: fixture.headers(social.cookie),
      payload: {
        ...socialPublicationInput(preview),
        members: [{ personId: person.id, health: { physicalHealth: 'GOOD' } }],
      },
    });
    expect(disabled.statusCode, disabled.body).toBe(422);
    expect(disabled.json().error.details.rule).toBe('BLOCK_DISABLED');
  });
  it('rejects a size profile introduced after preview and preserves the publication sequence for a backdated correction', async () => {
    const operator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    await configureSocialFields(fixture, operator.cookie);
    const { family, person } = await createSocialFamily(
      fixture,
      operator.cookie,
    );
    const preview = await previewSocialForm(
      fixture,
      operator.cookie,
      family.id,
    );
    const size = await fixture.runtime.app.inject({
      method: 'PUT',
      url: `/api/v1/people/${person.id}/sizes`,
      headers: fixture.headers(operator.cookie),
      payload: {
        expectedRevision: null,
        shoeSize: '39',
        clothingSize: null,
        informedOn: '2026-10-01',
      },
    });
    expect(size.statusCode, size.body).toBe(200);
    const url = `/api/v1/families/${family.id}/social-forms`;
    const stale = await fixture.runtime.app.inject({
      method: 'POST',
      url,
      headers: fixture.headers(operator.cookie),
      payload: socialPublicationInput(preview),
    });
    expect(stale.statusCode, stale.body).toBe(409);
    const base = await previewSocialForm(fixture, operator.cookie, family.id);
    const created = await fixture.runtime.app.inject({
      method: 'POST',
      url,
      headers: fixture.headers(operator.cookie),
      payload: socialPublicationInput(base),
    });
    expect(created.statusCode, created.body).toBe(201);
    const next = await previewSocialForm(
      fixture,
      operator.cookie,
      family.id,
      '2026-09-01T12:00:00Z',
    );
    const corrected = await fixture.runtime.app.inject({
      method: 'POST',
      url,
      headers: fixture.headers(operator.cookie),
      payload: {
        ...socialPublicationInput(next),
        correctionOfFormId: created.json().data.id,
        reason: 'Synthetic historical correction',
      },
    });
    expect(corrected.statusCode, corrected.body).toBe(201);
    expect(corrected.json().data).toMatchObject({
      version: 2,
      previousVersionId: created.json().data.id,
    });
    const listed = await fixture.runtime.app.inject({
      method: 'GET',
      url,
      headers: fixture.headers(operator.cookie),
    });
    expect(
      listed.json().data.map((form: { version: number }) => form.version),
    ).toEqual([2, 1]);
  });
});
