// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { PersonDetail } from '@erp/contracts/registration';
import { ErpProvider } from '../../../../src/app/erp-provider';
import { createDemoClient } from '../../../../src/demo/create-demo-client';
import { PersonPage } from '../../../../src/registration';

afterEach(cleanup);

async function renderPersonPage(detail?: Promise<PersonDetail>) {
  const client = createDemoClient();
  const account = client.access
    .demoAccounts()
    .find((candidate) => candidate.roles.includes('SOCIAL_ASSISTANCE'));

  if (!account) throw new Error('Social assistance account was not found');

  client.access.enterDemo(account.id);
  const [person] = await client.registration.listPeople();

  if (!person) throw new Error('Demo person was not found');

  const personDetail = await client.registration.getPerson(person.id);
  if (detail) client.registration.getPerson = () => detail;

  render(
    <ErpProvider client={client}>
      <MemoryRouter initialEntries={[`/people/${person.id}`]}>
        <Routes>
          <Route path="people/:id" element={<PersonPage />} />
        </Routes>
      </MemoryRouter>
    </ErpProvider>,
  );

  return { person, personDetail };
}

describe('PersonPage', () => {
  it('summarizes known identification data in the profile header and labels current values', async () => {
    const detail: PersonDetail = {
      person: {
        id: 'synthetic-person',
        name: 'Maria Exemplo',
        birthDate: '1990-08-20',
        sex: null,
        cpf: '12345678909',
        rg: 'Documento sintético',
        contactPhone: '(86) 90000-0000',
        occupation: 'Professora',
        educationLevel: 'Ensino superior',
        revision: 1,
        updatedAt: '2026-10-01T12:00:00.000-03:00',
      },
      memberships: [],
    };
    await renderPersonPage(Promise.resolve(detail));
    const header = await screen.findByLabelText('Identificação da pessoa');
    expect(
      within(header).getByRole('heading', { name: 'Maria Exemplo' }),
    ).toBeTruthy();
    expect(within(header).getByText('20/08/1990')).toBeTruthy();
    expect(within(header).getByText('(86) 90000-0000')).toBeTruthy();
    const data = screen.getByLabelText('Dados atuais');
    expect(within(data).getByText('123.456.789-09')).toBeTruthy();
    expect(within(data).getByText('Ocupação')).toBeTruthy();
    expect(within(data).getByText('Professora')).toBeTruthy();
    expect(within(data).getByText('Ensino superior')).toBeTruthy();
  });
  it('shows individual registration data and the current family membership', async () => {
    const { person } = await renderPersonPage();

    expect(
      await screen.findByRole('heading', { name: person.name }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Dados atuais' })).toBeTruthy();
    expect(screen.getAllByText('Não informado')).toHaveLength(7);
    expect(
      screen.getByRole('heading', { name: 'Vínculos familiares' }),
    ).toBeTruthy();
    expect(screen.getByText('Vínculo atual')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Família 1' }).getAttribute('href'),
    ).toContain('/families/');
    expect(screen.getByText('Titular')).toBeTruthy();
  });

  it('keeps previous memberships under progressive disclosure', async () => {
    const client = createDemoClient();
    const account = client.access
      .demoAccounts()
      .find((candidate) => candidate.roles.includes('SOCIAL_ASSISTANCE'));

    if (!account) throw new Error('Social assistance account was not found');

    client.access.enterDemo(account.id);
    const [person] = await client.registration.listPeople();

    if (!person) throw new Error('Demo person was not found');

    const current = await client.registration.getPerson(person.id);
    const historicalMembership = {
      ...current.memberships[0]!,
      id: 'historical-membership',
      familyId: 'historical-family',
      familyCode: '99',
      validFrom: '2026-01-01T00:00:00.000-03:00',
      validUntil: '2026-02-01T00:00:00.000-03:00',
      isReference: false,
      relationshipToReference: 'Filha',
    };
    client.registration.getPerson = async () => ({
      ...current,
      memberships: [...current.memberships, historicalMembership],
    });

    render(
      <ErpProvider client={client}>
        <MemoryRouter initialEntries={[`/people/${person.id}`]}>
          <Routes>
            <Route path="people/:id" element={<PersonPage />} />
          </Routes>
        </MemoryRouter>
      </ErpProvider>,
    );

    const history = await screen.findByRole('group', {
      name: 'Histórico de vínculos',
    });

    expect(history.hasAttribute('open')).toBe(false);
    await userEvent
      .setup()
      .click(within(history).getByText('Ver histórico de vínculos (1)'));
    expect(history.hasAttribute('open')).toBe(true);
    expect(within(history).getByText('Família 99')).toBeTruthy();
    expect(within(history).getByText('Histórico')).toBeTruthy();
  });

  it('shows every current membership and warns when the current context is ambiguous', async () => {
    const client = createDemoClient();
    const account = client.access
      .demoAccounts()
      .find((candidate) => candidate.roles.includes('SOCIAL_ASSISTANCE'));

    if (!account) throw new Error('Social assistance account was not found');

    client.access.enterDemo(account.id);
    const [person] = await client.registration.listPeople();

    if (!person) throw new Error('Demo person was not found');

    const current = await client.registration.getPerson(person.id);
    const ambiguousMembership = {
      ...current.memberships[0]!,
      id: 'ambiguous-membership',
      familyId: 'ambiguous-family',
      familyCode: '77',
      isReference: false,
      relationshipToReference: 'Neta',
    };
    client.registration.getPerson = async () => ({
      ...current,
      memberships: [...current.memberships, ambiguousMembership],
    });

    render(
      <ErpProvider client={client}>
        <MemoryRouter initialEntries={[`/people/${person.id}`]}>
          <Routes>
            <Route path="people/:id" element={<PersonPage />} />
          </Routes>
        </MemoryRouter>
      </ErpProvider>,
    );

    expect(
      await screen.findByText(/Mais de um vínculo familiar vigente/),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Família 1' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Família 77' })).toBeTruthy();
  });

  it('uses shared loading and error states', async () => {
    let resolveDetail: (detail: PersonDetail) => void;
    const pendingDetail = new Promise<PersonDetail>((resolve) => {
      resolveDetail = resolve;
    });
    const { person, personDetail } = await renderPersonPage(pendingDetail);

    expect(screen.getByRole('status').textContent).toBe(
      'Carregando registros…',
    );

    resolveDetail!(personDetail);

    expect(
      await screen.findByRole('heading', { name: person.name }),
    ).toBeTruthy();

    cleanup();
    await renderPersonPage(Promise.reject(new Error('Resource was not found')));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Não foi possível concluir a operação. Tente novamente.',
    );
  });
});
