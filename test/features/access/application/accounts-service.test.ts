import { describe, expect, it } from 'vitest';
import { createAccountsServiceFixture } from '../../../support/accounts-service-fixture.js';
import {
  AccountRevisionConflictError,
  AccountRuleError,
  PermissionDeniedError,
} from '../../../../src/features/access/domain/account-errors.js';
import { AuthenticationRequiredError } from '../../../../src/features/access/application/access-errors.js';
import { IdempotencyConflictError } from '../../../../src/core/application/errors.js';

describe('AccountsService command protection', () => {
  it('authorizes account listing before reading persistent account data', async () => {
    const { service, reader, principal, user } = createAccountsServiceFixture();
    const input = { page: 1, pageSize: 20 };
    const page = { data: [user], pagination: { ...input, total: 1 } };
    reader.list.mockResolvedValue(page);
    await expect(service.list(principal, input)).resolves.toEqual(page);
    reader.list.mockClear();
    principal.user.roleCodes = ['SOCIAL_ASSISTANCE'];
    await expect(service.list(principal, input)).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
    expect(reader.list).not.toHaveBeenCalled();
  });
  it('preserves the original revision and audit count for an unchanged profile', async () => {
    const { service, stored, operations, audit, user, context, operationId } =
      createAccountsServiceFixture();
    await expect(
      service.update(context, user.id, {
        expectedRevision: 3,
        displayName: user.displayName,
      }),
    ).resolves.toEqual(user);
    expect(stored.update).not.toHaveBeenCalled();
    expect(audit.append).not.toHaveBeenCalled();
    expect(operations.complete).toHaveBeenCalledWith(operationId, {
      entityType: 'UserAccount',
      entityId: user.id,
      revision: 3,
    });
  });

  it('rejects a stale revision before changing the account or its history', async () => {
    const { service, stored, audit, user, context } =
      createAccountsServiceFixture();
    await expect(
      service.update(context, user.id, {
        expectedRevision: 2,
        displayName: 'Updated Operator',
      }),
    ).rejects.toBeInstanceOf(AccountRevisionConflictError);
    expect(stored.update).not.toHaveBeenCalled();
    expect(audit.append).not.toHaveBeenCalled();
  });

  it.each(['deactivation', 'role removal'])(
    'protects the last administrator against %s',
    async (change) => {
      const { service, stored, user, context } = createAccountsServiceFixture();
      stored.countActiveAdministrators.mockResolvedValue(1);
      const result =
        change === 'deactivation'
          ? service.activate(context, user.id, {
              expectedRevision: 3,
              active: false,
              reason: 'Synthetic deactivation',
            })
          : service.update(context, user.id, {
              expectedRevision: 3,
              roleCodes: ['SOCIAL_ASSISTANCE'],
            });
      await expect(result).rejects.toMatchObject({
        rule: 'LAST_ACTIVE_ADMINISTRATOR',
      });
      expect(stored.update).not.toHaveBeenCalled();
    },
  );

  it('rechecks revoked authors before looking up an idempotent replay', async () => {
    const { service, stored, operations, account, user, context } =
      createAccountsServiceFixture();
    stored.findById.mockResolvedValue({
      ...account,
      authVersion: account.authVersion + 1,
    });
    await expect(
      service.update(context, user.id, {
        expectedRevision: 3,
        displayName: 'Updated Operator',
      }),
    ).rejects.toBeInstanceOf(AuthenticationRequiredError);
    expect(operations.find).not.toHaveBeenCalled();
    expect(stored.update).not.toHaveBeenCalled();
  });

  it('rechecks current role permissions inside the transaction', async () => {
    const { service, stored, operations, account, user, context } =
      createAccountsServiceFixture();
    stored.findById.mockResolvedValue({
      ...account,
      user: { ...user, roleCodes: ['SOCIAL_ASSISTANCE'] },
    });
    await expect(
      service.update(context, user.id, {
        expectedRevision: 3,
        displayName: 'Updated Operator',
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(operations.find).not.toHaveBeenCalled();
  });

  it('replays the original revision with its historical fingerprint key and no new effects', async () => {
    const {
      service,
      stored,
      operations,
      audit,
      fingerprints,
      user,
      context,
      operationId,
    } = createAccountsServiceFixture();
    operations.find.mockResolvedValue({
      id: operationId,
      actorId: context.actor.user.id,
      fingerprintKeyId: 'v1',
      requestFingerprint: 'stored-fingerprint',
      resultReference: {
        entityType: 'UserAccount',
        entityId: user.id,
        revision: 1,
      },
    });
    const original = { ...user, displayName: 'Original Operator', revision: 1 };
    audit.readRevision.mockResolvedValue(original);
    await expect(
      service.update(context, user.id, {
        expectedRevision: 1,
        displayName: 'Original Operator',
      }),
    ).resolves.toEqual(original);
    expect(fingerprints.calculate).toHaveBeenCalledWith(
      expect.anything(),
      'v1',
    );
    expect(stored.update).not.toHaveBeenCalled();
    expect(operations.create).not.toHaveBeenCalled();
    expect(audit.append).not.toHaveBeenCalled();
  });

  it('rejects an idempotency key reused with different content', async () => {
    const {
      service,
      stored,
      operations,
      fingerprints,
      user,
      context,
      operationId,
    } = createAccountsServiceFixture();
    operations.find.mockResolvedValue({
      id: operationId,
      actorId: context.actor.user.id,
      fingerprintKeyId: null,
      requestFingerprint: 'stored-fingerprint',
      resultReference: {
        entityType: 'UserAccount',
        entityId: user.id,
        revision: 1,
      },
    });
    fingerprints.matches.mockReturnValue(false);
    await expect(
      service.update(context, user.id, {
        expectedRevision: 3,
        displayName: 'Different Operator',
      }),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
    expect(stored.update).not.toHaveBeenCalled();
  });

  it('rejects a duplicate login before creating an account', async () => {
    const { service, stored, account, user, context } =
      createAccountsServiceFixture();
    stored.findByLogin.mockResolvedValue(account);
    await expect(
      service.create(
        context,
        {
          login: user.login,
          displayName: user.displayName,
          initialPassword: 'synthetic-password',
          roleCodes: user.roleCodes,
        },
        'protected-password-hash',
      ),
    ).rejects.toBeInstanceOf(AccountRuleError);
    expect(stored.create).not.toHaveBeenCalled();
  });

  it('rejects bootstrap after an account exists without changing the role catalog', async () => {
    const { service, stored, user } = createAccountsServiceFixture();
    stored.count.mockResolvedValue(1);
    await expect(
      service.bootstrap(
        {
          login: user.login,
          displayName: user.displayName,
          initialPassword: 'synthetic-password',
          roleCodes: user.roleCodes,
        },
        'protected-password-hash',
      ),
    ).rejects.toMatchObject({ rule: 'BOOTSTRAP_ALREADY_COMPLETED' });
    expect(stored.ensureRoles).not.toHaveBeenCalled();
    expect(stored.create).not.toHaveBeenCalled();
  });

  it('requires an administrator role on the initial account', async () => {
    const { service, stored, user } = createAccountsServiceFixture();
    await expect(
      service.bootstrap(
        {
          login: user.login,
          displayName: user.displayName,
          initialPassword: 'synthetic-password',
          roleCodes: ['SOCIAL_ASSISTANCE'],
        },
        'protected-password-hash',
      ),
    ).rejects.toMatchObject({ rule: 'BOOTSTRAP_REQUIRES_ADMINISTRATOR' });
    expect(stored.create).not.toHaveBeenCalled();
  });
});

describe('AccountsService profile changes', () => {
  it('updates a profile with a new revision and its safe audit record', async () => {
    const { service, stored, audit, user, context, operationId } =
      createAccountsServiceFixture();
    const updated = { ...user, displayName: 'Updated Operator', revision: 4 };
    stored.update.mockResolvedValue(updated);

    await expect(
      service.update(context, user.id, {
        expectedRevision: 3,
        displayName: 'Updated Operator',
      }),
    ).resolves.toEqual(updated);

    expect(stored.update).toHaveBeenCalledWith(user.id, {
      displayName: 'Updated Operator',
      revision: 4,
    });
    expect(audit.append).toHaveBeenCalledWith({
      operationId,
      actorId: context.actor.user.id,
      before: user,
      after: updated,
      action: 'UPDATE',
      reason: undefined,
    });
  });
});

describe('AccountsService initial administrator', () => {
  it('bootstraps one administrator with explicit system authorship and required password change', async () => {
    const { service, stored, operations, audit, user, context, operationId } =
      createAccountsServiceFixture();
    const created = { ...user, mustChangePassword: true, revision: 1 };
    stored.create.mockResolvedValue(created);
    const input = {
      login: user.login,
      displayName: user.displayName,
      roleCodes: user.roleCodes,
      initialPassword: 'synthetic-password',
    };

    await expect(
      service.bootstrap(input, 'protected-password-hash'),
    ).resolves.toEqual(created);

    expect(operations.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'accounts.bootstrap',
        key: context.key,
        actorType: 'SYSTEM_BOOTSTRAP',
        actorId: null,
      }),
    );
    expect(audit.append).toHaveBeenCalledWith({
      operationId,
      actorId: null,
      action: 'CREATE',
      before: null,
      after: created,
    });
    expect(stored.ensureRoles).toHaveBeenCalledWith(
      expect.arrayContaining([
        { code: 'ADMINISTRATOR', label: 'Administrador' },
      ]),
    );
  });
});

describe('AccountsService password mutations', () => {
  it('requires a new password change and revokes sessions after an administrative reset', async () => {
    const { service, stored, user, account, context } =
      createAccountsServiceFixture();
    const updated = { ...user, revision: 4, mustChangePassword: true };
    stored.update.mockResolvedValue(updated);

    await expect(
      service.resetPassword(
        context,
        user.id,
        {
          expectedRevision: 3,
          temporaryPassword: 'synthetic-password',
          reason: 'Synthetic reset',
        },
        'protected-password-hash',
      ),
    ).resolves.toEqual(updated);

    expect(stored.update).toHaveBeenCalledWith(user.id, {
      passwordHash: 'protected-password-hash',
      mustChangePassword: true,
      revision: 4,
      authVersion: account.authVersion + 1,
    });
  });

  it('clears the required change and correlates a self-service password change without plaintext metadata', async () => {
    const {
      service,
      stored,
      operations,
      user,
      account,
      principal,
      context,
      fingerprints,
    } = createAccountsServiceFixture();
    stored.findById.mockResolvedValue({
      ...account,
      user: { ...user, mustChangePassword: true },
    });
    const updated = { ...user, revision: 4, mustChangePassword: false };
    stored.update.mockResolvedValue(updated);

    await expect(
      service.changePassword(
        principal,
        {
          expectedRevision: 3,
          currentPassword: 'synthetic-password',
          newPassword: 'new-synthetic-password',
        },
        3,
        'protected-password-hash',
      ),
    ).resolves.toEqual(updated);

    expect(stored.update).toHaveBeenCalledWith(user.id, {
      passwordHash: 'protected-password-hash',
      mustChangePassword: false,
      revision: 4,
      authVersion: 3,
    });
    expect(operations.create).toHaveBeenCalledWith(
      expect.objectContaining({
        key: context.key,
        type: 'auth.password.change',
        fingerprintKeyId: null,
      }),
    );
    expect(fingerprints.calculate).toHaveBeenCalledWith(
      {
        route: 'auth.password.change',
        params: { userId: user.id },
        body: { expectedRevision: 3 },
      },
      null,
    );
  });
});

describe('AccountsService account activation', () => {
  it('deactivates an account with a new persistent authentication version', async () => {
    const { service, stored, audit, user, account, context } =
      createAccountsServiceFixture();
    const updated = { ...user, active: false, revision: 4 };
    stored.update.mockResolvedValue(updated);

    await expect(
      service.activate(context, user.id, {
        expectedRevision: 3,
        active: false,
        reason: 'Synthetic deactivation',
      }),
    ).resolves.toEqual(updated);

    expect(stored.update).toHaveBeenCalledWith(user.id, {
      active: false,
      revision: 4,
      authVersion: account.authVersion + 1,
    });
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DEACTIVATE',
        reason: 'Synthetic deactivation',
      }),
    );
  });
});

describe('AccountsService account creation', () => {
  it('creates an active account requiring a password change without sending plaintext to persistence', async () => {
    const { service, stored, fingerprints, user, context } =
      createAccountsServiceFixture();
    const input = {
      login: 'new.operator',
      displayName: 'New Operator',
      initialPassword: 'synthetic-password',
      roleCodes: user.roleCodes,
    };
    const created = {
      ...user,
      id: '00000000-0000-4000-8000-000000000003',
      login: input.login,
      displayName: input.displayName,
      mustChangePassword: true,
      revision: 1,
    };
    stored.create.mockResolvedValue(created);

    await expect(
      service.create(context, input, 'protected-password-hash'),
    ).resolves.toEqual(created);

    expect(stored.create).toHaveBeenCalledWith({
      login: input.login,
      displayName: input.displayName,
      roleCodes: input.roleCodes,
      passwordHash: 'protected-password-hash',
      active: true,
      mustChangePassword: true,
      revision: 1,
      authVersion: 1,
    });
    expect(fingerprints.calculate).toHaveBeenCalledWith(
      { route: 'accounts.create', params: { userId: null }, body: input },
      'v2',
    );
  });
});
