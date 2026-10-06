// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import type { AuditEntry } from '@erp/contracts/audit';
import { ErpProvider } from '../../../../src/app/erp-provider';
import { createDemoClient } from '../../../../src/demo/create-demo-client';
import { FamilyMembersPage, FamilyPage } from '../../../../src/registration';

afterEach(cleanup);

function renderFamilyMembersPage(client = createDemoClient()) {
  const socialAccount = client.access
    .demoAccounts()
    .find((account) => account.roles.includes('SOCIAL_ASSISTANCE'));

  if (!socialAccount)
    throw new Error('Social assistance account was not found');

  client.access.enterDemo(socialAccount.id);

  return client.registration.listFamilies().then(([family]) => {
    if (!family) throw new Error('Demo family was not found');

    render(
      <ErpProvider client={client}>
        <MemoryRouter initialEntries={[`/families/${family.id}/members`]}>
          <Routes>
            <Route
              path="families/:id/members"
              element={<FamilyMembersPage />}
            />
          </Routes>
        </MemoryRouter>
      </ErpProvider>,
    );

    return family;
  });
}

function renderFamilyPage(client = createDemoClient()) {
  const socialAccount = client.access
    .demoAccounts()
    .find((account) => account.roles.includes('SOCIAL_ASSISTANCE'));

  if (!socialAccount)
    throw new Error('Social assistance account was not found');

  client.access.enterDemo(socialAccount.id);

  return client.registration.listFamilies().then(([family]) => {
    if (!family) throw new Error('Demo family was not found');

    render(
      <ErpProvider client={client}>
        <MemoryRouter initialEntries={[`/families/${family.id}`]}>
          <Routes>
            <Route path="families/:id" element={<FamilyPage />} />
          </Routes>
        </MemoryRouter>
      </ErpProvider>,
    );

    return family;
  });
}

describe('FamilyPage', () => {
  it('keeps family destinations in the persistent navigation without duplicate or unavailable links', async () => {
    await renderFamilyPage();

    expect(await screen.findByText('Composição familiar')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Membros' })).toHaveLength(1);
    expect(screen.queryByRole('link', { name: 'Ficha social' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Aptidão familiar' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Adicionar pessoa' })).toBeNull();
  });

  it('groups the current composition with its date filter, count and member list', async () => {
    await renderFamilyPage();

    expect(
      await screen.findByRole('region', { name: 'Composição familiar' }),
    ).toBeTruthy();
    expect(screen.getByLabelText('Data da consulta')).toBeTruthy();
    expect(
      screen.getByText('2 pessoas com vínculo vigente.', { exact: true }),
    ).toBeTruthy();
    expect(
      screen.getByRole('list', { name: 'Membros com vínculo vigente' }),
    ).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('renders current family memberships without flattening membership data into people', async () => {
    const family = await renderFamilyMembersPage();

    expect(
      await screen.findByRole('heading', { name: 'Membros da família' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('table', {
        name: `Membros vigentes da família ${family.code}`,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('navigation', {
        name: 'Navegação do perfil da família',
      }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'Membros' })
        .getAttribute('aria-current'),
    ).toBe('page');
    expect(
      screen
        .getByRole('link', { name: 'Adicionar pessoa' })
        .getAttribute('href'),
    ).toBe(`/people/new?familyId=${family.id}`);
    const memberActions = screen.getByRole('group', {
      name: 'Consulta de membros',
    });

    expect(
      within(memberActions).getByLabelText('Consultar membros em'),
    ).toBeTruthy();
    expect(
      within(memberActions).getByRole('link', { name: 'Adicionar pessoa' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('columnheader', { name: 'Parentesco' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('columnheader', { name: 'Referência' }),
    ).toBeTruthy();
    expect(screen.getAllByText('Ativo')).toHaveLength(2);
  });

  it('uses the shared empty state when no membership is effective on the selected date', async () => {
    const client = createDemoClient();
    const originalGetFamily = client.registration.getFamily;
    client.registration.getFamily = async (id, asOf) => ({
      ...(await originalGetFamily(id, asOf)),
      members: [],
    });

    await renderFamilyMembersPage(client);

    expect(
      await screen.findByText('Sem membros com vínculo vigente nesta data.'),
    ).toBeTruthy();
  });

  it('shows only authorized audit events for the selected family', async () => {
    const client = createDemoClient();
    const socialAccount = client.access
      .demoAccounts()
      .find((account) => account.roles.includes('SOCIAL_ASSISTANCE'));

    if (!socialAccount)
      throw new Error('Social assistance account was not found');

    client.access.enterDemo(socialAccount.id);
    const [family] = await client.registration.listFamilies();

    if (!family) throw new Error('Demo family was not found');

    const familyEvent: AuditEntry = {
      id: 'family-audit-entry',
      entityId: family.id,
      entityLabel: family.referenceName ?? `Família ${family.code}`,
      action: 'UPDATE',
      actorId: socialAccount.id,
      actorName: socialAccount.displayName,
      recordedAt: '2026-10-05T13:00:00.000-03:00',
      occurredAt: '2026-10-05T12:00:00.000-03:00',
      reason: 'Address correction',
      readCapability: 'registration.read',
      before: null,
      after: {},
    };
    const unrelatedEvent: AuditEntry = {
      ...familyEvent,
      id: 'unrelated-audit-entry',
      entityId: 'another-family',
      entityLabel: 'Família não selecionada',
      action: 'CREATE',
    };
    client.audit.list = async () => [unrelatedEvent, familyEvent];

    render(
      <ErpProvider client={client}>
        <MemoryRouter initialEntries={[`/families/${family.id}`]}>
          <Routes>
            <Route path="families/:id" element={<FamilyPage />} />
          </Routes>
        </MemoryRouter>
      </ErpProvider>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Histórico de alterações' }),
    ).toBeTruthy();
    expect(await screen.findByText(/Cadastro atualizado/)).toBeTruthy();
    expect(screen.getByText('Motivo: Address correction')).toBeTruthy();
    expect(screen.queryByText('Família não selecionada')).toBeNull();
  });
});
