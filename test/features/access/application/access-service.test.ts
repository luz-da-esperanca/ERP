import { describe, expect, it } from 'vitest';
import type {
  ChangePasswordInput,
  CreateUserInput,
  ResetPasswordInput,
} from '@erp/contracts/access-api';
import type { CredentialAccount } from '../../../../src/features/access/application/ports.js';
import { DependencyUnavailableError } from '../../../../src/core/application/errors.js';
import {
  AuthenticationRequiredError,
  LoginBlockedError,
} from '../../../../src/features/access/application/access-errors.js';
import { AccountRevisionConflictError } from '../../../../src/features/access/domain/account-errors.js';
import { createAccessServiceFixture } from '../../../support/access-service-fixture.js';

describe('AccessService login', () => {
  it('creates a revocable session with the current account and safe capabilities', async () => {
    const {
      service,
      accounts,
      sessions,
      tokens,
      account,
      password,
      ip,
      session,
      token,
    } = createAccessServiceFixture();
    const current = {
      ...account,
      user: { ...account.user, displayName: 'Current Operator', revision: 4 },
    };
    accounts.findById.mockResolvedValue(current);

    const result = await service.login(account.user.login, password, ip);

    expect(sessions.checkLogin).toHaveBeenCalledWith(account.user.login, ip);
    expect(sessions.clearLoginFailures).toHaveBeenCalledWith(
      account.user.login,
    );
    expect(sessions.create).toHaveBeenCalledWith(
      current.user.id,
      current.authVersion,
    );
    expect(tokens.sign).toHaveBeenCalledWith(session);
    expect(result).toEqual({
      token,
      data: {
        user: current.user,
        roles: ['ADMINISTRATOR'],
        capabilities: ['accounts.manage', 'audit.read'],
      },
    });
    expect(sessions.recordLoginFailure).not.toHaveBeenCalled();
  });

  it.each(['missing', 'inactive'])(
    'uses a dummy hash and the same generic failure for a %s account',
    async (state) => {
      const {
        service,
        accounts,
        sessions,
        passwords,
        account,
        password,
        ip,
        tokens,
      } = createAccessServiceFixture();
      accounts.findByLogin.mockResolvedValue(
        state === 'missing'
          ? null
          : { ...account, user: { ...account.user, active: false } },
      );

      await expect(
        service.login(account.user.login, password, ip),
      ).rejects.toBeInstanceOf(AuthenticationRequiredError);

      expect(passwords.compare).toHaveBeenCalledWith(
        password,
        passwords.dummyHash,
      );
      expect(sessions.recordLoginFailure).toHaveBeenCalledWith(
        account.user.login,
      );
      expect(sessions.create).not.toHaveBeenCalled();
      expect(tokens.sign).not.toHaveBeenCalled();
    },
  );

  it('records an incorrect password without creating a session or clearing failures', async () => {
    const { service, passwords, sessions, account, password, ip } =
      createAccessServiceFixture();
    passwords.compare.mockResolvedValue(false);

    await expect(
      service.login(account.user.login, password, ip),
    ).rejects.toBeInstanceOf(AuthenticationRequiredError);

    expect(passwords.compare).toHaveBeenCalledWith(
      password,
      account.passwordHash,
    );
    expect(sessions.recordLoginFailure).toHaveBeenCalledWith(
      account.user.login,
    );
    expect(sessions.clearLoginFailures).not.toHaveBeenCalled();
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('rejects a blocked login before looking up or comparing credentials', async () => {
    const { service, accounts, sessions, passwords, user, password, ip } =
      createAccessServiceFixture();
    const blocked = new LoginBlockedError(900);
    sessions.checkLogin.mockRejectedValue(blocked);

    await expect(service.login(user.login, password, ip)).rejects.toBe(blocked);

    expect(accounts.findByLogin).not.toHaveBeenCalled();
    expect(passwords.compare).not.toHaveBeenCalled();
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'account deletion', current: () => null },
    {
      name: 'deactivation',
      current: (account: CredentialAccount) => ({
        ...account,
        user: { ...account.user, active: false },
      }),
    },
    {
      name: 'authentication revocation',
      current: (account: CredentialAccount) => ({
        ...account,
        authVersion: account.authVersion + 1,
      }),
    },
    {
      name: 'password replacement',
      current: (account: CredentialAccount) => ({
        ...account,
        passwordHash: 'replaced-password-hash',
      }),
    },
  ])(
    'denies login after $name during password comparison',
    async ({ current }) => {
      const { service, accounts, sessions, tokens, account, password, ip } =
        createAccessServiceFixture();
      accounts.findById.mockResolvedValue(current(account));

      await expect(
        service.login(account.user.login, password, ip),
      ).rejects.toBeInstanceOf(AuthenticationRequiredError);

      expect(sessions.clearLoginFailures).not.toHaveBeenCalled();
      expect(sessions.create).not.toHaveBeenCalled();
      expect(tokens.sign).not.toHaveBeenCalled();
    },
  );

  it('fails without a token when the session store is unavailable', async () => {
    const { service, sessions, tokens, user, password, ip } =
      createAccessServiceFixture();
    sessions.create.mockRejectedValue(new DependencyUnavailableError());

    await expect(
      service.login(user.login, password, ip),
    ).rejects.toBeInstanceOf(DependencyUnavailableError);

    expect(tokens.sign).not.toHaveBeenCalled();
  });
});

describe('AccessService session authentication', () => {
  it('loads current roles and account details instead of relying on token permissions', async () => {
    const { service, accounts, sessions, account, token, session } =
      createAccessServiceFixture();
    const current: CredentialAccount = {
      ...account,
      user: { ...account.user, roleCodes: ['ACTIVITY_MANAGER'] },
    };
    accounts.findById.mockResolvedValue(current);

    const principal = await service.authenticate(token);

    expect(principal).toEqual({
      user: current.user,
      authVersion: account.authVersion,
      sessionId: session.id,
    });
    expect(service.describe(principal)).toEqual({
      user: current.user,
      roles: ['ACTIVITY_MANAGER'],
      capabilities: [
        'attendance.read',
        'attendance.write',
        'audit.read',
        'participants.lookup',
        'projects.read',
        'reports.read',
      ],
    });
    expect(sessions.read).toHaveBeenCalledWith(session.id, true);
  });

  it('rejects a missing token before accessing dependencies', async () => {
    const { service, tokens, sessions, accounts } =
      createAccessServiceFixture();

    await expect(service.authenticate(undefined)).rejects.toBeInstanceOf(
      AuthenticationRequiredError,
    );

    expect(tokens.verify).not.toHaveBeenCalled();
    expect(sessions.read).not.toHaveBeenCalled();
    expect(accounts.findById).not.toHaveBeenCalled();
  });

  it('rejects an invalid token before reading the session', async () => {
    const { service, tokens, sessions, accounts, token } =
      createAccessServiceFixture();
    tokens.verify.mockRejectedValue(new AuthenticationRequiredError());

    await expect(service.authenticate(token)).rejects.toBeInstanceOf(
      AuthenticationRequiredError,
    );

    expect(sessions.read).not.toHaveBeenCalled();
    expect(accounts.findById).not.toHaveBeenCalled();
  });

  it.each(['missing', 'another user'])(
    'rejects an unavailable or mismatched session (%s) without querying the account',
    async (state) => {
      const { service, sessions, accounts, session, token } =
        createAccessServiceFixture();
      sessions.read.mockResolvedValue(
        state === 'missing'
          ? null
          : { ...session, userId: '00000000-0000-4000-8000-000000000003' },
      );

      await expect(service.authenticate(token)).rejects.toBeInstanceOf(
        AuthenticationRequiredError,
      );

      expect(accounts.findById).not.toHaveBeenCalled();
      expect(sessions.read).not.toHaveBeenCalledWith(session.id, true);
    },
  );

  it.each([
    { name: 'missing', missing: true, active: true, authVersion: 2 },
    { name: 'inactive', missing: false, active: false, authVersion: 2 },
    { name: 'revoked', missing: false, active: true, authVersion: 3 },
  ])(
    'rejects a $name account without extending session activity',
    async ({ missing, active, authVersion }) => {
      const { service, accounts, sessions, account, session, token } =
        createAccessServiceFixture();
      accounts.findById.mockResolvedValue(
        missing
          ? null
          : { ...account, authVersion, user: { ...account.user, active } },
      );

      await expect(service.authenticate(token)).rejects.toBeInstanceOf(
        AuthenticationRequiredError,
      );

      expect(sessions.read).not.toHaveBeenCalledWith(session.id, true);
    },
  );

  it('rejects a session that disappears before its activity can be renewed', async () => {
    const { service, sessions, session, token } = createAccessServiceFixture();
    sessions.read.mockResolvedValueOnce(session).mockResolvedValueOnce(null);

    await expect(service.authenticate(token)).rejects.toBeInstanceOf(
      AuthenticationRequiredError,
    );
  });

  it('propagates session store unavailability instead of authenticating with the token alone', async () => {
    const { service, sessions, accounts, token } = createAccessServiceFixture();
    sessions.read.mockRejectedValue(new DependencyUnavailableError());

    await expect(service.authenticate(token)).rejects.toBeInstanceOf(
      DependencyUnavailableError,
    );

    expect(accounts.findById).not.toHaveBeenCalled();
  });
});

describe('AccessService logout', () => {
  it('deletes the verified session without requiring an active account', async () => {
    const { service, sessions, accounts, session, token } =
      createAccessServiceFixture();

    await expect(service.logout(token)).resolves.toBeUndefined();

    expect(sessions.delete).toHaveBeenCalledWith(session.id);
    expect(accounts.findById).not.toHaveBeenCalled();
  });

  it('allows logout without a token when the session store is available', async () => {
    const { service, sessions, tokens } = createAccessServiceFixture();

    await expect(service.logout(undefined)).resolves.toBeUndefined();

    expect(sessions.assertAvailable).toHaveBeenCalledOnce();
    expect(tokens.verify).not.toHaveBeenCalled();
    expect(sessions.delete).not.toHaveBeenCalled();
  });

  it('allows an invalid or expired token to be cleared without deleting another session', async () => {
    const { service, tokens, sessions, token } = createAccessServiceFixture();
    tokens.verify.mockRejectedValue(new AuthenticationRequiredError());

    await expect(service.logout(token)).resolves.toBeUndefined();

    expect(sessions.delete).not.toHaveBeenCalled();
  });

  it.each([undefined, 'signed-session-token'])(
    'does not claim logout succeeded during a session store outage (token: %s)',
    async (token) => {
      const { service, sessions } = createAccessServiceFixture();
      sessions.assertAvailable.mockRejectedValue(
        new DependencyUnavailableError(),
      );

      await expect(service.logout(token)).rejects.toBeInstanceOf(
        DependencyUnavailableError,
      );
    },
  );

  it('does not swallow a failure to delete a verified session', async () => {
    const { service, sessions, token } = createAccessServiceFixture();
    sessions.delete.mockRejectedValue(new DependencyUnavailableError());

    await expect(service.logout(token)).rejects.toBeInstanceOf(
      DependencyUnavailableError,
    );
  });
});

describe('AccessService password change', () => {
  const input: ChangePasswordInput = {
    expectedRevision: 3,
    currentPassword: 'synthetic-password',
    newPassword: 'new-synthetic-password',
  };

  it('passes the captured revision and new hash to persistence during a required password change', async () => {
    const { service, accounts, passwords, account, principal } =
      createAccessServiceFixture();
    const current = {
      ...account,
      user: { ...account.user, mustChangePassword: true },
    };
    const actor = { ...principal, user: current.user };
    const updatedUser = {
      ...current.user,
      mustChangePassword: false,
      revision: 4,
    };
    accounts.findById.mockResolvedValue(current);
    accounts.changePassword.mockResolvedValue(updatedUser);

    await expect(service.changePassword(actor, input)).resolves.toEqual(
      updatedUser,
    );

    expect(passwords.compare).toHaveBeenCalledWith(
      input.currentPassword,
      current.passwordHash,
    );
    expect(passwords.hash).toHaveBeenCalledWith(input.newPassword);
    expect(accounts.changePassword).toHaveBeenCalledWith(
      actor,
      input,
      current.user.revision,
      'new-password-hash',
    );
  });

  it.each([
    { name: 'missing', missing: true, active: true, authVersion: 2 },
    { name: 'inactive', missing: false, active: false, authVersion: 2 },
    { name: 'revoked', missing: false, active: true, authVersion: 3 },
  ])(
    'rejects a $name account before comparing or changing passwords',
    async ({ missing, active, authVersion }) => {
      const { service, accounts, passwords, account, principal } =
        createAccessServiceFixture();
      accounts.findById.mockResolvedValue(
        missing
          ? null
          : { ...account, authVersion, user: { ...account.user, active } },
      );

      await expect(
        service.changePassword(principal, input),
      ).rejects.toBeInstanceOf(AuthenticationRequiredError);

      expect(passwords.compare).not.toHaveBeenCalled();
      expect(passwords.hash).not.toHaveBeenCalled();
      expect(accounts.changePassword).not.toHaveBeenCalled();
    },
  );

  it('reports a stale revision before performing expensive password operations', async () => {
    const { service, passwords, accounts, principal } =
      createAccessServiceFixture();

    await expect(
      service.changePassword(principal, { ...input, expectedRevision: 2 }),
    ).rejects.toMatchObject({
      name: AccountRevisionConflictError.name,
      currentRevision: 3,
    });

    expect(passwords.compare).not.toHaveBeenCalled();
    expect(passwords.hash).not.toHaveBeenCalled();
    expect(accounts.changePassword).not.toHaveBeenCalled();
  });

  it('rejects an incorrect current password without hashing or writing the replacement', async () => {
    const { service, passwords, accounts, principal } =
      createAccessServiceFixture();
    passwords.compare.mockResolvedValue(false);

    await expect(
      service.changePassword(principal, input),
    ).rejects.toBeInstanceOf(AuthenticationRequiredError);

    expect(passwords.hash).not.toHaveBeenCalled();
    expect(accounts.changePassword).not.toHaveBeenCalled();
  });

  it('leaves persistence untouched when hashing the new password fails', async () => {
    const { service, passwords, accounts, principal } =
      createAccessServiceFixture();
    const error = new Error('Password hashing failed');
    passwords.hash.mockRejectedValue(error);

    await expect(service.changePassword(principal, input)).rejects.toBe(error);

    expect(accounts.changePassword).not.toHaveBeenCalled();
  });

  it('preserves a revision conflict detected by persistence after hashing', async () => {
    const { service, accounts, principal } = createAccessServiceFixture();
    const conflict = new AccountRevisionConflictError(4);
    accounts.changePassword.mockRejectedValue(conflict);

    await expect(service.changePassword(principal, input)).rejects.toBe(
      conflict,
    );

    expect(accounts.changePassword).toHaveBeenCalledOnce();
  });
});

describe('AccessService account password commands', () => {
  const createInput: CreateUserInput = {
    login: 'new.operator',
    displayName: 'New Synthetic Operator',
    initialPassword: 'initial-synthetic-password',
    roleCodes: ['ACTIVITY_MANAGER'],
  };
  const resetInput: ResetPasswordInput = {
    expectedRevision: 3,
    temporaryPassword: 'temporary-synthetic-password',
    reason: 'Synthetic credential reset',
  };

  it('creates an account with a hashed initial password and preserves command authorship', async () => {
    const { service, accounts, passwords, principal, user } =
      createAccessServiceFixture();
    const context = {
      actor: principal,
      key: '00000000-0000-4000-8000-000000000004',
    };
    const createdUser = {
      ...user,
      id: '00000000-0000-4000-8000-000000000003',
      login: createInput.login,
      displayName: createInput.displayName,
      roleCodes: createInput.roleCodes,
      mustChangePassword: true,
      revision: 1,
    };
    accounts.create.mockResolvedValue(createdUser);

    await expect(service.createUser(context, createInput)).resolves.toEqual(
      createdUser,
    );

    expect(passwords.hash).toHaveBeenCalledWith(createInput.initialPassword);
    expect(accounts.create).toHaveBeenCalledWith(
      context,
      createInput,
      'new-password-hash',
    );
  });

  it('resets credentials with a hashed temporary password and preserves target and reason', async () => {
    const { service, accounts, passwords, principal, user } =
      createAccessServiceFixture();
    const context = {
      actor: principal,
      key: '00000000-0000-4000-8000-000000000004',
    };
    const updatedUser = { ...user, mustChangePassword: true, revision: 4 };
    accounts.resetPassword.mockResolvedValue(updatedUser);

    await expect(
      service.resetPassword(context, user.id, resetInput),
    ).resolves.toEqual(updatedUser);

    expect(passwords.hash).toHaveBeenCalledWith(resetInput.temporaryPassword);
    expect(accounts.resetPassword).toHaveBeenCalledWith(
      context,
      user.id,
      resetInput,
      'new-password-hash',
    );
  });

  it('does not create an account when password hashing fails', async () => {
    const { service, accounts, passwords, principal } =
      createAccessServiceFixture();
    const context = {
      actor: principal,
      key: '00000000-0000-4000-8000-000000000004',
    };
    const error = new Error('Password hashing failed');
    passwords.hash.mockRejectedValue(error);

    await expect(service.createUser(context, createInput)).rejects.toBe(error);

    expect(accounts.create).not.toHaveBeenCalled();
  });

  it('does not reset credentials when password hashing fails', async () => {
    const { service, accounts, passwords, principal, user } =
      createAccessServiceFixture();
    const context = {
      actor: principal,
      key: '00000000-0000-4000-8000-000000000004',
    };
    const error = new Error('Password hashing failed');
    passwords.hash.mockRejectedValue(error);

    await expect(
      service.resetPassword(context, user.id, resetInput),
    ).rejects.toBe(error);

    expect(accounts.resetPassword).not.toHaveBeenCalled();
  });
});
