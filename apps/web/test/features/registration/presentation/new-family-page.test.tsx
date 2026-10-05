// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Role } from '@erp/contracts/access';
import { ApplicationError } from '@erp/contracts/common';
import type { ErpClient } from '../../../../src/app/erp-client';
import { ErpProvider } from '../../../../src/app/erp-provider';
import { createDemoClient } from '../../../../src/demo/create-demo-client';
import { NewFamilyPage } from '../../../../src/registration';

function LocationProbe() {
  const location = useLocation();

  return <output aria-label="Localização atual">{location.pathname}</output>;
}

function renderNewFamilyPage(
  role: Role,
  configureClient?: (client: ErpClient) => void,
) {
  const client = createDemoClient();
  const account = client.access
    .demoAccounts()
    .find((demoAccount) => demoAccount.roles.includes(role));

  if (!account) throw new Error('Demo account was not found');

  configureClient?.(client);
  client.access.enterDemo(account.id);

  render(
    <ErpProvider client={client}>
      <MemoryRouter initialEntries={['/families/new']}>
        <LocationProbe />
        <Routes>
          <Route path="families/new" element={<NewFamilyPage />} />
          <Route path="families/:id" element={<div />} />
        </Routes>
      </MemoryRouter>
    </ErpProvider>,
  );
}

describe('NewFamilyPage', () => {
  it('creates a family with the available registration fields', async () => {
    const user = userEvent.setup();
    renderNewFamilyPage('SOCIAL_ASSISTANCE');

    await user.type(
      screen.getByLabelText('Nome de referência'),
      'Família Nova (fictícia)',
    );
    await user.type(screen.getByLabelText('Bairro'), 'Bairro de teste');
    await user.click(screen.getByRole('button', { name: 'Criar família' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Localização atual').textContent).toMatch(
        /^\/families\/[\w-]+$/,
      );
    });
  });

  it('does not expose the form without registration write permission', () => {
    renderNewFamilyPage('ADMINISTRATOR');

    expect(
      screen.getByText('Seu perfil não permite cadastrar famílias.'),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Nome de referência')).toBeNull();
  });

  it('shows an error when saving the family fails', async () => {
    const user = userEvent.setup();
    renderNewFamilyPage('SOCIAL_ASSISTANCE', (client) => {
      client.registration = {
        ...client.registration,
        async createFamily() {
          throw new ApplicationError(
            'DEPENDENCY_UNAVAILABLE',
            'Registration service is unavailable',
          );
        },
      };
    });

    await user.click(screen.getByRole('button', { name: 'Criar família' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'O serviço está temporariamente indisponível. Tente novamente mais tarde.',
    );
  });
});
