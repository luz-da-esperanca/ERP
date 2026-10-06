// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import type { FamilySummary } from '@erp/contracts/registration';
import { ErpProvider } from '../../../../src/app/erp-provider';
import { createDemoClient } from '../../../../src/demo/create-demo-client';
import { FamiliesPage } from '../../../../src/registration';

function createFamily(index: number): FamilySummary {
  return {
    id: `family-${index}`,
    code: `${1000 + index}`,
    referenceName: `Family ${index}`,
    address: null,
    neighborhood: index % 2 ? 'Centro' : 'Tabuleiro',
    postalCode: null,
    location: 'URBAN',
    contactPhone: null,
    revision: 1,
    createdAt: '2026-10-01T12:00:00.000-03:00',
    updatedAt: '2026-10-02T12:00:00.000-03:00',
    memberCount: index,
    referencePersonName: `Reference person ${index}`,
  };
}

function renderFamiliesPage(families: Promise<FamilySummary[]>) {
  const client = createDemoClient();
  const account = client.access
    .demoAccounts()
    .find((candidate) => candidate.roles.includes('SOCIAL_ASSISTANCE'));

  if (!account) throw new Error('Social assistance account was not found');

  client.access.enterDemo(account.id);
  client.registration.listFamilies = () => families;

  return render(
    <ErpProvider client={client}>
      <MemoryRouter>
        <FamiliesPage />
      </MemoryRouter>
    </ErpProvider>,
  );
}

describe('FamiliesPage', () => {
  afterEach(cleanup);

  it('shows the loading state before displaying the family list', async () => {
    let resolveFamilies: (families: FamilySummary[]) => void;
    const families = new Promise<FamilySummary[]>((resolve) => {
      resolveFamilies = resolve;
    });

    renderFamiliesPage(families);

    expect(screen.getByRole('status').textContent).toBe(
      'Carregando registros…',
    );

    resolveFamilies!([createFamily(1)]);

    expect(
      (await screen.findByRole('link', { name: 'Family 1' })).getAttribute(
        'href',
      ),
    ).toBe('/families/family-1');
  });

  it('renders family data and preserves the existing family search', async () => {
    const user = userEvent.setup();
    renderFamiliesPage(Promise.resolve([createFamily(1), createFamily(2)]));

    expect(await screen.findByRole('link', { name: 'Family 1' })).toBeTruthy();
    expect(screen.getByText('Reference person 1')).toBeTruthy();
    expect(screen.getAllByText('Pendente')).toHaveLength(2);

    await user.type(
      screen.getByRole('textbox', { name: 'Buscar famílias' }),
      'family 2',
    );

    expect(screen.queryByRole('link', { name: 'Family 1' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Family 2' })).toBeTruthy();
  });

  it('shows an empty state without pagination when no family matches the search', async () => {
    const user = userEvent.setup();
    renderFamiliesPage(Promise.resolve([createFamily(1)]));

    await screen.findByRole('link', { name: 'Family 1' });
    await user.type(
      screen.getByRole('textbox', { name: 'Buscar famílias' }),
      'absent family',
    );

    expect(screen.getByText('Nenhuma família encontrada.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Anterior' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Próxima' })).toBeNull();
  });

  it('moves through the existing local pagination without inventing a remote total', async () => {
    const user = userEvent.setup();
    renderFamiliesPage(
      Promise.resolve(
        Array.from({ length: 21 }, (_, index) => createFamily(index + 1)),
      ),
    );

    await screen.findByRole('link', { name: 'Family 1' });
    expect(screen.queryByRole('link', { name: 'Family 21' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Próxima' }));

    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Family 21' })).toBeTruthy(),
    );
    expect(screen.queryByRole('link', { name: 'Family 1' })).toBeNull();
    expect(screen.getByText('Página 2')).toBeTruthy();
  });

  it('shows the query error using the shared feedback pattern', async () => {
    renderFamiliesPage(Promise.reject(new Error('Unable to load families')));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Não foi possível concluir a operação. Tente novamente.',
    );
  });
});
