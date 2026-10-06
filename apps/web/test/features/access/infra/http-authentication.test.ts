import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../../../src/shared/api-client';
import { HttpAuthentication } from '../../../../src/access';

const session = {
  user: {
    id: '00000000-0000-4000-8000-000000000001',
    login: 'synthetic.operator',
    displayName: 'Synthetic Operator',
    active: true,
    mustChangePassword: false,
    revision: 2,
    roleCodes: ['COORDINATION'] as const,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  roles: ['COORDINATION'] as const,
  capabilities: ['audit.read'] as const,
};

describe('HTTP authentication', () => {
  it('does not restore a stale session after logout or another unauthorized request', async () => {
    for (const invalidate of ['logout', 'unauthorized'] as const) {
      let resolveSession!: (response: Response) => void;
      const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveSession = resolve;
          }),
      );
      const api = new ApiClient(fetcher);
      const authentication = new HttpAuthentication(api);
      const pendingRestore = authentication.restore();
      if (invalidate === 'logout') {
        fetcher.mockResolvedValue(new Response(null, { status: 204 }));
        await authentication.logout();
      } else {
        fetcher.mockResolvedValue(new Response(null, { status: 401 }));
        await expect(
          api.requestEmpty('/any-operation', { method: 'POST', body: {} }),
        ).rejects.toMatchObject({ status: 401 });
      }
      resolveSession(Response.json({ data: session }));
      await pendingRestore;
      expect(authentication.getSnapshot()).toEqual({
        status: 'anonymous',
        session: null,
      });
    }
  });
  it('shares simultaneous session restoration and keeps a newer login when an old restoration fails', async () => {
    let rejectSession!: (error: Error) => void;
    const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(
      () =>
        new Promise<Response>((_resolve, reject) => {
          rejectSession = reject;
        }),
    );
    const authentication = new HttpAuthentication(new ApiClient(fetcher));
    const firstRestore = authentication.restore();
    const secondRestore = authentication.restore();
    expect(fetcher).toHaveBeenCalledOnce();
    fetcher.mockResolvedValue(Response.json({ data: session }));
    await authentication.login({
      login: 'synthetic.operator',
      password: 'synthetic-password',
    });
    rejectSession(new Error('Late network failure'));
    await Promise.all([firstRestore, secondRestore]);
    expect(authentication.getSnapshot()).toEqual({
      status: 'authenticated',
      session,
    });
  });
  it('requires a new login after changing the password and retains the session when the change fails', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: session }));
    const authentication = new HttpAuthentication(new ApiClient(fetcher));
    await authentication.restore();
    const input = {
      expectedRevision: 2,
      currentPassword: '  synthetic-password  ',
      newPassword: '  another-password  ',
    };
    fetcher.mockResolvedValue(
      Response.json(
        { error: { code: 'REVISION_CONFLICT', requestId: 'request-id' } },
        { status: 409 },
      ),
    );
    await expect(authentication.changePassword(input)).rejects.toMatchObject({
      code: 'REVISION_CONFLICT',
    });
    expect(authentication.getSnapshot()).toEqual({
      status: 'authenticated',
      session,
    });
    fetcher.mockResolvedValue(
      Response.json({
        data: { ...session.user, mustChangePassword: false, revision: 3 },
      }),
    );
    await authentication.changePassword(input);
    expect(fetcher.mock.lastCall?.[0]).toBe('/api/v1/auth/password');
    expect(fetcher.mock.lastCall?.[1]).toMatchObject({
      method: 'PUT',
      body: JSON.stringify(input),
    });
    expect(authentication.getSnapshot()).toEqual({
      status: 'anonymous',
      session: null,
    });
    expect(JSON.stringify(authentication.getSnapshot())).not.toContain(
      'password',
    );
  });
  it('ends local authentication only after logout is confirmed and clears it on a later unauthorized request', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: session }));
    const api = new ApiClient(fetcher);
    const authentication = new HttpAuthentication(api);
    await authentication.restore();
    fetcher.mockResolvedValue(
      Response.json(
        { error: { code: 'DEPENDENCY_UNAVAILABLE', requestId: 'request-id' } },
        { status: 503 },
      ),
    );
    await expect(authentication.logout()).rejects.toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
    });
    expect(authentication.getSnapshot().status).toBe('authenticated');
    fetcher.mockResolvedValue(new Response(null, { status: 204 }));
    await authentication.logout();
    expect(authentication.getSnapshot()).toEqual({
      status: 'anonymous',
      session: null,
    });
    fetcher.mockResolvedValue(Response.json({ data: session }));
    await authentication.restore();
    fetcher.mockResolvedValue(new Response(null, { status: 401 }));
    await expect(
      api.requestEmpty('/any-operation', { method: 'POST', body: {} }),
    ).rejects.toMatchObject({ status: 401 });
    expect(authentication.getSnapshot()).toEqual({
      status: 'anonymous',
      session: null,
    });
  });
  it('restores the cookie session and keeps an unavailable backend distinct from an anonymous user', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: session }));
    const authentication = new HttpAuthentication(new ApiClient(fetcher));
    await authentication.restore();
    expect(authentication.getSnapshot()).toEqual({
      status: 'authenticated',
      session,
    });
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/auth/session');
    fetcher.mockResolvedValue(
      Response.json(
        { error: { code: 'UNAUTHENTICATED', requestId: 'request-id' } },
        { status: 401 },
      ),
    );
    await authentication.restore();
    expect(authentication.getSnapshot()).toEqual({
      status: 'anonymous',
      session: null,
    });
    fetcher.mockResolvedValue(
      Response.json(
        { error: { code: 'DEPENDENCY_UNAVAILABLE', requestId: 'request-id' } },
        { status: 503 },
      ),
    );
    await authentication.restore();
    expect(authentication.getSnapshot()).toMatchObject({
      status: 'unavailable',
      session: null,
      error: { code: 'DEPENDENCY_UNAVAILABLE' },
    });
  });
  it('publishes the exact server session and never retains the submitted password', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: session }));
    const authentication = new HttpAuthentication(new ApiClient(fetcher));
    const listener = vi.fn();
    const unsubscribe = authentication.subscribe(listener);
    await authentication.login({
      login: ' Synthetic.Operator ',
      password: '  synthetic-password  ',
    });
    expect(authentication.getSnapshot()).toEqual({
      status: 'authenticated',
      session,
    });
    expect(fetcher.mock.calls[0]?.[1]?.body).toBe(
      '{"login":"synthetic.operator","password":"  synthetic-password  "}',
    );
    expect(listener).toHaveBeenCalled();
    expect(JSON.stringify(authentication.getSnapshot())).not.toContain(
      'synthetic-password',
    );
    unsubscribe();
  });
});
