import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createHttpAuthService,
  type FetchClient,
} from '../../../src/client/auth/http-auth-service.ts';

const authenticatedResponse = {
  sessionToken: 'opaque-session-token',
  csrfToken: 'opaque-csrf-token',
  expiresAt: '2099-10-25T12:30:00.000Z',
  user: {
    id: '01963000-0000-7000-8000-000000000001',
    loginIdentifier: 'coord@example.invalid',
    displayName: 'Synthetic Coordinator',
    profiles: ['COORDINATOR'],
    status: 'ACTIVE',
    version: 1,
  },
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('HTTP auth service', () => {
  it('uses the browser cookie flow, keeps only CSRF in memory, and discards the session token', async () => {
    const fetchClient = vi.fn<FetchClient>()
      .mockResolvedValueOnce(jsonResponse(200, authenticatedResponse))
      .mockResolvedValueOnce(jsonResponse(200, authenticatedResponse))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const authService = createHttpAuthService({ fetchClient });

    const result = await authService.signIn({
      loginIdentifier: 'coord@example.invalid',
      password: 'SyntheticPassword!123',
    });
    const session = await authService.getSession();
    await authService.signOut();

    expect(result).toEqual({
      status: 'authenticated',
      session: {
        expiresAt: '2099-10-25T12:30:00.000Z',
        operator: {
          loginIdentifier: 'coord@example.invalid',
          displayName: 'Synthetic Coordinator',
          profiles: ['COORDINATOR'],
        },
      },
    });
    expect(session).toEqual(result.status === 'authenticated' ? result.session : null);
    expect(fetchClient).toHaveBeenNthCalledWith(1, '/api/v1/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        loginIdentifier: 'coord@example.invalid',
        password: 'SyntheticPassword!123',
      }),
    });
    expect(fetchClient).toHaveBeenNthCalledWith(2, '/api/v1/auth/session', {
      method: 'GET',
      credentials: 'same-origin',
    });
    expect(fetchClient).toHaveBeenNthCalledWith(3, '/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-CSRF-Token': 'opaque-csrf-token' },
    });
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('maps only the published invalid-credentials response to the neutral result', async () => {
    const fetchClient = vi.fn<FetchClient>()
      .mockResolvedValueOnce(jsonResponse(401, { code: 'INVALID_CREDENTIALS' }))
      .mockResolvedValueOnce(jsonResponse(401, { code: 'AUTH_REQUIRED' }));
    const authService = createHttpAuthService({ fetchClient });

    await expect(authService.signIn({
      loginIdentifier: 'coord@example.invalid',
      password: 'WrongSyntheticPassword!123',
    })).resolves.toEqual({ status: 'invalid-credentials' });
    await expect(authService.getSession()).resolves.toBeNull();
  });

  it('does not authenticate malformed success data or untrusted failures', async () => {
    const fetchClient = vi.fn<FetchClient>()
      .mockResolvedValueOnce(jsonResponse(200, { user: authenticatedResponse.user }))
      .mockResolvedValueOnce(jsonResponse(503, { code: 'SERVICE_UNAVAILABLE' }));
    const authService = createHttpAuthService({ fetchClient });

    await expect(authService.signIn({
      loginIdentifier: 'coord@example.invalid',
      password: 'SyntheticPassword!123',
    })).resolves.toEqual({ status: 'unavailable' });
    await expect(authService.getSession()).rejects.toThrow('Authentication service is unavailable.');
  });

  it('fails closed when a successful response lacks a valid future expiry', async () => {
    const fetchClient = vi.fn<FetchClient>()
      .mockResolvedValueOnce(jsonResponse(200, { ...authenticatedResponse, expiresAt: 'not-a-date' }))
      .mockResolvedValueOnce(jsonResponse(200, { ...authenticatedResponse, expiresAt: '2020-10-25T12:30:00.000Z' }));
    const authService = createHttpAuthService({ fetchClient });

    await expect(authService.signIn({
      loginIdentifier: 'coord@example.invalid',
      password: 'SyntheticPassword!123',
    })).resolves.toEqual({ status: 'unavailable' });
    await expect(authService.getSession()).rejects.toThrow('Authentication service is unavailable.');
  });

  it('keeps the latest CSRF verifier when an earlier session bootstrap resolves after login', async () => {
    let resolveBootstrap: ((response: Response) => void) | undefined;
    const fetchClient = vi.fn<FetchClient>()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveBootstrap = resolve; }))
      .mockResolvedValueOnce(jsonResponse(200, authenticatedResponse))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const authService = createHttpAuthService({ fetchClient });

    const bootstrap = authService.getSession();
    await authService.signIn({
      loginIdentifier: 'coord@example.invalid',
      password: 'SyntheticPassword!123',
    });
    resolveBootstrap?.(jsonResponse(401, { code: 'AUTH_REQUIRED' }));
    await expect(bootstrap).resolves.toBeNull();
    await authService.signOut();

    expect(fetchClient).toHaveBeenNthCalledWith(3, '/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-CSRF-Token': 'opaque-csrf-token' },
    });
  });
});
