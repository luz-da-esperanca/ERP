import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
const fixture = setupIntegrationFixture();
describe('Account audit persistence and authorization', () => {
  it('rechecks changed roles on the next request and denies account audit by list or ID', async () => {
    const { operator, runtime, headers, adminCookie } = fixture;
    const user = await operator('synthetic.combined', [
      'ADMINISTRATOR',
      'SOCIAL_ASSISTANCE',
    ]);
    expect(user.response.json().data.capabilities).toContain(
      'registration.read',
    );
    await runtime.app.inject({
      method: 'PATCH',
      url: `/api/v1/users/${user.user.id}`,
      headers: headers(adminCookie),
      payload: {
        expectedRevision: user.user.revision,
        roleCodes: ['SOCIAL_ASSISTANCE'],
      },
    });
    expect(
      (
        await runtime.app.inject({
          method: 'GET',
          url: '/api/v1/users',
          headers: { cookie: user.cookie },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await runtime.app.inject({
          method: 'GET',
          url: '/api/v1/audit-entries?entityType=UserAccount',
          headers: { cookie: user.cookie },
        })
      ).statusCode,
    ).toBe(403);
    const entry = await runtime.database.auditEntry.findFirstOrThrow();
    expect(
      (
        await runtime.app.inject({
          method: 'GET',
          url: `/api/v1/audit-entries/${entry.id}`,
          headers: { cookie: user.cookie },
        })
      ).statusCode,
    ).toBe(404);
  });
  it('rolls back the business write and operation key when the database rejects audit', async () => {
    const { runtime, admin, headers, adminCookie } = fixture;
    await runtime.database.$executeRawUnsafe(
      'ALTER TABLE "AuditEntry" ADD CONSTRAINT test_reject_update CHECK (action <> \'UPDATE\')',
    );
    const key = randomUUID();
    const before = await runtime.database.operationRecord.count();
    const request = {
      method: 'PATCH' as const,
      url: `/api/v1/users/${admin.id}`,
      headers: headers(adminCookie, key),
      payload: {
        expectedRevision: admin.revision,
        displayName: 'Synthetic Rollback',
      },
    };
    try {
      expect((await runtime.app.inject(request)).statusCode).toBe(500);
      expect((await runtime.accounts.findById(admin.id))?.user).toEqual(admin);
      expect(await runtime.database.operationRecord.count()).toBe(before);
    } finally {
      await runtime.database.$executeRawUnsafe(
        'ALTER TABLE "AuditEntry" DROP CONSTRAINT test_reject_update',
      );
    }
    expect((await runtime.app.inject(request)).statusCode).toBe(200);
  });
  it('preserves authorship, secret-free snapshots, immutable audit and bounded pagination', async () => {
    const { createUser, runtime, adminCookie, initialPassword, password } =
      fixture;
    await createUser('synthetic.audited');
    const audit = await runtime.app.inject({
      method: 'GET',
      url: '/api/v1/audit-entries?entityType=UserAccount&pageSize=1',
      headers: { cookie: adminCookie },
    });
    expect(audit.statusCode).toBe(200);
    expect(audit.json().pagination.total).toBe(3);
    expect(audit.json().data).toHaveLength(1);
    const entries = await runtime.database.auditEntry.findMany();
    const serialized = JSON.stringify(entries);
    for (const secret of [
      initialPassword,
      password,
      'passwordHash',
      'requestFingerprint',
      'fingerprintKeyId',
      'authVersion',
    ])
      expect(serialized).not.toContain(secret);
    expect(
      entries.find((entry) => entry.action === 'PASSWORD_CHANGE')?.after,
    ).toMatchObject({ passwordChanged: true, revision: 2 });
    expect(
      entries.find((entry) => entry.actorType === 'SYSTEM_BOOTSTRAP')?.actorId,
    ).toBeNull();
    const target = entries[0];
    if (!target) throw new Error('Expected audit');
    await expect(
      runtime.database.auditEntry.update({
        where: { id: target.id },
        data: { reason: 'Synthetic forbidden rewrite' },
      }),
    ).rejects.toThrow();
  });
});
