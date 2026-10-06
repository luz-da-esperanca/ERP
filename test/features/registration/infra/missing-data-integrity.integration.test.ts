import { describe, expect, it, vi } from 'vitest';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
import { missingDataSelectionLock } from '../../../../src/features/registration/infra/prisma-missing-data.js';

const fixture = setupIntegrationFixture();
const selectionInput = {
  expectedVersion: null,
  personFields: [],
  familyFields: ['contactPhone'],
  decisionReference: 'Synthetic demo selection',
};

describe('Missing data transaction integrity', () => {
  it('rolls back selection, occurrences and operation on audit failure, and allows the same retry', async () => {
    const actor = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const app = fixture.runtime.app;
    const db = fixture.runtime.database;
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/families',
          headers: fixture.headers(actor.cookie),
          payload: {},
        })
      ).statusCode,
    ).toBe(201);
    const headers = fixture.headers(actor.cookie);
    await db.$executeRawUnsafe(
      `CREATE FUNCTION fail_missing_data_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."entityType" = 'DataQualityIssue' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$`,
    );
    await db.$executeRawUnsafe(
      'CREATE TRIGGER fail_missing_data_audit BEFORE INSERT ON "AuditEntry" FOR EACH ROW EXECUTE FUNCTION fail_missing_data_audit()',
    );
    try {
      const failed = await app.inject({
        method: 'POST',
        url: '/api/v1/registration-field-selections',
        headers,
        payload: selectionInput,
      });
      expect(failed.statusCode, failed.body).toBe(500);
      expect(await db.registrationFieldSelection.count()).toBe(0);
      expect(
        await db.dataQualityIssue.count({ where: { kind: 'MISSING_DATA' } }),
      ).toBe(0);
      expect(
        await db.auditEntry.count({
          where: { entityType: 'RegistrationFieldSelection' },
        }),
      ).toBe(0);
      expect(
        await db.operationRecord.count({
          where: { type: 'registration.missing-data.selection' },
        }),
      ).toBe(0);
    } finally {
      await db.$executeRawUnsafe(
        'DROP TRIGGER fail_missing_data_audit ON "AuditEntry"',
      );
      await db.$executeRawUnsafe('DROP FUNCTION fail_missing_data_audit()');
    }
    const result = await app.inject({
      method: 'POST',
      url: '/api/v1/registration-field-selections',
      headers,
      payload: selectionInput,
    });
    expect(result.statusCode, result.body).toBe(201);
    const issue = await db.dataQualityIssue.findFirstOrThrow({
      where: { kind: 'MISSING_DATA' },
    });
    await expect(
      db.dataQualityIssue.create({
        data: {
          entityType: issue.entityType,
          entityId: issue.entityId,
          kind: issue.kind,
          fieldKeys: issue.fieldKeys,
          candidateIds: [],
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    await expect(
      db.registrationFieldSelection.update({
        where: { id: result.json().data.id },
        data: { familyFields: [] },
      }),
    ).rejects.toThrow('immutable');
  });

  it('rolls back a completed field and its occurrence if resolution audit cannot be written', async () => {
    const actor = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const app = fixture.runtime.app;
    const db = fixture.runtime.database;
    await app.inject({
      method: 'POST',
      url: '/api/v1/registration-field-selections',
      headers: fixture.headers(actor.cookie),
      payload: selectionInput,
    });
    const family = (
      await app.inject({
        method: 'POST',
        url: '/api/v1/families',
        headers: fixture.headers(actor.cookie),
        payload: {},
      })
    ).json().data;
    const headers = fixture.headers(actor.cookie);
    const payload = { expectedRevision: 1, contactPhone: 'Synthetic phone' };
    await db.$executeRawUnsafe(
      `CREATE FUNCTION fail_missing_data_resolution() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."entityType" = 'DataQualityIssue' AND NEW.action = 'UPDATE' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$`,
    );
    await db.$executeRawUnsafe(
      'CREATE TRIGGER fail_missing_data_resolution BEFORE INSERT ON "AuditEntry" FOR EACH ROW EXECUTE FUNCTION fail_missing_data_resolution()',
    );
    try {
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: `/api/v1/families/${family.id}`,
            headers,
            payload,
          })
        ).statusCode,
      ).toBe(500);
      expect(
        await db.family.findUnique({ where: { id: family.id } }),
      ).toMatchObject({ contactPhone: null, revision: 1 });
      expect(
        await db.dataQualityIssue.findFirst({ where: { entityId: family.id } }),
      ).toMatchObject({ resolution: null, resolvedAt: null, revision: 1 });
      expect(
        await db.operationRecord.count({
          where: { key: headers['idempotency-key'] },
        }),
      ).toBe(0);
    } finally {
      await db.$executeRawUnsafe(
        'DROP TRIGGER fail_missing_data_resolution ON "AuditEntry"',
      );
      await db.$executeRawUnsafe(
        'DROP FUNCTION fail_missing_data_resolution()',
      );
    }
    const result = await app.inject({
      method: 'PATCH',
      url: `/api/v1/families/${family.id}`,
      headers,
      payload,
    });
    expect(result.statusCode, result.body).toBe(200);
    expect(
      await db.dataQualityIssue.findFirst({ where: { entityId: family.id } }),
    ).toMatchObject({ resolution: 'COMPLETED', revision: 2 });
  });

  it.each(['configuration', 'registration'] as const)(
    'reconciles concurrent selection and registration when %s starts first',
    async (firstWriter) => {
      const coordinator = await fixture.operator('synthetic.coordinator', [
        'COORDINATION',
      ]);
      const social = await fixture.operator('synthetic.social', [
        'SOCIAL_ASSISTANCE',
      ]);
      const app = fixture.runtime.app;
      const db = fixture.runtime.database;
      const gate = 20461007;
      let signalReady = () => {};
      let releaseGate = () => {};
      const ready = new Promise<void>((resolve) => {
        signalReady = resolve;
      });
      const release = new Promise<void>((resolve) => {
        releaseGate = resolve;
      });
      const table =
        firstWriter === 'configuration'
          ? 'RegistrationFieldSelection'
          : 'Family';
      await db.$executeRawUnsafe(
        `CREATE FUNCTION pause_missing_data_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(${gate}::bigint); RETURN NEW; END $$`,
      );
      await db.$executeRawUnsafe(
        `CREATE TRIGGER pause_missing_data_write BEFORE INSERT ON "${table}" FOR EACH ROW EXECUTE FUNCTION pause_missing_data_write()`,
      );
      const blocker = db.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${gate}::bigint)`;
          signalReady();
          await release;
        },
        { timeout: 15000 },
      );
      const publish = () =>
        app.inject({
          method: 'POST',
          url: '/api/v1/registration-field-selections',
          headers: fixture.headers(coordinator.cookie),
          payload: selectionInput,
        });
      const create = () =>
        app.inject({
          method: 'POST',
          url: '/api/v1/families',
          headers: fixture.headers(social.cookie),
          payload: {},
        });
      let first: ReturnType<typeof publish> | undefined;
      let second: ReturnType<typeof create> | undefined;
      try {
        await ready;
        first = firstWriter === 'configuration' ? publish() : create();
        await vi.waitFor(
          async () =>
            expect(
              await db.$queryRaw`SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND objid = ${gate}::oid AND NOT granted`,
            ).toHaveLength(1),
          { timeout: 5000 },
        );
        second = firstWriter === 'configuration' ? create() : publish();
        await vi.waitFor(
          async () =>
            expect(
              await db.$queryRaw`SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND objid = ${missingDataSelectionLock}::oid AND NOT granted`,
            ).toHaveLength(1),
          { timeout: 5000 },
        );
        releaseGate();
        await blocker;
        const firstResult = await first;
        const secondResult = await second;
        expect(firstResult.statusCode, firstResult.body).toBe(201);
        expect(secondResult.statusCode, secondResult.body).toBe(201);
        const created =
          firstWriter === 'configuration' ? secondResult : firstResult;
        expect(
          await db.dataQualityIssue.findMany({
            where: {
              entityId: created.json().data.id,
              kind: 'MISSING_DATA',
              resolvedAt: null,
            },
          }),
        ).toEqual([expect.objectContaining({ fieldKeys: ['contactPhone'] })]);
      } finally {
        releaseGate();
        await blocker;
        await Promise.allSettled([first, second]);
        await db.$executeRawUnsafe(
          `DROP TRIGGER pause_missing_data_write ON "${table}"`,
        );
        await db.$executeRawUnsafe('DROP FUNCTION pause_missing_data_write()');
      }
    },
  );
});
