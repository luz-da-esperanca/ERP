// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
  expect(screen.queryByText('Saúde física')).toBeNull();
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
    list: vi
      .fn()
      .mockResolvedValue({
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
