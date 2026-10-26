import { act } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../../src/client/app.tsx';
import type { AuthService, AuthSession } from '../../src/client/auth/auth-state.ts';
import type { ProtectedRouteDefinition } from '../../src/client/navigation/protected-route.tsx';

const hubRoute: ProtectedRouteDefinition = {
  destination: '/hub',
  requiredProfile: 'COORDINATOR',
};

const LOGOUT_RECOVERY_MESSAGE = 'Não foi possível concluir a saída. Tente sair novamente.';

function createSession(
  profiles: readonly AuthSession['operator']['profiles'][number][] = ['COORDINATOR'],
  expiresAt = '2099-10-25T12:30:00.000Z',
): AuthSession {
  return {
    expiresAt,
    operator: {
      loginIdentifier: 'kaua.silva',
      displayName: 'Kauã Silva',
      profiles,
    },
  };
}

const unauthenticatedAuthService: AuthService = {
  hasPendingSignOut: () => false,
  signIn: async () => ({ status: 'invalid-credentials' }),
  getSession: async () => null,
  signOut: async () => undefined,
};

const authenticatedAuthService: AuthService = {
  hasPendingSignOut: () => false,
  signIn: async () => ({
    status: 'authenticated',
    session: createSession(),
  }),
  getSession: async () => createSession(),
  signOut: vi.fn(async () => undefined),
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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

it('removes protected content before a pending failed logout shows neutral recovery', async () => {
  window.history.replaceState({}, '', '/hub');
  let rejectSignOut: ((reason?: unknown) => void) | undefined;
  const authService: AuthService = {
    hasPendingSignOut: () => false,
    signIn: async () => ({ status: 'invalid-credentials' }),
    getSession: async () => createSession(),
    signOut: () => new Promise((_resolve, reject) => { rejectSignOut = reject; }),
  };
  render(<App authService={authService} hubRoute={hubRoute} />);

  expect(await screen.findByRole('heading', { name: 'Área inicial' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Sair' }));

  expect(screen.getByRole('heading', { name: 'Encerrando sessão' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Área inicial' })).toBeNull();
  expect(window.location.pathname).toBe('/login');

  rejectSignOut?.(new Error('Synthetic unavailable logout.'));

  expect((await screen.findByRole('alert')).textContent).toBe(LOGOUT_RECOVERY_MESSAGE);
});

it('keeps the same neutral logout recovery for CSRF rejection without rendering secrets', async () => {
  window.history.replaceState({}, '', '/hub');
  const authService: AuthService = {
    hasPendingSignOut: () => false,
    signIn: async () => ({ status: 'invalid-credentials' }),
    getSession: async () => createSession(),
    signOut: async () => { throw new Error('CSRF_REJECTED synthetic-csrf-verifier'); },
  };
  render(<App authService={authService} hubRoute={hubRoute} />);

  expect(await screen.findByRole('heading', { name: 'Área inicial' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Sair' }));

  expect((await screen.findByRole('alert')).textContent).toBe(LOGOUT_RECOVERY_MESSAGE);
  expect(screen.queryByText('CSRF_REJECTED')).toBeNull();
  expect(screen.queryByText('synthetic-csrf-verifier')).toBeNull();
  expect(window.localStorage.length).toBe(0);
  expect(window.sessionStorage.length).toBe(0);
});

it('waits for logout confirmation before allowing another login', async () => {
  window.history.replaceState({}, '', '/hub');
  let resolveSignOut: (() => void) | undefined;
  const authService: AuthService = {
    hasPendingSignOut: () => false,
    signIn: async () => ({ status: 'authenticated', session: createSession() }),
    getSession: async () => createSession(),
    signOut: () => new Promise((resolve) => { resolveSignOut = resolve; }),
  };
  render(<App authService={authService} hubRoute={hubRoute} />);

  expect(await screen.findByRole('heading', { name: 'Área inicial' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
  expect(screen.getByRole('heading', { name: 'Encerrando sessão' })).toBeTruthy();
  expect(screen.queryByLabelText('Senha')).toBeNull();
  await act(async () => { resolveSignOut?.(); });
  expect(await screen.findByRole('heading', { name: 'Acessar sistema' })).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Identificador de acesso'), { target: { value: 'kaua.silva' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-secreta' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

  expect(await screen.findByRole('heading', { name: 'Área inicial' })).toBeTruthy();
  expect(screen.queryByText(LOGOUT_RECOVERY_MESSAGE)).toBeNull();
  expect(window.location.pathname).toBe('/hub');
});

it('validates required login fields before requesting authentication', () => {
  window.history.replaceState({}, '', '/login');
  const signIn = vi.fn();
  const authService: AuthService = {
    hasPendingSignOut: () => false,
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

it('presents the institutional login and lets the operator reveal the password temporarily', () => {
  window.history.replaceState({}, '', '/login');
  render(<App authService={unauthenticatedAuthService} hubRoute={hubRoute} />);

  expect(screen.getByRole('img', { name: 'Luz da Esperança' })).toBeTruthy();
  const passwordInput = screen.getByLabelText('Senha') as HTMLInputElement;
  const passwordVisibility = screen.getByRole('button', { name: 'Mostrar senha' });

  expect(passwordInput.type).toBe('password');
  fireEvent.click(passwordVisibility);
  expect(passwordInput.type).toBe('text');
  expect(screen.getByRole('button', { name: 'Ocultar senha' })).toBeTruthy();
});

it('preserves invalid field values and identifies the login field to correct', () => {
  window.history.replaceState({}, '', '/login');
  const signIn = vi.fn();
  const authService: AuthService = {
    hasPendingSignOut: () => false,
    signIn,
    getSession: async () => null,
    signOut: async () => undefined,
  };
  render(<App authService={authService} hubRoute={hubRoute} />);

  const loginInput = screen.getByLabelText('Identificador de acesso') as HTMLInputElement;
  fireEvent.change(loginInput, { target: { value: 'ab' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-secreta' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

  expect(screen.getByText('Informe um identificador entre 3 e 120 caracteres.')).toBeTruthy();
  expect(loginInput.value).toBe('ab');
  expect(signIn).not.toHaveBeenCalled();
});

it('submits a login identifier with internal spaces allowed by C-02', async () => {
  window.history.replaceState({}, '', '/login');
  const signIn = vi.fn(async () => ({ status: 'invalid-credentials' as const }));
  const authService: AuthService = {
    hasPendingSignOut: () => false,
    signIn,
    getSession: async () => null,
    signOut: async () => undefined,
  };
  render(<App authService={authService} hubRoute={hubRoute} />);

  fireEvent.change(screen.getByLabelText('Identificador de acesso'), { target: { value: 'synthetic operator' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'SyntheticPassword!123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

  await waitFor(() => expect(signIn).toHaveBeenCalledWith({
    loginIdentifier: 'synthetic operator',
    password: 'SyntheticPassword!123',
  }));
});

it('uses credential autocomplete fields and shows loading until authentication resolves', async () => {
  window.history.replaceState({}, '', '/login');
  let resolveSignIn: ((result: Awaited<ReturnType<AuthService['signIn']>>) => void) | undefined;
  const signIn = vi.fn(() => new Promise<Awaited<ReturnType<AuthService['signIn']>>>((resolve) => {
    resolveSignIn = resolve;
  }));
  const authService: AuthService = {
    hasPendingSignOut: () => false,
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
    session: createSession(),
  }));
  const authService: AuthService = {
    hasPendingSignOut: () => false,
    signIn,
    getSession: async () => createSession(),
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

it('revalidates before mounting protected content after sign-in', async () => {
  window.history.replaceState({}, '', '/login');
  const authService: AuthService = {
    hasPendingSignOut: () => false,
    signIn: async () => ({
      status: 'authenticated',
      session: createSession(),
    }),
    getSession: async () => createSession(),
    signOut: async () => undefined,
  };
  render(<App authService={authService} hubRoute={hubRoute} />);

  fireEvent.change(screen.getByLabelText('Identificador de acesso'), { target: { value: 'kaua.silva' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-secreta' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

  expect(await screen.findByRole('heading', { name: 'Área inicial' })).toBeTruthy();
  expect(window.location.pathname).toBe('/hub');
});

it('shows a neutral error for invalid credentials without exposing the submitted password', async () => {
  window.history.replaceState({}, '', '/login');
  const authService: AuthService = {
    hasPendingSignOut: () => false,
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
    hasPendingSignOut: () => false,
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
    hasPendingSignOut: () => false,
    signIn: async () => ({ status: 'invalid-credentials' }),
    getSession: async () => createSession(['PERIODIC_ACTIVITY']),
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
    hasPendingSignOut: () => false,
    signIn: async () => ({ status: 'unavailable' }),
    getSession: async () => { throw new Error('network unavailable'); },
    signOut: async () => undefined,
  };
  render(<App authService={authService} hubRoute={hubRoute} />);

  expect(await screen.findByRole('heading', { name: 'Não foi possível verificar o acesso' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Área inicial' })).toBeNull();
});

it('removes protected content when the published session expiry is reached', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-25T12:00:00.000Z'));
  window.history.replaceState({}, '', '/hub');
  const authService: AuthService = {
    hasPendingSignOut: () => false,
    signIn: async () => ({ status: 'invalid-credentials' }),
    getSession: async () => createSession(['COORDINATOR'], '2026-10-25T12:01:00.000Z'),
    signOut: async () => undefined,
  };
  render(<App authService={authService} hubRoute={hubRoute} />);

  await act(async () => { await Promise.resolve(); });
  expect(screen.getByRole('heading', { name: 'Área inicial' })).toBeTruthy();

  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });

  expect(screen.getByRole('heading', { name: 'Acessar sistema' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Área inicial' })).toBeNull();
  expect(window.location.pathname).toBe('/login');
});

it('removes protected content when foreground revalidation loses the session', async () => {
  window.history.replaceState({}, '', '/hub');
  const getSession = vi.fn<() => Promise<AuthSession | null>>()
    .mockResolvedValueOnce(createSession())
    .mockResolvedValueOnce(null);
  const authService: AuthService = {
    hasPendingSignOut: () => false,
    signIn: async () => ({ status: 'invalid-credentials' }),
    getSession,
    signOut: async () => undefined,
  };
  render(<App authService={authService} hubRoute={hubRoute} />);

  expect(await screen.findByRole('heading', { name: 'Área inicial' })).toBeTruthy();
  fireEvent(document, new Event('visibilitychange'));

  expect(await screen.findByRole('heading', { name: 'Acessar sistema' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Área inicial' })).toBeNull();
  expect(getSession).toHaveBeenCalledTimes(2);
});

it('routes to access denied when foreground revalidation removes the required profile', async () => {
  window.history.replaceState({}, '', '/hub');
  const authService: AuthService = {
    hasPendingSignOut: () => false,
    signIn: async () => ({ status: 'invalid-credentials' }),
    getSession: vi.fn<() => Promise<AuthSession | null>>()
      .mockResolvedValueOnce(createSession())
      .mockResolvedValueOnce(createSession(['PERIODIC_ACTIVITY'])),
    signOut: async () => undefined,
  };
  render(<App authService={authService} hubRoute={hubRoute} />);

  expect(await screen.findByRole('heading', { name: 'Área inicial' })).toBeTruthy();
  fireEvent(document, new Event('visibilitychange'));

  expect(await screen.findByRole('heading', { name: 'Acesso não permitido' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Área inicial' })).toBeNull();
});

it('shows safe recovery when foreground revalidation is unavailable or malformed', async () => {
  window.history.replaceState({}, '', '/hub');
  const malformedSession = Object.assign(createSession(), { expiresAt: 'not-a-date' });
  const authService: AuthService = {
    hasPendingSignOut: () => false,
    signIn: async () => ({ status: 'invalid-credentials' }),
    getSession: vi.fn<() => Promise<AuthSession | null>>()
      .mockResolvedValueOnce(createSession())
      .mockResolvedValueOnce(malformedSession),
    signOut: async () => undefined,
  };
  render(<App authService={authService} hubRoute={hubRoute} />);

  expect(await screen.findByRole('heading', { name: 'Área inicial' })).toBeTruthy();
  fireEvent(document, new Event('visibilitychange'));

  expect(await screen.findByRole('heading', { name: 'Não foi possível verificar o acesso' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Área inicial' })).toBeNull();
});

it('ignores a stale foreground response after a newer session response', async () => {
  window.history.replaceState({}, '', '/hub');
  let resolveEarlier: ((session: AuthSession | null) => void) | undefined;
  const getSession = vi.fn<() => Promise<AuthSession | null>>()
    .mockResolvedValueOnce(createSession())
    .mockImplementationOnce(() => new Promise((resolve) => { resolveEarlier = resolve; }))
    .mockResolvedValueOnce(createSession(['COORDINATOR'], '2099-10-25T13:30:00.000Z'));
  const authService: AuthService = {
    hasPendingSignOut: () => false,
    signIn: async () => ({ status: 'invalid-credentials' }),
    getSession,
    signOut: async () => undefined,
  };
  render(<App authService={authService} hubRoute={hubRoute} />);

  expect(await screen.findByRole('heading', { name: 'Área inicial' })).toBeTruthy();
  fireEvent(document, new Event('visibilitychange'));
  fireEvent(document, new Event('visibilitychange'));
  expect(await screen.findByRole('heading', { name: 'Área inicial' })).toBeTruthy();

  resolveEarlier?.(null);
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Área inicial' })).toBeTruthy());
  expect(getSession).toHaveBeenCalledTimes(3);
});

it('cancels an older expiry timer after a newer session response', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-25T12:00:00.000Z'));
  window.history.replaceState({}, '', '/hub');
  const authService: AuthService = {
    hasPendingSignOut: () => false,
    signIn: async () => ({ status: 'invalid-credentials' }),
    getSession: vi.fn<() => Promise<AuthSession | null>>()
      .mockResolvedValueOnce(createSession(['COORDINATOR'], '2026-10-25T12:01:00.000Z'))
      .mockResolvedValueOnce(createSession(['COORDINATOR'], '2026-10-25T12:10:00.000Z')),
    signOut: async () => undefined,
  };
  render(<App authService={authService} hubRoute={hubRoute} />);

  await act(async () => { await Promise.resolve(); });
  fireEvent(document, new Event('visibilitychange'));
  await act(async () => { await Promise.resolve(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });

  expect(screen.getByRole('heading', { name: 'Área inicial' })).toBeTruthy();
});
