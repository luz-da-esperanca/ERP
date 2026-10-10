// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { FamilyRegistrationForm } from '../../../../src/social-forms';
import type { SocialFormContextDto } from '@erp/contracts/social-forms-api';
import type { HttpSocialForms } from '../../../../src/social-forms';

afterEach(cleanup);
const id = '00000000-0000-4000-8000-000000000001';
const fields = [
  'economy.receivesGovernmentBenefit',
  'economy.governmentBenefitName',
  'members[].medications',
  'situation.hasObservations',
  'situation.observations',
].map((fieldKey) => ({
  fieldKey,
  included: true,
  required: true,
  appliesTo: fieldKey.startsWith('members[]') ? 'REFERENCE_MEMBER' : 'FAMILY',
  allowedRoleCodes: ['COORDINATION', 'SOCIAL_ASSISTANCE'],
  cardinality:
    fieldKey.endsWith('medications') || fieldKey === 'situation.observations'
      ? 'MULTIPLE'
      : 'SINGLE',
  purpose: 'Synthetic evaluation',
  decisionReference: 'FAMILY_REGISTRATION_2025',
}));
const context = {
  occurredAt: '2026-10-01T12:00:00Z',
  family: {
    id,
    code: '1',
    address: 'Rua Sintética, 123',
    neighborhood: 'Centro',
    postalCode: '64000000',
    contactPhone: '8632221234',
  },
  referencePersonId: id,
  expectedFamilyRevision: 1,
  expectedPreviousVersionId: null,
  fieldSelectionVersionId: id,
  memberRevisions: [
    {
      personId: id,
      expectedPersonRevision: 1,
      membershipId: id,
      expectedMembershipRevision: 1,
      sizeProfilePersonId: null,
      expectedSizeRevision: null,
    },
  ],
  members: [
    {
      person: {
        id,
        name: 'Beneficiário sintético',
        birthDate: '1990-01-01',
        cpf: '12345678909',
        rg: 'Synthetic RG',
        sex: 'M',
        educationLevel: 'Ensino fundamental',
        occupation: 'Sem ocupação',
        revision: 1,
      },
      membership: { isReference: true, relationshipToReference: null },
      sizeProfile: null,
    },
  ],
  fieldSelection: {
    id,
    version: 1,
    decisionReference: 'FAMILY_REGISTRATION_2025',
    fields,
  },
  options: [],
  latestForm: null,
} as unknown as SocialFormContextDto;

it('shows the paper date in the application timezone across a UTC date boundary', () => {
  const { container } = render(
    <MemoryRouter>
      <FamilyRegistrationForm
        context={{ ...context, occurredAt: '2026-10-01T02:00:00Z' }}
        gateway={{ publish: vi.fn() } as unknown as HttpSocialForms}
        onSaved={() => {}}
      />
    </MemoryRouter>,
  );
  expect(
    (container.querySelector('[name="source:date"]') as HTMLInputElement).value,
  ).toBe('2026-09-30');
});

it('uses paper sections and requires benefit details only after an explicit Yes answer', async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <FamilyRegistrationForm
        context={context}
        gateway={{ publish: vi.fn() } as unknown as HttpSocialForms}
        onSaved={() => {}}
      />
    </MemoryRouter>,
  );
  for (const title of [
    'Identificação do Beneficiário',
    'Situação Domiciliar',
    'Composição Familiar e Econômica do(a) Beneficiário(a)',
    'Situação de Saúde do(a) Beneficiário(a)',
    'Situação Encontrada',
    'Posto de Saúde e Medicamentos',
    'Composição Familiar — Crianças e Adolescentes',
    'Acompanhamento',
    'Observações',
    'Assinaturas',
  ])
    expect(screen.getByRole('heading', { name: title })).toBeTruthy();
  const benefit = screen.getByRole('group', {
    name: /Recebe auxílio do governo/,
  });
  expect(screen.queryByLabelText(/Qual auxílio/)).toBeNull();
  await user.click(within(benefit).getByRole('radio', { name: /^Sim/ }));
  const detail = screen.getByLabelText(/Qual auxílio/) as HTMLInputElement;
  expect(detail.required).toBe(true);
  await user.type(detail, 'Auxílio sintético');
  await user.click(within(benefit).getByRole('radio', { name: /^Não/ }));
  expect(screen.queryByLabelText(/Qual auxílio/)).toBeNull();
});

it('publishes dated observations and explicit negative answers without stale details', async () => {
  const user = userEvent.setup();
  const publish = vi.fn().mockResolvedValue({});
  render(
    <MemoryRouter>
      <FamilyRegistrationForm
        context={context}
        gateway={{ publish } as unknown as HttpSocialForms}
        onSaved={() => {}}
      />
    </MemoryRouter>,
  );
  await user.click(
    within(screen.getByRole('group', { name: /Recebe auxílio/ })).getByRole(
      'radio',
      { name: /^Não/ },
    ),
  );
  await user.click(
    within(
      screen.getByRole('group', { name: /Faz uso de medicamentos/ }),
    ).getByRole('radio', { name: /^Não/ }),
  );
  await user.click(
    within(screen.getByRole('group', { name: /Há observações/ })).getByRole(
      'radio',
      { name: /^Sim/ },
    ),
  );
  const row = within(screen.getByRole('group', { name: 'Observação 1' }));
  await user.type(row.getByLabelText(/^Data/), '2026-10-01');
  await user.type(row.getByLabelText(/Doação/), 'Ação sintética');
  await user.click(screen.getByRole('button', { name: 'Publicar ficha' }));
  await waitFor(() => expect(publish).toHaveBeenCalledOnce());
  expect(publish.mock.calls[0]?.[1]).toMatchObject({
    blocks: {
      economy: {
        receivesGovernmentBenefit: false,
        governmentBenefitName: null,
      },
      situation: {
        hasObservations: true,
        observations: [
          { occurredOn: '2026-10-01', description: 'Ação sintética' },
        ],
      },
    },
    members: [{ personId: id, medications: [] }],
  });
});

it('identifies missing registration facts before allowing publication', () => {
  const missing = structuredClone(context);
  missing.members[0]!.person.rg = null;
  render(
    <MemoryRouter>
      <FamilyRegistrationForm
        context={missing}
        gateway={{ publish: vi.fn() } as unknown as HttpSocialForms}
        onSaved={() => {}}
      />
    </MemoryRouter>,
  );
  expect(screen.getByRole('alert').textContent).toContain('RG');
  expect(
    (
      screen.getByRole('button', {
        name: 'Publicar ficha',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});
