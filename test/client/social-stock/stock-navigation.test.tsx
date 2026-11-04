import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../../../src/client/app.tsx';
import type { AuthService, AuthSession } from '../../../src/client/auth/auth-state.ts';
import type { StockRouteName } from '../../../src/client/navigation/routes.ts';

function createSession(): AuthSession {
  return {
    expiresAt: '2099-10-25T12:30:00.000Z',
    operator: {
      loginIdentifier: 'coord@example.invalid',
      displayName: 'Synthetic Coordinator',
      profiles: ['COORDINATOR'],
    },
  };
}

const unauthenticatedAuthService: AuthService = {
  hasPendingSignOut: () => false,
  getCsrfToken: () => null,
  signIn: async () => ({ status: 'invalid-credentials' }),
  getSession: async () => null,
  signOut: async () => undefined,
};

const authenticatedAuthService: AuthService = {
  hasPendingSignOut: () => false,
  getCsrfToken: () => 'synthetic-csrf-token',
  signIn: async () => ({ status: 'authenticated', session: createSession() }),
  getSession: async () => createSession(),
  signOut: vi.fn(async () => undefined),
};

function renderStockRoute(name: StockRouteName) {
  return <main><h1>{`Stock stub: ${name}`}</h1></main>;
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/login');
});

it('redirects an unauthenticated stock catalog visit to login', async () => {
  window.history.replaceState({}, '', '/stock/catalog');
  render(<App authService={unauthenticatedAuthService} renderStockRoute={renderStockRoute} />);

  expect(await screen.findByRole('heading', { name: 'Acessar sistema' })).toBeTruthy();
  expect(window.location.pathname).toBe('/login');
});

it('renders the injected stock route for an authenticated operator', async () => {
  window.history.replaceState({}, '', '/stock/origins');
  render(<App authService={authenticatedAuthService} renderStockRoute={renderStockRoute} />);

  expect(await screen.findByRole('heading', { name: 'Stock stub: stock-origins' })).toBeTruthy();
  expect(window.location.pathname).toBe('/stock/origins');
});

it('keeps the hub landing page unchanged', async () => {
  window.history.replaceState({}, '', '/hub');
  render(<App authService={authenticatedAuthService} renderStockRoute={renderStockRoute} />);

  expect(await screen.findByRole('heading', { name: 'Área inicial' })).toBeTruthy();
});
