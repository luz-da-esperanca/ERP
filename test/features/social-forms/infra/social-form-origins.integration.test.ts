import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
import {
  configureSocialFields,
  createSocialFamily,
  previewSocialForm,
  socialPublicationInput,
} from '../../../support/social-forms-fixture.js';
import { familyDtoSchema } from '@erp/contracts/registration-api';

describe('Social form original namespaces', () => {
  const fixture = setupIntegrationFixture();
  it('consolidates aliased origins without renumbering and publishes only in the canonical namespace', async () => {
    const operator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const selection = await configureSocialFields(fixture, operator.cookie);
    const { family: origin } = await createSocialFamily(
      fixture,
      operator.cookie,
    );
    const targetResponse = await fixture.runtime.app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: fixture.headers(operator.cookie),
      payload: { address: 'Synthetic canonical address' },
    });
    expect(targetResponse.statusCode, targetResponse.body).toBe(201);
    const target = familyDtoSchema.parse(targetResponse.json().data);
    const db = fixture.runtime.database;
    const firstId = randomUUID();
    const secondId = randomUUID();
    const canonicalId = randomUUID();
    const base = {
      fieldSelectionVersionId: selection.id as string,
      recordedBy: operator.user.id,
      recordedAt: new Date('2026-10-01T12:00:00Z'),
      occurredAt: new Date('2026-10-01T12:00:00Z'),
      blocks: {},
    };
    // Synthetic fixtures model the output of a future reconciled merge; this test does not implement that command.
    await db.socialForm.create({
      data: {
        ...base,
        id: firstId,
        familyId: origin.id,
        version: 1,
        familySnapshot: { ...origin },
      },
    });
    await db.socialForm.create({
      data: {
        ...base,
        id: secondId,
        familyId: origin.id,
        version: 2,
        previousVersionId: firstId,
        familySnapshot: { ...origin },
      },
    });
    await db.socialForm.create({
      data: {
        ...base,
        id: canonicalId,
        familyId: target.id,
        version: 1,
        familySnapshot: { ...target },
      },
    });
    await db.family.update({
      where: { id: origin.id },
      data: { mergedIntoId: target.id },
    });
    const listed = await fixture.runtime.app.inject({
      method: 'GET',
      url: `/api/v1/families/${target.id}/social-forms`,
      headers: fixture.headers(operator.cookie),
    });
    expect(listed.statusCode, listed.body).toBe(200);
    const ids = listed.json().data.map((form: { id: string }) => form.id);
    expect(ids).toEqual(
      origin.id.localeCompare(target.id) < 0
        ? [secondId, firstId, canonicalId]
        : [canonicalId, secondId, firstId],
    );
    const originals = listed
      .json()
      .data.filter((form: { familyId: string }) => form.familyId === origin.id);
    expect(
      originals.map(
        (form: { originFamilyId: string; originalVersion: number }) => [
          form.originFamilyId,
          form.originalVersion,
        ],
      ),
    ).toEqual([
      [origin.id, 2],
      [origin.id, 1],
    ]);
    const context = await previewSocialForm(
      fixture,
      operator.cookie,
      origin.id,
    );
    expect(context.family.id).toBe(target.id);
    expect(context.expectedPreviousVersionId).toBe(canonicalId);
    expect(context.latestPublishedFormId).toBe(ids[0]);
    const created = await fixture.runtime.app.inject({
      method: 'POST',
      url: `/api/v1/families/${origin.id}/social-forms`,
      headers: fixture.headers(operator.cookie),
      payload: {
        ...socialPublicationInput(context),
        correctionOfFormId: firstId,
        reason: 'Synthetic correction from original namespace',
      },
    });
    expect(created.statusCode, created.body).toBe(201);
    expect(created.json().data).toMatchObject({
      familyId: target.id,
      version: 2,
      previousVersionId: canonicalId,
      correctionOfFormId: firstId,
    });
    expect(
      (await db.socialForm.findUniqueOrThrow({ where: { id: firstId } }))
        .familyId,
    ).toBe(origin.id);
  });
});
