// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { FamilySocialFormsPage } from '../../../../src/social-forms';
import type { HttpSocialForms } from '../../../../src/social-forms';
afterEach(cleanup);
it('publishes only selected fields with unknown values and the captured composition and canonical predecessor', async () => {
  const field = {
    fieldKey: 'housing.roomCount',
    included: true,
    required: false,
    appliesTo: 'FAMILY',
    cardinality: 'SINGLE',
  };
  const context = {
    occurredAt: '2026-10-05T12:00:00Z',
    family: { id: 'family', code: '1', referenceName: 'Synthetic' },
    expectedFamilyRevision: 3,
    expectedPreviousVersionId: null,
    fieldSelectionVersionId: '00000000-0000-4000-8000-000000000004',
    referencePersonId: null,
    memberRevisions: [],
    members: [],
    fieldSelection: { id: 'selection', version: 1, fields: [field] },
    options: [],
    latestForm: null,
  };
  const publish = vi.fn().mockResolvedValue({ id: 'saved' });
  const gateway = {
    prepareTemplate: vi.fn().mockResolvedValue({}),
    list: vi.fn().mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 20, total: 0 },
    }),
    context: vi.fn().mockResolvedValue(context),
    publish,
  } as unknown as HttpSocialForms;
  render(
    <MemoryRouter initialEntries={['/families/family/social-forms']}>
      <Routes>
        <Route
          path="/families/:id/social-forms"
          element={<FamilySocialFormsPage gateway={gateway} canWrite />}
        />
      </Routes>
    </MemoryRouter>,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Nova versão' }));
  await user.click(
    screen.getByRole('button', { name: 'Consultar composição' }),
  );
  await screen.findByLabelText('Quantidade de cômodos');
  expect(gateway.prepareTemplate).toHaveBeenCalledOnce();
  expect(screen.queryByText('Saúde física')).toBeNull();
  await user.type(screen.getByLabelText('Quantidade de cômodos'), '3');
  await user.click(screen.getByRole('button', { name: 'Atualizar fichas' }));
  expect(
    (screen.getByLabelText('Quantidade de cômodos') as HTMLInputElement).value,
  ).toBe('3');
  await user.click(
    screen.getByRole('button', { name: 'Consultar composição' }),
  );
  await waitFor(() => expect(gateway.context).toHaveBeenCalledTimes(2));
  await screen.findByLabelText('Quantidade de cômodos');
  await user.click(screen.getByRole('button', { name: 'Publicar ficha' }));
  await waitFor(() => expect(publish).toHaveBeenCalledOnce());
  expect(publish.mock.calls[0]?.[1]).toMatchObject({
    expectedFamilyRevision: 3,
    expectedPreviousVersionId: null,
    memberRevisions: [],
    blocks: { housing: { roomCount: null } },
    members: [],
  });
});

it('opens a published version from a readable list and marks the selected version', async () => {
  const form = {
    id: 'form',
    version: 2,
    occurredAt: '2026-10-01T12:00:00Z',
    recordedAt: '2026-10-02T12:00:00Z',
    familySnapshot: { referenceName: 'Família sintética', code: '1' },
    blocks: {
      housing: { roomCount: 3 },
      situation: {
        observations: [
          { occurredOn: '2026-10-01', description: 'Observação sintética' },
        ],
      },
    },
    members: [
      {
        id: 'member',
        personSnapshot: { name: 'Membro sintético', birthDate: '2000-01-02' },
        relationshipSnapshot: { isReference: true },
        sizeSnapshot: null,
        blocks: { economy: { incomeAmount: '1234.50' } },
      },
    ],
    acknowledgement: { acknowledgedOn: '2026-10-02' },
  };
  const get = vi.fn().mockResolvedValue(form);
  const gateway = {
    list: vi.fn().mockResolvedValue({
      data: [form],
      pagination: { page: 1, pageSize: 20, total: 1 },
    }),
    get,
  } as unknown as HttpSocialForms;
  render(
    <MemoryRouter initialEntries={['/families/family/social-forms']}>
      <Routes>
        <Route
          path="/families/:id/social-forms"
          element={<FamilySocialFormsPage gateway={gateway} canWrite={false} />}
        />
      </Routes>
    </MemoryRouter>,
  );
  const versions = await screen.findByRole('list', {
    name: 'Versões publicadas',
  });
  const row = within(versions).getByRole('button', { name: /Versão 2/ });
  expect(row.getAttribute('aria-pressed')).toBe('false');
  await userEvent.setup().click(row);
  expect(
    await screen.findByRole('heading', { name: 'Ficha social — versão 2' }),
  ).toBeTruthy();
  expect(get).toHaveBeenCalledWith('form');
  expect(row.getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByText('01/10/2026: Observação sintética')).toBeTruthy();
  expect(screen.getByText('Ciência em papel: 02/10/2026')).toBeTruthy();
  const member = screen
    .getByText('Membro sintético · Titular')
    .closest('details')!;
  expect(member.open).toBe(false);
  await userEvent.setup().click(screen.getByText('Membro sintético · Titular'));
  expect(screen.getByText(/Nascimento: 02\/01\/2000/)).toBeTruthy();
  expect(screen.getByText('R$ 1.234,50')).toBeTruthy();
});
it('loads the full management selection and never enables decisions by opening configuration', async () => {
  const { SocialConfigurationPage } =
    await import('../../../../src/social-forms');
  const configuration = vi
    .fn()
    .mockResolvedValue({ selection: null, options: [], decisions: [] });
  const decideFeature = vi.fn();
  const gateway = {
    configuration,
    decideFeature,
  } as unknown as HttpSocialForms;
  render(
    <MemoryRouter>
      <SocialConfigurationPage gateway={gateway} />
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'Decisões de habilitação' });
  expect(configuration).toHaveBeenCalledOnce();
  expect(decideFeature).not.toHaveBeenCalled();
  expect((screen.getByLabelText('Saúde') as HTMLSelectElement).value).toBe('');
});
it('sends individual blocks at the public member boundary and preserves explicit false and medication information', async () => {
  const personId = '00000000-0000-4000-8000-000000000002';
  const fields = [
    'members[].education.attendsSchool',
    'members[].medications',
  ].map((fieldKey) => ({
    fieldKey,
    included: true,
    required: false,
    appliesTo: fieldKey.endsWith('medications')
      ? 'REFERENCE_MEMBER'
      : 'ALL_MEMBERS',
    cardinality: fieldKey.endsWith('medications') ? 'MULTIPLE' : 'SINGLE',
  }));
  const context = {
    occurredAt: '2026-10-05T12:00:00Z',
    family: { id: 'family' },
    expectedFamilyRevision: 3,
    expectedPreviousVersionId: null,
    fieldSelectionVersionId: '00000000-0000-4000-8000-000000000004',
    referencePersonId: personId,
    memberRevisions: [],
    members: [{ person: { id: personId, name: 'Synthetic member' } }],
    fieldSelection: { id: 'selection', version: 1, fields },
    options: [],
  };
  const publish = vi.fn().mockResolvedValue({ id: 'saved' });
  const gateway = {
    list: vi.fn().mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 20, total: 0 },
    }),
    prepareTemplate: vi.fn().mockResolvedValue({}),
    context: vi.fn().mockResolvedValue(context),
    publish,
  } as unknown as HttpSocialForms;
  render(
    <MemoryRouter initialEntries={['/families/family/social-forms']}>
      <Routes>
        <Route
          path="/families/:id/social-forms"
          element={<FamilySocialFormsPage gateway={gateway} canWrite />}
        />
      </Routes>
    </MemoryRouter>,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Nova versão' }));
  await user.click(
    screen.getByRole('button', { name: 'Consultar composição' }),
  );
  await user.selectOptions(
    await screen.findByLabelText('Frequenta a escola'),
    'false',
  );
  await user.click(screen.getByLabelText('Medicamentos conhecidos'));
  await user.click(
    screen.getByRole('button', { name: 'Adicionar medicamento' }),
  );
  await user.type(
    screen.getByLabelText(/^Nome do medicamento 1/),
    'Synthetic medicine',
  );
  await user.selectOptions(
    screen.getByLabelText('Fornecido pelo governo — medicamento 1'),
    'false',
  );
  await user.click(screen.getByRole('button', { name: 'Publicar ficha' }));
  await waitFor(() => expect(publish).toHaveBeenCalledOnce());
  expect(publish.mock.calls[0]?.[1].members).toEqual([
    {
      personId,
      selectedFieldKeys: [],
      education: { attendsSchool: false },
      medications: [
        { medicationName: 'Synthetic medicine', providedByGovernment: false },
      ],
    },
  ]);
});
