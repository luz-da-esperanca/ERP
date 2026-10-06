import { describe, expect, it, vi } from 'vitest';
import { HttpUsers } from '../../../../src/access';
import { ApiClient } from '../../../../src/shared/api-client';
import type { CreateUserInput } from '@erp/contracts/access-api';

const account = {
  id: '00000000-0000-4000-8000-000000000001',
  login: 'synthetic.operator',
  displayName: 'Synthetic Operator',
  active: true,
  mustChangePassword: true,
  revision: 3,
  roleCodes: ['ADMINISTRATOR', 'COORDINATION'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const key = '00000000-0000-4000-8000-000000000002';
const createInput: CreateUserInput = {
  login: ' Synthetic.Operator ',
  displayName: ' Synthetic Operator ',
  initialPassword: '  synthetic-password  ',
  roleCodes: ['COORDINATION', 'ADMINISTRATOR'],
};

describe('HTTP users', () => {
  it('lists authorized accounts with server pagination and the explicit active filter', async () => {
    const page = {
      data: [account],
      pagination: { page: 2, pageSize: 20, total: 21 },
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(page));
    const onChange = vi.fn();
    const users = new HttpUsers(new ApiClient(fetcher), onChange);
    expect(
      await users.list({ q: 'Synthetic & operator', active: 'false', page: 2 }),
    ).toEqual(page);
    const url = new URL(String(fetcher.mock.lastCall?.[0]), 'http://localhost');
    expect(url.pathname).toBe('/api/v1/users');
    expect(url.searchParams.get('q')).toBe('Synthetic & operator');
    expect(url.searchParams.get('active')).toBe('false');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('pageSize')).toBe('20');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('creates an account with an unchanged password and returns only the public account', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(
          { data: { ...account, passwordHash: 'private-hash' } },
          { status: 201 },
        ),
      );
    const onChange = vi.fn();
    const users = new HttpUsers(new ApiClient(fetcher), onChange);
    expect(await users.create(createInput, key)).toEqual(account);
    expect(fetcher.mock.lastCall?.[0]).toBe('/api/v1/users');
    expect(fetcher.mock.lastCall?.[1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: { 'Idempotency-Key': key, 'X-ERP-Request': '1' },
    });
    expect(JSON.parse(String(fetcher.mock.lastCall?.[1]?.body))).toEqual({
      login: 'synthetic.operator',
      displayName: 'Synthetic Operator',
      initialPassword: '  synthetic-password  ',
      roleCodes: ['ADMINISTRATOR', 'COORDINATION'],
    });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('updates account roles with the displayed revision and caller operation key', async () => {
    const updated = {
      ...account,
      displayName: 'Edited Operator',
      roleCodes: ['SOCIAL_ASSISTANCE'],
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: updated }));
    const onChange = vi.fn();
    const users = new HttpUsers(new ApiClient(fetcher), onChange);
    expect(
      await users.update(
        account.id,
        {
          expectedRevision: 2,
          displayName: 'Edited Operator',
          roleCodes: ['SOCIAL_ASSISTANCE'],
        },
        key,
      ),
    ).toEqual(updated);
    expect(fetcher.mock.lastCall?.[0]).toBe(`/api/v1/users/${account.id}`);
    expect(fetcher.mock.lastCall?.[1]).toMatchObject({
      method: 'PATCH',
      headers: { 'Idempotency-Key': key },
    });
    expect(JSON.parse(String(fetcher.mock.lastCall?.[1]?.body))).toEqual({
      expectedRevision: 2,
      displayName: 'Edited Operator',
      roleCodes: ['SOCIAL_ASSISTANCE'],
    });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('changes account activation with the displayed revision and an explicit reason', async () => {
    const inactive = { ...account, active: false };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: inactive }));
    const onChange = vi.fn();
    const users = new HttpUsers(new ApiClient(fetcher), onChange);
    const input = {
      expectedRevision: 2,
      active: false,
      reason: 'Synthetic deactivation',
    };
    expect(await users.activate(account.id, input, key)).toEqual(inactive);
    expect(fetcher.mock.lastCall?.[0]).toBe(
      `/api/v1/users/${account.id}/activation`,
    );
    expect(fetcher.mock.lastCall?.[1]).toMatchObject({
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      body: JSON.stringify(input),
    });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('resets passwords through the administrative route without returning the temporary password', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: account }));
    const onChange = vi.fn();
    const users = new HttpUsers(new ApiClient(fetcher), onChange);
    const input = {
      expectedRevision: 2,
      temporaryPassword: '  temporary-password  ',
      reason: 'Synthetic reset',
    };
    const result = await users.resetPassword(account.id, input, key);
    expect(result).toEqual(account);
    expect(JSON.stringify(result)).not.toContain('temporary-password');
    expect(fetcher.mock.lastCall?.[0]).toBe(
      `/api/v1/users/${account.id}/password`,
    );
    expect(fetcher.mock.lastCall?.[1]).toMatchObject({
      method: 'PUT',
      headers: { 'Idempotency-Key': key },
      body: JSON.stringify(input),
    });
    expect(onChange).toHaveBeenCalledOnce();
  });
});
