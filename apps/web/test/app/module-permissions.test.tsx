// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { ConnectedApp } from '../../src/app/connected-app';
import { HttpErpClient } from '../../src/app/http-erp-client';
import { HttpAuthentication } from '../../src/access';
import { ApiClient } from '../../src/shared/api-client';
afterEach(cleanup);
const user = {
  id: '00000000-0000-4000-8000-000000000001',
  login: 'synthetic',
  displayName: 'Synthetic',
  active: true,
  mustChangePassword: false,
  revision: 1,
  roleCodes: ['ADMINISTRATOR'],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};
it.each([
  '/families/id/social-forms',
  '/families/id/eligibility',
  '/eligibility-policies',
  '/reports',
  '/people/id/memberships',
  '/people/id/sizes',
  '/people/id/reconciliation',
  '/activities/id/attendance/session/correction',
])('blocks %s before querying its protected data', async (path) => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () =>
    Response.json({
      data: {
        user,
        roles: ['ADMINISTRATOR'],
        capabilities: ['accounts.manage'],
      },
    }),
  );
  const api = new ApiClient(fetcher);
  render(
    <MemoryRouter initialEntries={[path]}>
      <ConnectedApp
        client={new HttpErpClient(api)}
        authentication={new HttpAuthentication(api)}
      />
    </MemoryRouter>,
  );
  expect(
    await screen.findByText('Seu perfil não permite acessar esta área.'),
  ).toBeTruthy();
  expect(fetcher).toHaveBeenCalledOnce();
});

it('does not expose the removed tracked-fields screen to coordination', async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () =>
    Response.json({
      data: {
        user: { ...user, roleCodes: ['COORDINATION'] },
        roles: ['COORDINATION'],
        capabilities: ['featureDecisions.manage'],
      },
    }),
  );
  const api = new ApiClient(fetcher);
  render(
    <MemoryRouter>
      <ConnectedApp
        client={new HttpErpClient(api)}
        authentication={new HttpAuthentication(api)}
      />
    </MemoryRouter>,
  );

  await screen.findByRole('navigation');
  expect(screen.queryByRole('link', { name: 'Campos cadastrais' })).toBeNull();
  expect(
    screen.queryByRole('link', { name: 'Configuração da ficha' }),
  ).toBeNull();
  expect(fetcher).toHaveBeenCalledOnce();
});
