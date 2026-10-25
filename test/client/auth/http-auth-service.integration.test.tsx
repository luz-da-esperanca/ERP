import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, onTestFinished } from 'vitest';
import { App } from '../../../src/client/app.tsx';
import { createHttpAuthService, type FetchClient } from '../../../src/client/auth/http-auth-service.ts';
import type { ProtectedRouteDefinition } from '../../../src/client/navigation/protected-route.tsx';
import { createApp } from '../../../src/server/app.ts';

const hubRoute: ProtectedRouteDefinition = {
  destination: '/hub',
  requiredProfile: 'COORDINATOR',
};

interface IntegratedFetchOptions {
  readonly transformRequest?: (input: string, init: RequestInit) => RequestInit;
}

function createIntegratedFetch(
  app: ReturnType<typeof createApp>,
  options: IntegratedFetchOptions = {},
): FetchClient {
  let cookie: string | undefined;

  return async (input, init) => {
    const requestInit = options.transformRequest?.(input, init) ?? init;
    const url = new URL(input, 'http://127.0.0.1:5173');
    const headers = new Headers(requestInit.headers);
    headers.set('host', '127.0.0.1:5173');
    if (requestInit.method !== 'GET') headers.set('origin', 'http://127.0.0.1:5173');
    if (cookie !== undefined) headers.set('cookie', cookie);

    const payload = typeof requestInit.body === 'string' ? requestInit.body : undefined;
    const response = await app.inject({
      method: requestInit.method === 'POST' ? 'POST' : 'GET',
      url: `${url.pathname}${url.search}`,
      headers: Object.fromEntries(headers.entries()),
      ...(payload === undefined ? {} : { payload }),
    });
    const setCookie = response.headers['set-cookie'];
    if (typeof setCookie === 'string') cookie = setCookie.split(';')[0];

    const responseHeaders = new Headers();
    for (const [name, value] of Object.entries(response.headers)) {
      if (value !== undefined) responseHeaders.set(name, Array.isArray(value) ? value.join(', ') : String(value));
    }

    return new Response(response.body === '' ? null : response.body, {
      status: response.statusCode,
      headers: responseHeaders,
    });
  };
}

function readSessionToken(body: unknown): string {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new Error('Expected a login response object.');
  }
  if (!('sessionToken' in body)) {
    throw new Error('Expected a session token in the login response.');
  }
  const sessionToken = body.sessionToken;
  if (typeof sessionToken !== 'string' || sessionToken.length === 0) {
    throw new Error('Expected a session token in the login response.');
  }
  return sessionToken;
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/login');
});

describe('C-02 client adapter proof', () => {
  it('uses the integrated server for successful login, bootstrap, logout, and invalid session', async () => {
    const app = createApp({
      checkDatabase: async () => {},
      seedUsers: [{
        id: '01963000-0000-7000-8000-000000000001',
        loginIdentifier: 'coord@example.invalid',
        displayName: 'Synthetic Coordinator',
        password: 'SyntheticPassword!123',
        profiles: ['COORDINATOR'],
      }],
    });
    onTestFinished(() => app.close());
    const authService = createHttpAuthService({ fetchClient: createIntegratedFetch(app) });

    await expect(authService.getSession()).resolves.toBeNull();
    render(<App authService={authService} hubRoute={hubRoute} />);

    fireEvent.change(screen.getByLabelText('Identificador de acesso'), { target: { value: 'coord@example.invalid' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'SyntheticPassword!123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('heading', { name: 'Área inicial' })).toBeTruthy();
    expect(screen.getByText('Synthetic Coordinator')).toBeTruthy();
    await expect(authService.getSession()).resolves.toMatchObject({
      operator: { loginIdentifier: 'coord@example.invalid', profiles: ['COORDINATOR'] },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    expect(await screen.findByRole('heading', { name: 'Acessar sistema' })).toBeTruthy();
    await expect(authService.getSession()).resolves.toBeNull();
  });

  it('shows neutral invalid credentials and never renders protected content', async () => {
    const app = createApp({ checkDatabase: async () => {} });
    onTestFinished(() => app.close());
    const authService = createHttpAuthService({ fetchClient: createIntegratedFetch(app) });
    render(<App authService={authService} hubRoute={hubRoute} />);

    fireEvent.change(screen.getByLabelText('Identificador de acesso'), { target: { value: 'unknown@example.invalid' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'WrongSyntheticPassword!123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect((await screen.findByRole('alert')).textContent)
      .toBe('Não foi possível acessar com os dados informados. Confira e tente novamente.');
    expect(screen.queryByRole('heading', { name: 'Área inicial' })).toBeNull();
  });

  it('shows safe login recovery when synthetic transport is unavailable', async () => {
    const app = createApp({ checkDatabase: async () => {} });
    onTestFinished(() => app.close());
    const authService = createHttpAuthService({
      fetchClient: async () => { throw new Error('Synthetic transport failure.'); },
    });
    render(<App authService={authService} hubRoute={hubRoute} />);

    fireEvent.change(screen.getByLabelText('Identificador de acesso'), { target: { value: 'coord@example.invalid' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'SyntheticPassword!123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect((await screen.findByRole('alert')).textContent)
      .toBe('Não foi possível acessar o sistema. Tente novamente em instantes.');
    expect(screen.queryByRole('heading', { name: 'Área inicial' })).toBeNull();
  });

  it('redirects direct protected navigation without a Fastify session', async () => {
    const app = createApp({ checkDatabase: async () => {} });
    onTestFinished(() => app.close());
    const authService = createHttpAuthService({ fetchClient: createIntegratedFetch(app) });
    window.history.replaceState({}, '', '/hub');

    render(<App authService={authService} hubRoute={hubRoute} />);

    expect(await screen.findByRole('heading', { name: 'Acessar sistema' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Área inicial' })).toBeNull();
    expect(window.location.pathname).toBe('/login');
  });

  it('shows neutral recovery after Fastify rejects logout CSRF', async () => {
    const app = createApp({
      checkDatabase: async () => {},
      seedUsers: [{
        id: '01963000-0000-7000-8000-000000000007',
        loginIdentifier: 'coord@example.invalid',
        displayName: 'Synthetic Coordinator',
        password: 'SyntheticPassword!123',
        profiles: ['COORDINATOR'],
      }],
    });
    onTestFinished(() => app.close());
    const authService = createHttpAuthService({
      fetchClient: createIntegratedFetch(app, {
        transformRequest: (input, init) => {
          if (input !== '/api/v1/auth/logout') return init;
          const headers = new Headers(init.headers);
          headers.set('X-CSRF-Token', 'synthetic-invalid-csrf-verifier');
          return { ...init, headers };
        },
      }),
    });
    render(<App authService={authService} hubRoute={hubRoute} />);

    fireEvent.change(screen.getByLabelText('Identificador de acesso'), { target: { value: 'coord@example.invalid' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'SyntheticPassword!123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('heading', { name: 'Área inicial' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Não foi possível concluir a saída. Tente acessar novamente.');
    expect(screen.queryByRole('heading', { name: 'Área inicial' })).toBeNull();
    expect(screen.queryByText('CSRF_REJECTED')).toBeNull();
    expect(screen.queryByText('synthetic-invalid-csrf-verifier')).toBeNull();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('shows neutral recovery when logout transport becomes unavailable', async () => {
    const app = createApp({
      checkDatabase: async () => {},
      seedUsers: [{
        id: '01963000-0000-7000-8000-000000000008',
        loginIdentifier: 'coord@example.invalid',
        displayName: 'Synthetic Coordinator',
        password: 'SyntheticPassword!123',
        profiles: ['COORDINATOR'],
      }],
    });
    onTestFinished(() => app.close());
    const integratedFetch = createIntegratedFetch(app);
    const authService = createHttpAuthService({
      fetchClient: async (input, init) => {
        if (input === '/api/v1/auth/logout') throw new Error('Synthetic logout transport failure.');
        return integratedFetch(input, init);
      },
    });
    render(<App authService={authService} hubRoute={hubRoute} />);

    fireEvent.change(screen.getByLabelText('Identificador de acesso'), { target: { value: 'coord@example.invalid' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'SyntheticPassword!123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('heading', { name: 'Área inicial' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Não foi possível concluir a saída. Tente acessar novamente.');
    expect(screen.queryByRole('heading', { name: 'Área inicial' })).toBeNull();
    expect(screen.queryByText('Synthetic logout transport failure.')).toBeNull();
  });

  it('routes an authenticated operator without the required profile to access denied', async () => {
    const app = createApp({
      checkDatabase: async () => {},
      seedUsers: [{
        id: '01963000-0000-7000-8000-000000000002',
        loginIdentifier: 'activity@example.invalid',
        displayName: 'Synthetic Activity Operator',
        password: 'SyntheticPassword!123',
        profiles: ['PERIODIC_ACTIVITY'],
      }],
    });
    onTestFinished(() => app.close());
    const authService = createHttpAuthService({ fetchClient: createIntegratedFetch(app) });
    await authService.signIn({
      loginIdentifier: 'activity@example.invalid',
      password: 'SyntheticPassword!123',
    });
    window.history.replaceState({}, '', '/hub');

    render(<App authService={authService} hubRoute={hubRoute} />);

    expect(await screen.findByRole('heading', { name: 'Acesso não permitido' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Área inicial' })).toBeNull();
  });

  it('removes protected content when Fastify revokes an active browser session', async () => {
    const operatorId = '01963000-0000-7000-8000-000000000003';
    const app = createApp({
      checkDatabase: async () => {},
      seedUsers: [
        {
          id: '01963000-0000-7000-8000-000000000004',
          loginIdentifier: 'admin@example.invalid',
          displayName: 'Synthetic Administrator',
          password: 'SyntheticPassword!123',
          profiles: ['ADMIN'],
        },
        {
          id: operatorId,
          loginIdentifier: 'coord@example.invalid',
          displayName: 'Synthetic Coordinator',
          password: 'SyntheticPassword!123',
          profiles: ['COORDINATOR'],
        },
      ],
    });
    onTestFinished(() => app.close());
    const authService = createHttpAuthService({ fetchClient: createIntegratedFetch(app) });
    window.history.replaceState({}, '', '/hub');
    render(<App authService={authService} hubRoute={hubRoute} />);

    expect(await screen.findByRole('heading', { name: 'Acessar sistema' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Identificador de acesso'), { target: { value: 'coord@example.invalid' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'SyntheticPassword!123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('heading', { name: 'Área inicial' })).toBeTruthy();

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginIdentifier: 'admin@example.invalid', password: 'SyntheticPassword!123' },
    });
    const adminToken = readSessionToken(adminLogin.json());
    const deactivation = await app.inject({
      method: 'POST',
      url: `/api/v1/users/${operatorId}/deactivate`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        'idempotency-key': '01963000-0000-7000-8000-000000000105',
      },
      payload: { version: 1, reason: 'Synthetic access review.' },
    });
    expect(deactivation.statusCode).toBe(200);

    fireEvent(document, new Event('visibilitychange'));
    expect(await screen.findByRole('heading', { name: 'Acessar sistema' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Área inicial' })).toBeNull();
  });

  it('routes to access denied when Fastify removes the active route profile', async () => {
    const operatorId = '01963000-0000-7000-8000-000000000005';
    const app = createApp({
      checkDatabase: async () => {},
      seedUsers: [
        {
          id: '01963000-0000-7000-8000-000000000006',
          loginIdentifier: 'admin@example.invalid',
          displayName: 'Synthetic Administrator',
          password: 'SyntheticPassword!123',
          profiles: ['ADMIN'],
        },
        {
          id: operatorId,
          loginIdentifier: 'coord@example.invalid',
          displayName: 'Synthetic Coordinator',
          password: 'SyntheticPassword!123',
          profiles: ['COORDINATOR'],
        },
      ],
    });
    onTestFinished(() => app.close());
    const authService = createHttpAuthService({ fetchClient: createIntegratedFetch(app) });
    window.history.replaceState({}, '', '/hub');
    render(<App authService={authService} hubRoute={hubRoute} />);

    expect(await screen.findByRole('heading', { name: 'Acessar sistema' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Identificador de acesso'), { target: { value: 'coord@example.invalid' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'SyntheticPassword!123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('heading', { name: 'Área inicial' })).toBeTruthy();

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginIdentifier: 'admin@example.invalid', password: 'SyntheticPassword!123' },
    });
    const adminToken = readSessionToken(adminLogin.json());
    const profileUpdate = await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${operatorId}/profiles`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        'idempotency-key': '01963000-0000-7000-8000-000000000106',
      },
      payload: {
        version: 1,
        profiles: ['PERIODIC_ACTIVITY'],
        reason: 'Synthetic route access review.',
      },
    });
    expect(profileUpdate.statusCode).toBe(200);

    fireEvent(document, new Event('visibilitychange'));
    expect(await screen.findByRole('heading', { name: 'Acesso não permitido' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Área inicial' })).toBeNull();
  });
});
