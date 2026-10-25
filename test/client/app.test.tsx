import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../../src/client/app.tsx';
import type { AuthService } from '../../src/client/auth/auth-state.ts';
import type { ProtectedRouteDefinition } from '../../src/client/navigation/protected-route.tsx';

const hubRoute: ProtectedRouteDefinition = {
  destination: '/hub',
  requiredProfile: 'COORDINATOR',
};

const unauthenticatedAuthService: AuthService = {
  signIn: async () => ({ status: 'invalid-credentials' }),
  getSession: async () => null,
  signOut: async () => undefined,
};

const authenticatedAuthService: AuthService = {
  signIn: async () => ({
    status: 'authenticated',
    session: {
      operator: {
        loginIdentifier: 'kaua.silva',
        displayName: 'Kauã Silva',
        profiles: ['COORDINATOR'],
      },
    },
  }),
  getSession: async () => ({
    operator: {
      loginIdentifier: 'kaua.silva',
      displayName: 'Kauã Silva',
      profiles: ['COORDINATOR'],
    },
  }),
  signOut: vi.fn(async () => undefined),
};

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/login');
});

it('routes a direct hub visit without a session to login', async () => {
  window.history.replaceState({}, '', '/hub');
  render(<App authService={unauthenticatedAuthService} hubRoute={hubRoute} />);

  expect(screen.getByRole('heading', { name: 'Verificando acesso' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Área inicial' })).toBeNull();
  expect(await screen.findByRole('heading', { name: 'Acessar sistema' })).toBeTruthy();
  expect(window.location.pathname).toBe('/login');
});

it('shows the authenticated operator and clears local access before logout navigation', async () => {
  window.history.replaceState({}, '', '/hub');
  render(<App authService={authenticatedAuthService} hubRoute={hubRoute} />);

  expect(await screen.findByRole('heading', { name: 'Área inicial' })).toBeTruthy();
  expect(screen.getByText('Kauã Silva')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Sair' }));

  expect(await screen.findByRole('heading', { name: 'Acessar sistema' })).toBeTruthy();
  expect(authenticatedAuthService.signOut).toHaveBeenCalledOnce();
  expect(window.location.pathname).toBe('/login');
});

it('validates required login fields before requesting authentication', () => {
  window.history.replaceState({}, '', '/login');
  const signIn = vi.fn();
  const authService: AuthService = {
    signIn,
    getSession: async () => null,
    signOut: async () => undefined,
  };
  render(<App authService={authService} hubRoute={hubRoute} />);

  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

  expect(screen.getByText('Informe seu identificador de acesso.')).toBeTruthy();
  expect(screen.getByText('Informe sua senha.')).toBeTruthy();
  expect(signIn).not.toHaveBeenCalled();
});

it('preserves invalid field values and identifies the login field to correct', () => {
  window.history.replaceState({}, '', '/login');
  const signIn = vi.fn();
  const authService: AuthService = {
    signIn,
    getSession: async () => null,
    signOut: async () => undefined,
  };
  render(<App authService={authService} hubRoute={hubRoute} />);

  const loginInput = screen.getByLabelText('Identificador de acesso') as HTMLInputElement;
  fireEvent.change(loginInput, { target: { value: 'ab' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-secreta' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

  expect(screen.getByText('Informe um identificador entre 3 e 120 caracteres, sem espaços.')).toBeTruthy();
  expect(loginInput.value).toBe('ab');
  expect(signIn).not.toHaveBeenCalled();
});

it('uses credential autocomplete fields and shows loading until authentication resolves', async () => {
  window.history.replaceState({}, '', '/login');
  let resolveSignIn: ((result: Awaited<ReturnType<AuthService['signIn']>>) => void) | undefined;
  const signIn = vi.fn(() => new Promise<Awaited<ReturnType<AuthService['signIn']>>>((resolve) => {
    resolveSignIn = resolve;
  }));
  const authService: AuthService = {
    signIn,
    getSession: async () => null,
    signOut: async () => undefined,
  };
  render(<App authService={authService} hubRoute={hubRoute} />);

  const loginInput = screen.getByLabelText('Identificador de acesso');
  const passwordInput = screen.getByLabelText('Senha');
  expect(loginInput.getAttribute('autocomplete')).toBe('username');
  expect(passwordInput.getAttribute('autocomplete')).toBe('current-password');

  fireEvent.change(loginInput, { target: { value: 'kaua.silva' } });
  fireEvent.change(passwordInput, { target: { value: 'senha-secreta' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

  expect(screen.getByRole('button', { name: 'Entrando…' }).hasAttribute('disabled')).toBe(true);
  expect(loginInput.hasAttribute('disabled')).toBe(true);
  expect(passwordInput.hasAttribute('disabled')).toBe(true);

  resolveSignIn?.({ status: 'invalid-credentials' });
  expect(await screen.findByRole('button', { name: 'Entrar' })).toBeTruthy();
});

it('opens the hub after valid sign-in without rendering the submitted password', async () => {
  window.history.replaceState({}, '', '/login');
  const signIn = vi.fn(async () => ({
    status: 'authenticated' as const,
    session: {
      operator: {
        loginIdentifier: 'kaua.silva',
        displayName: 'Kauã Silva',
        profiles: ['COORDINATOR'] as const,
      },
    },
  }));
  const authService: AuthService = {
    signIn,
    getSession: async () => null,
    signOut: async () => undefined,
  };
  render(<App authService={authService} hubRoute={hubRoute} />);

  fireEvent.change(screen.getByLabelText('Identificador de acesso'), { target: { value: 'kaua.silva' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-secreta' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

  expect(await screen.findByRole('heading', { name: 'Área inicial' })).toBeTruthy();
  expect(signIn).toHaveBeenCalledWith({ loginIdentifier: 'kaua.silva', password: 'senha-secreta' });
  expect(screen.queryByText('senha-secreta')).toBeNull();
  expect(window.location.pathname).toBe('/hub');
});

it('keeps a new session when an earlier session lookup resolves after sign-in', async () => {
  window.history.replaceState({}, '', '/login');
  let resolveSession: ((session: null) => void) | undefined;
  const authService: AuthService = {
    signIn: async () => ({
      status: 'authenticated',
      session: {
        operator: {
          loginIdentifier: 'kaua.silva',
          displayName: 'Kauã Silva',
          profiles: ['COORDINATOR'],
        },
      },
    }),
    getSession: async () => new Promise<null>((resolve) => { resolveSession = resolve; }),
    signOut: async () => undefined,
  };
  render(<App authService={authService} hubRoute={hubRoute} />);

  fireEvent.change(screen.getByLabelText('Identificador de acesso'), { target: { value: 'kaua.silva' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-secreta' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

  expect(await screen.findByRole('heading', { name: 'Área inicial' })).toBeTruthy();
  resolveSession?.(null);

  await waitFor(() => expect(screen.getByRole('heading', { name: 'Área inicial' })).toBeTruthy());
  expect(window.location.pathname).toBe('/hub');
});

it('shows a neutral error for invalid credentials without exposing the submitted password', async () => {
  window.history.replaceState({}, '', '/login');
  const authService: AuthService = {
    signIn: async () => ({ status: 'invalid-credentials' }),
    getSession: async () => null,
    signOut: async () => undefined,
  };
  render(<App authService={authService} hubRoute={hubRoute} />);

  fireEvent.change(screen.getByLabelText('Identificador de acesso'), { target: { value: 'kaua.silva' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-secreta' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

  expect((await screen.findByRole('alert')).textContent)
    .toBe('Não foi possível acessar com os dados informados. Confira e tente novamente.');
  expect(screen.queryByText('senha-secreta')).toBeNull();
});

it('shows a safe recovery message when authentication is unavailable', async () => {
  window.history.replaceState({}, '', '/login');
  const authService: AuthService = {
    signIn: async () => ({ status: 'unavailable' }),
    getSession: async () => null,
    signOut: async () => undefined,
  };
  render(<App authService={authService} hubRoute={hubRoute} />);

  fireEvent.change(screen.getByLabelText('Identificador de acesso'), { target: { value: 'kaua.silva' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-secreta' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

  expect((await screen.findByRole('alert')).textContent)
    .toBe('Não foi possível acessar o sistema. Tente novamente em instantes.');
  expect(screen.queryByText('senha-secreta')).toBeNull();
});

it('routes an authenticated operator without the required profile to access denied', async () => {
  window.history.replaceState({}, '', '/hub');
  const authService: AuthService = {
    signIn: async () => ({ status: 'invalid-credentials' }),
    getSession: async () => ({
      operator: {
        loginIdentifier: 'kaua.silva',
        displayName: 'Kauã Silva',
        profiles: ['PERIODIC_ACTIVITY'],
      },
    }),
    signOut: async () => undefined,
  };
  render(<App authService={authService} hubRoute={hubRoute} />);

  expect(await screen.findByRole('heading', { name: 'Acesso não permitido' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Área inicial' })).toBeNull();
  expect(window.location.pathname).toBe('/access-denied');
});

it('hides protected content when session verification is unavailable', async () => {
  window.history.replaceState({}, '', '/hub');
  const authService: AuthService = {
    signIn: async () => ({ status: 'unavailable' }),
    getSession: async () => { throw new Error('network unavailable'); },
    signOut: async () => undefined,
  };
  render(<App authService={authService} hubRoute={hubRoute} />);

  expect(await screen.findByRole('heading', { name: 'Não foi possível verificar o acesso' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Área inicial' })).toBeNull();
});
