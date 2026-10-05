import { AuthenticationRequiredError } from '../../../../src/features/access/application/access-errors.js';
import { AccountRevisionConflictError } from '../../../../src/features/access/domain/account-errors.js';
import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { UserDto } from '@erp/contracts/access-api';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
const fixture = setupIntegrationFixture();
describe('Transactional account commands', () => {
  it('replays the original revision and rejects a different password or author for the same creation key', async () => {
    const { initialPassword, headers, adminCookie, runtime, operator } =
      fixture;
    const key = randomUUID();
    const payload = {
      login: 'synthetic.replay',
      displayName: 'Synthetic Replay',
      initialPassword,
      roleCodes: ['SOCIAL_ASSISTANCE'],
    };
    const request = {
      method: 'POST' as const,
      url: '/api/v1/users',
      headers: headers(adminCookie, key),
      payload,
    };
    const first = await runtime.app.inject(request);
    const created = first.json<{ data: UserDto }>().data;
    await runtime.app.inject({
      method: 'PATCH',
      url: `/api/v1/users/${created.id}`,
      headers: headers(adminCookie),
      payload: { expectedRevision: 1, displayName: 'Synthetic Changed' },
    });
    const count = await runtime.database.auditEntry.count();
    expect((await runtime.app.inject(request)).json()).toEqual(first.json());
    expect(await runtime.database.auditEntry.count()).toBe(count);
    expect(
      (
        await runtime.app.inject({
          ...request,
          payload: {
            ...payload,
            initialPassword: 'synthetic-different-password',
          },
        })
      ).statusCode,
    ).toBe(409);
    const other = await operator('synthetic.other-admin', ['ADMINISTRATOR']);
    expect(
      (
        await runtime.app.inject({
          ...request,
          headers: headers(other.cookie, key),
        })
      ).statusCode,
    ).toBe(409);
  });
  it('serializes identical concurrent keys into a single account and event', async () => {
    const { runtime, headers, adminCookie, initialPassword } = fixture;
    const key = randomUUID();
    const before = await runtime.database.auditEntry.count();
    const request = {
      method: 'POST' as const,
      url: '/api/v1/users',
      headers: headers(adminCookie, key),
      payload: {
        login: 'synthetic.concurrent',
        displayName: 'Synthetic Concurrent',
        initialPassword,
        roleCodes: ['SOCIAL_ASSISTANCE'],
      },
    };
    const [first, second] = await Promise.all([
      runtime.app.inject(request),
      runtime.app.inject(request),
    ]);
    expect(first.statusCode, first.body).toBe(201);
    expect(second.statusCode, second.body).toBe(201);
    expect(first.json()).toEqual(second.json());
    expect(await runtime.database.auditEntry.count()).toBe(before + 1);
    expect(
      await runtime.database.userAccount.count({
        where: { login: 'synthetic.concurrent' },
      }),
    ).toBe(1);
  });
  it('allows one winner for concurrent revisions and preserves no-op audit counts', async () => {
    const { createUser, runtime, headers, adminCookie } = fixture;
    const user = await createUser('synthetic.revision');
    const responses = await Promise.all(
      ['One', 'Two'].map((name) =>
        runtime.app.inject({
          method: 'PATCH',
          url: `/api/v1/users/${user.id}`,
          headers: headers(adminCookie),
          payload: {
            expectedRevision: user.revision,
            displayName: `Synthetic ${name}`,
          },
        }),
      ),
    );
    expect(responses.map((response) => response.statusCode).sort()).toEqual([
      200, 409,
    ]);
    const current = await runtime.accounts.findById(user.id);
    if (!current) throw new Error('Expected account');
    const count = await runtime.database.auditEntry.count();
    const noOp = await runtime.app.inject({
      method: 'PATCH',
      url: `/api/v1/users/${user.id}`,
      headers: headers(adminCookie),
      payload: {
        expectedRevision: current.user.revision,
        displayName: current.user.displayName,
      },
    });
    expect(noOp.statusCode).toBe(200);
    expect(noOp.json().data.revision).toBe(current.user.revision);
    expect(await runtime.database.auditEntry.count()).toBe(count);
  });
  it('protects the last administrator under concurrent deactivation and role removal', async () => {
    const { operator, runtime, admin, headers, adminCookie } = fixture;
    const other = await operator('synthetic.second-admin', ['ADMINISTRATOR']);
    const requests = [
      runtime.app.inject({
        method: 'POST',
        url: `/api/v1/users/${admin.id}/activation`,
        headers: headers(adminCookie),
        payload: {
          expectedRevision: admin.revision,
          active: false,
          reason: 'Synthetic concurrency test',
        },
      }),
      runtime.app.inject({
        method: 'PATCH',
        url: `/api/v1/users/${other.user.id}`,
        headers: headers(other.cookie),
        payload: {
          expectedRevision: other.user.revision,
          roleCodes: ['SOCIAL_ASSISTANCE'],
        },
      }),
    ];
    const results = await Promise.all(requests);
    expect(results.map((result) => result.statusCode).sort()).toEqual([
      200, 422,
    ]);
    expect(
      await runtime.database.userAccount.count({
        where: { active: true, roles: { some: { roleCode: 'ADMINISTRATOR' } } },
      }),
    ).toBe(1);
  });
  it('rejects an already authorized command after persistent revocation', async () => {
    const {
      currentAdmin,
      runtime,
      admin,
      headers,
      adminCookie,
      initialPassword,
    } = fixture;
    const actor = await currentAdmin();
    await runtime.app.inject({
      method: 'PUT',
      url: `/api/v1/users/${admin.id}/password`,
      headers: headers(adminCookie),
      payload: {
        expectedRevision: admin.revision,
        temporaryPassword: initialPassword,
        reason: 'Synthetic revocation',
      },
    });
    await expect(
      runtime.accounts.create(
        { actor, key: randomUUID() },
        {
          login: 'synthetic.stale-author',
          displayName: 'Synthetic Stale',
          initialPassword,
          roleCodes: ['ADMINISTRATOR'],
        },
        await runtime.access.hash(initialPassword),
      ),
    ).rejects.toBeInstanceOf(AuthenticationRequiredError);
    expect(await runtime.database.userAccount.count()).toBe(1);
  });
  it('rejects password replacement after the captured revision changes', async () => {
    const {
      currentAdmin,
      runtime,
      admin,
      headers,
      adminCookie,
      password,
      initialPassword,
      login,
    } = fixture;
    const actor = await currentAdmin();
    await runtime.app.inject({
      method: 'PATCH',
      url: `/api/v1/users/${admin.id}`,
      headers: headers(adminCookie),
      payload: {
        expectedRevision: admin.revision,
        displayName: 'Synthetic Revised',
      },
    });
    await expect(
      runtime.accounts.changePassword(
        actor,
        {
          expectedRevision: admin.revision,
          currentPassword: password,
          newPassword: initialPassword,
        },
        admin.revision,
        await runtime.access.hash(initialPassword),
      ),
    ).rejects.toBeInstanceOf(AccountRevisionConflictError);
    await login(admin.login);
  });
  it('restricts bootstrap to the first account', async () => {
    const { runtime, initialPassword } = fixture;
    await expect(
      runtime.accounts.bootstrap(
        {
          login: 'synthetic.bootstrap-again',
          displayName: 'Synthetic Extra',
          initialPassword,
          roleCodes: ['ADMINISTRATOR'],
        },
        await runtime.access.hash(initialPassword),
      ),
    ).rejects.toMatchObject({ rule: 'BOOTSTRAP_ALREADY_COMPLETED' });

    expect(await runtime.database.userAccount.count()).toBe(1);
  });
  it('conflicts on password reset replay when its password or target changes', async () => {
    const {
      createUser,
      headers,
      adminCookie,
      password,
      runtime,
      initialPassword,
    } = fixture;
    const first = await createUser('synthetic.reset-first');
    const second = await createUser('synthetic.reset-second');
    const key = randomUUID();
    const request = {
      method: 'PUT' as const,
      url: `/api/v1/users/${first.id}/password`,
      headers: headers(adminCookie, key),
      payload: {
        expectedRevision: first.revision,
        temporaryPassword: password,
        reason: 'Synthetic administrative reset',
      },
    };
    const response = await runtime.app.inject(request);
    expect(response.statusCode).toBe(200);
    const count = await runtime.database.auditEntry.count();
    expect((await runtime.app.inject(request)).json()).toEqual(response.json());
    expect(await runtime.database.auditEntry.count()).toBe(count);
    expect(
      (
        await runtime.app.inject({
          ...request,
          payload: { ...request.payload, temporaryPassword: initialPassword },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await runtime.app.inject({
          ...request,
          url: `/api/v1/users/${second.id}/password`,
        })
      ).statusCode,
    ).toBe(409);
  });
  it('rechecks authorization before an idempotent replay', async () => {
    const { operator, headers, initialPassword, runtime, adminCookie } =
      fixture;
    const actor = await operator('synthetic.replay-admin', ['ADMINISTRATOR']);
    const key = randomUUID();
    const request = {
      method: 'POST' as const,
      url: '/api/v1/users',
      headers: headers(actor.cookie, key),
      payload: {
        login: 'synthetic.original',
        displayName: 'Synthetic Original',
        initialPassword,
        roleCodes: ['SOCIAL_ASSISTANCE'],
      },
    };
    expect((await runtime.app.inject(request)).statusCode).toBe(201);
    expect(
      (
        await runtime.app.inject({
          method: 'PATCH',
          url: `/api/v1/users/${actor.user.id}`,
          headers: headers(adminCookie),
          payload: {
            expectedRevision: actor.user.revision,
            roleCodes: ['SOCIAL_ASSISTANCE'],
          },
        })
      ).statusCode,
    ).toBe(200);
    expect((await runtime.app.inject(request)).statusCode).toBe(403);
  });
});
