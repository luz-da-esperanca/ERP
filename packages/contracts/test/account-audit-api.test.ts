import { describe, expect, it } from 'vitest';
import {
  auditQuerySchema,
  accountAuditEntrySchema,
} from '../src/account-audit-api.js';

describe('Account audit HTTP contracts', () => {
  it('accepts a scoped time range and rejects reversed ranges or unknown filters', () => {
    expect(
      auditQuerySchema.parse({
        entityType: 'UserAccount',
        from: '2026-01-01T00:00:00Z',
        to: '2026-01-02T00:00:00Z',
      }),
    ).toMatchObject({ page: 1, pageSize: 20 });
    expect(
      auditQuerySchema.safeParse({
        entityType: 'UserAccount',
        from: '2026-01-02T00:00:00Z',
        to: '2026-01-01T00:00:00Z',
      }).success,
    ).toBe(false);
    expect(
      auditQuerySchema.safeParse({
        entityType: 'UserAccount',
        passwordHash: 'private',
      }).success,
    ).toBe(false);
  });

  it('projects an audit snapshot without credential fields', () => {
    const account = {
      id: '00000000-0000-4000-8000-000000000001',
      login: 'test.operator',
      displayName: 'Synthetic Operator',
      active: true,
      mustChangePassword: true,
      revision: 1,
      roleCodes: ['ADMINISTRATOR'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const entry = accountAuditEntrySchema.parse({
      id: account.id,
      operationId: account.id,
      entityType: 'UserAccount',
      entityId: account.id,
      revision: 1,
      action: 'CREATE',
      actorType: 'SYSTEM_BOOTSTRAP',
      actorId: null,
      actor: null,
      recordedAt: account.createdAt,
      occurredAt: null,
      before: null,
      after: { ...account, passwordHash: 'private', token: 'private' },
      reason: null,
      classification: 'ACCOUNTS',
    });
    expect(entry.after).toEqual(account);
  });
});
