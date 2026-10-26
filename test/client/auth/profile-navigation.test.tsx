import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { App } from '../../../src/client/app.tsx';
import type { AuthProfile, AuthService, AuthSession } from '../../../src/client/auth/auth-state.ts';

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/login');
});

function serviceFor(profile: AuthProfile): AuthService {
  const session: AuthSession = { expiresAt: '2099-10-25T12:00:00.000Z', operator: {
    loginIdentifier: 'synthetic.operator', displayName: 'Synthetic Operator', profiles: [profile],
  } };
  return { hasPendingSignOut: () => false, signIn: async () => ({ status: 'authenticated', session }),
    getSession: async () => session, signOut: async () => {} };
}

const profiles: readonly AuthProfile[] = ['COORDINATOR', 'SOCIAL_ASSISTANCE', 'PERIODIC_ACTIVITY',
  'POINT_IN_TIME_SERVICE', 'STOCK_DISTRIBUTION', 'BAZAR', 'ADMIN'];

it.each(profiles)('provides the default authenticated landing page and logout to %s', async (profile) => {
  window.history.replaceState({}, '', '/login');
  render(<App authService={serviceFor(profile)} />);
  fireEvent.change(screen.getByLabelText('Identificador de acesso'), { target: { value: 'synthetic.operator' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'SyntheticPassword!123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  expect(await screen.findByRole('heading', { name: 'Área inicial' })).toBeTruthy();
  expect(window.location.pathname).toBe('/hub');
  expect(screen.getByText('Synthetic Operator')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
  expect(await screen.findByRole('heading', { name: 'Acessar sistema' })).toBeTruthy();
});

it('preserves explicit feature restrictions and offers logout from the denial page', async () => {
  window.history.replaceState({}, '', '/projects');
  render(<App authService={serviceFor('ADMIN')}
    hubRoute={{ destination: '/projects', requiredProfile: 'COORDINATOR' }} />);
  expect(await screen.findByRole('heading', { name: 'Acesso não permitido' })).toBeTruthy();
  expect(screen.queryByText('Synthetic Operator')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
  expect(await screen.findByRole('heading', { name: 'Acessar sistema' })).toBeTruthy();
});
