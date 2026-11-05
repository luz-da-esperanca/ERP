import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../../../src/client/app.tsx';
import type { AuthProfile, AuthService, AuthSession } from '../../../src/client/auth/auth-state.ts';
import { StockApiError, type StockApi } from '../../../src/client/social-stock/stock-api.ts';

const createdAt = '2026-10-26T12:00:00.000Z';

function createSession(profiles: readonly AuthProfile[]): AuthSession {
  return {
    expiresAt: '2099-10-25T12:30:00.000Z',
    operator: { loginIdentifier: 'coord@example.invalid', displayName: 'Synthetic Coordinator', profiles },
  };
}

function authenticatedAuthService(profiles: readonly AuthProfile[]): AuthService {
  return {
    hasPendingSignOut: () => false,
    getCsrfToken: () => 'synthetic-csrf-token',
    signIn: async () => ({ status: 'authenticated', session: createSession(profiles) }),
    getSession: async () => createSession(profiles),
    signOut: vi.fn(async () => undefined),
  };
}

function stubStockApi(overrides: Partial<StockApi> = {}): StockApi {
  const unstubbed = async (): Promise<never> => {
    throw new Error('StockApi method not stubbed.');
  };
  return {
    listOptions: unstubbed,
    getOption: unstubbed,
    createOption: unstubbed,
    listItems: unstubbed,
    getItem: unstubbed,
    createItem: unstubbed,
    listOrigins: unstubbed,
    getOrigin: unstubbed,
    createOrigin: unstubbed,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/login');
});

it('renders the real catalog page for an authenticated stock operator', async () => {
  window.history.replaceState({}, '', '/stock/catalog');
  render(<App
    authService={authenticatedAuthService(['COORDINATOR'])}
    stockApi={stubStockApi({
      listItems: async () => ({ items: [{
        id: 'item-1', code: 'ITEM-000001', revisionId: 'revision-1', version: 1, name: 'Cobertor',
        category: { id: 'category-1', code: 'CAT-000001', name: 'Cama e banho' },
        unit: { id: 'unit-1', code: 'UNIT-000001', name: 'Peça', precision: 0 },
        size: null, isActive: true, createdAt, updatedAt: createdAt,
      }], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 }),
      listOptions: async () => ({ items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }),
    })}
  />);

  expect(await screen.findByText('Cobertor')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Novo item' })).toBeTruthy();
});

it('redirects to login when the stock api reports session expiry', async () => {
  window.history.replaceState({}, '', '/stock/catalog');
  render(<App
    authService={authenticatedAuthService(['COORDINATOR'])}
    stockApi={stubStockApi({
      listItems: async () => {
        throw new StockApiError({ status: 401, code: 'AUTH_REQUIRED', traceId: null, errors: [] });
      },
      listOptions: async () => ({ items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }),
    })}
  />);

  expect(await screen.findByRole('heading', { name: 'Acessar sistema' })).toBeTruthy();
  expect(window.location.pathname).toBe('/login');
});

it('keeps the stock route visible with an access denied message on forbidden', async () => {
  window.history.replaceState({}, '', '/stock/origins');
  render(<App
    authService={authenticatedAuthService(['BAZAR'])}
    stockApi={stubStockApi({
      listOrigins: async () => {
        throw new StockApiError({ status: 403, code: 'FORBIDDEN', traceId: null, errors: [] });
      },
    })}
  />);

  expect(await screen.findByText('Seu perfil não possui permissão para esta operação.')).toBeTruthy();
  expect(window.location.pathname).toBe('/stock/origins');
});

it('hides write actions for read-only profiles while keeping the list', async () => {
  window.history.replaceState({}, '', '/stock/origins');
  render(<App
    authService={authenticatedAuthService(['SOCIAL_ASSISTANCE'])}
    stockApi={stubStockApi({
      listOrigins: async () => ({ items: [{
        id: 'origin-1', kind: 'CAMPAIGN', name: 'Campanha Inverno',
        isExternalDonation: true, isSystemManaged: false, createdAt,
      }], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 }),
    })}
  />);

  expect(await screen.findByText('Campanha Inverno')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Nova origem' })).toBeNull();
});

it('shows write actions for stock distribution profiles', async () => {
  window.history.replaceState({}, '', '/stock/origins');
  render(<App
    authService={authenticatedAuthService(['STOCK_DISTRIBUTION'])}
    stockApi={stubStockApi({
      listOrigins: async () => ({ items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }),
    })}
  />);

  expect(await screen.findByText('Nenhuma origem cadastrada.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Nova origem' })).toBeTruthy();
});
