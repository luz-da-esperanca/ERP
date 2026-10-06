import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
import {
  configureSocialFields,
  createSocialFamily,
  previewSocialForm,
  socialPublicationInput,
} from '../../../support/social-forms-fixture.js';

describe('Social form PostgreSQL integrity', () => {
  const fixture = setupIntegrationFixture();
  it('publishes once for the same base and preserves immutable rows', async () => {
    const operator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    await configureSocialFields(fixture, operator.cookie);
    const { family } = await createSocialFamily(fixture, operator.cookie);
    const context = await previewSocialForm(
      fixture,
      operator.cookie,
      family.id,
    );
    const payload = socialPublicationInput(context);
    const url = `/api/v1/families/${family.id}/social-forms`;
    const responses = await Promise.all(
      [1, 2].map(() =>
        fixture.runtime.app.inject({
          method: 'POST',
          url,
          headers: fixture.headers(operator.cookie),
          payload,
        }),
      ),
    );
    expect(responses.map((response) => response.statusCode).sort()).toEqual([
      201, 409,
    ]);
    const form = responses
      .find((response) => response.statusCode === 201)!
      .json().data;
    await expect(
      fixture.runtime.database.socialForm.update({
        where: { id: form.id },
        data: { occurredAt: new Date('2026-09-01') },
      }),
    ).rejects.toThrow();
    await expect(
      fixture.runtime.database
        .$executeRaw`INSERT INTO "SocialForm" (id, "familyId", version, "previousVersionId", "correctionOfFormId", "occurredAt", "recordedAt", "recordedBy", "fieldSelectionVersionId", "familySnapshot", blocks, reason) SELECT ${randomUUID()}::uuid, "familyId", 2, id, id, "occurredAt", "recordedAt", "recordedBy", "fieldSelectionVersionId", "familySnapshot", blocks, NULL FROM "SocialForm" WHERE id = ${form.id}::uuid`,
    ).rejects.toThrow();
    const listed = await fixture.runtime.app.inject({
      method: 'GET',
      url,
      headers: fixture.headers(operator.cookie),
    });
    expect(listed.json().pagination.total).toBe(1);
  });
  it('rolls back all members and the operation when audit fails, permitting the same retry', async () => {
    const operator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    await configureSocialFields(fixture, operator.cookie);
    const { family } = await createSocialFamily(fixture, operator.cookie);
    const payload = socialPublicationInput(
      await previewSocialForm(fixture, operator.cookie, family.id),
    );
    const url = `/api/v1/families/${family.id}/social-forms`;
    const headers = fixture.headers(operator.cookie);
    const db = fixture.runtime.database;
    await db.$executeRawUnsafe(
      `CREATE FUNCTION fail_social_form_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."entityType" = 'SocialForm' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$`,
    );
    await db.$executeRawUnsafe(
      'CREATE TRIGGER fail_social_form_audit BEFORE INSERT ON "AuditEntry" FOR EACH ROW EXECUTE FUNCTION fail_social_form_audit()',
    );
    try {
      const failed = await fixture.runtime.app.inject({
        method: 'POST',
        url,
        headers,
        payload,
      });
      expect(failed.statusCode, failed.body).toBe(500);
      expect(
        (
          await fixture.runtime.app.inject({ method: 'GET', url, headers })
        ).json().pagination.total,
      ).toBe(0);
    } finally {
      await db.$executeRawUnsafe(
        'DROP TRIGGER fail_social_form_audit ON "AuditEntry"',
      );
      await db.$executeRawUnsafe('DROP FUNCTION fail_social_form_audit()');
    }
    expect(
      (
        await fixture.runtime.app.inject({
          method: 'POST',
          url,
          headers,
          payload,
        })
      ).statusCode,
    ).toBe(201);
    const repeated = await fixture.runtime.app.inject({
      method: 'POST',
      url,
      headers,
      payload,
    });
    expect(repeated.statusCode, repeated.body).toBe(201);
    expect(
      (await fixture.runtime.app.inject({ method: 'GET', url, headers })).json()
        .pagination.total,
    ).toBe(1);
  });
});
