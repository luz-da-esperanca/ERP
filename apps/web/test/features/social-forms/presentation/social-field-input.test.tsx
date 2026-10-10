// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import {
  collectSocialFields,
  SocialFieldInput,
} from '../../../../src/social-forms';
import type { FieldSelectionDto } from '@erp/contracts/social-forms-api';

afterEach(cleanup);

it('collects dated observations only after an explicit Yes answer', () => {
  const field: FieldSelectionDto['fields'][number] = {
    fieldKey: 'situation.observations',
    included: true,
    required: true,
    appliesTo: 'FAMILY',
    cardinality: 'MULTIPLE',
    allowedRoleCodes: ['COORDINATION'],
    purpose: 'Synthetic form evaluation',
    decisionReference: 'FAMILY_REGISTRATION_2025',
  };
  const data = new FormData();
  const collect = () => collectSocialFields(data, [field], [], '');
  expect(collect()).toEqual({ situation: { observations: null } });
  data.set('situation.hasObservations', 'true');
  data.set('situation.observations:date:3', '2026-10-01');
  data.set('situation.observations:description:3', 'Synthetic action');
  expect(collect()).toEqual({
    situation: {
      observations: [
        { occurredOn: '2026-10-01', description: 'Synthetic action' },
      ],
    },
  });
  data.set('situation.hasObservations', 'false');
  expect(collect()).toEqual({ situation: { observations: [] } });
});

it('preserves multiple lines in the paper situation area', async () => {
  const field: FieldSelectionDto['fields'][number] = {
    fieldKey: 'situation.text',
    included: true,
    required: true,
    appliesTo: 'FAMILY',
    cardinality: 'SINGLE',
    allowedRoleCodes: ['COORDINATION'],
    purpose: 'Synthetic evaluation',
    decisionReference: 'FAMILY_REGISTRATION_2025',
  };
  const { container } = render(
    <form>
      <SocialFieldInput field={field} options={[]} prefix="" />
    </form>,
  );
  const area = screen.getByRole('textbox', { name: /^Situação familiar/ });
  expect(area.tagName).toBe('TEXTAREA');
  await userEvent.setup().type(area, 'First line{Enter}Second line');
  expect(
    collectSocialFields(
      new FormData(container.querySelector('form')!),
      [field],
      [],
      '',
    ),
  ).toEqual({ situation: { text: 'First line\nSecond line' } });
});

const requiredMedicationField: FieldSelectionDto['fields'][number] = {
  fieldKey: 'members[].medications',
  included: true,
  required: true,
  appliesTo: 'REFERENCE_MEMBER',
  cardinality: 'MULTIPLE',
  allowedRoleCodes: ['SOCIAL_ASSISTANCE', 'COORDINATION'],
  purpose: 'Synthetic form evaluation',
  decisionReference: 'SYNTHETIC',
};

it('requires an explicit medication use choice and collects no as an empty list', async () => {
  const user = userEvent.setup();
  const { container } = render(
    <form>
      <SocialFieldInput
        field={requiredMedicationField}
        options={[]}
        prefix="person:"
      />
    </form>,
  );
  const form = container.querySelector('form')!;
  const collect = () =>
    collectSocialFields(
      new FormData(form),
      [requiredMedicationField],
      [],
      'person:',
    );
  const choice = within(
    screen.getByRole('group', { name: 'Faz uso de medicamentos?' }),
  );
  const yes = choice.getByRole('radio', { name: /^Sim/ }) as HTMLInputElement;
  const no = choice.getByRole('radio', { name: /^Não/ }) as HTMLInputElement;

  expect(yes.checked).toBe(false);
  expect(no.checked).toBe(false);
  expect(form.checkValidity()).toBe(false);
  expect(collect()).toEqual({ medications: null });

  await user.click(no);

  expect(no.checked).toBe(true);
  expect(yes.checked).toBe(false);
  expect(form.checkValidity()).toBe(true);
  expect(collect()).toEqual({ medications: [] });
  expect(screen.queryByLabelText(/^Nome do medicamento/)).toBeNull();
});

it('requires a medication name and government provision choice for every declared medication', async () => {
  const user = userEvent.setup();
  const { container } = render(
    <form>
      <SocialFieldInput
        field={requiredMedicationField}
        options={[]}
        prefix="person:"
      />
    </form>,
  );
  const form = container.querySelector('form')!;
  const collect = () =>
    collectSocialFields(
      new FormData(form),
      [requiredMedicationField],
      [],
      'person:',
    );
  const choice = within(
    screen.getByRole('group', { name: 'Faz uso de medicamentos?' }),
  );

  await user.click(choice.getByRole('radio', { name: /^Sim/ }));

  expect(form.checkValidity()).toBe(false);
  await user.type(
    screen.getByLabelText(/^Nome do medicamento 1/),
    'Medicamento A',
  );
  expect(form.checkValidity()).toBe(false);
  await user.selectOptions(
    screen.getByLabelText(/^Fornecido pelo governo — medicamento 1/),
    'true',
  );
  expect(form.checkValidity()).toBe(true);
  expect(collect()).toEqual({
    medications: [
      { medicationName: 'Medicamento A', providedByGovernment: true },
    ],
  });

  await user.click(
    screen.getByRole('button', { name: 'Adicionar medicamento' }),
  );

  expect(form.checkValidity()).toBe(false);
  await user.type(
    screen.getByLabelText(/^Nome do medicamento 2/),
    'Medicamento B',
  );
  expect(form.checkValidity()).toBe(false);
  await user.selectOptions(
    screen.getByLabelText(/^Fornecido pelo governo — medicamento 2/),
    'false',
  );
  expect(form.checkValidity()).toBe(true);
  expect(collect()).toEqual({
    medications: [
      { medicationName: 'Medicamento A', providedByGovernment: true },
      { medicationName: 'Medicamento B', providedByGovernment: false },
    ],
  });

  await user.click(
    screen.getByRole('button', { name: 'Retirar medicamento 2' }),
  );
  expect(
    (
      screen.getByRole('button', {
        name: 'Retirar medicamento 1',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(collect()).toEqual({
    medications: [
      { medicationName: 'Medicamento A', providedByGovernment: true },
    ],
  });
});

it('does not submit previously entered medications when medication use changes to no', async () => {
  const user = userEvent.setup();
  const { container } = render(
    <form>
      <SocialFieldInput
        field={requiredMedicationField}
        options={[]}
        prefix="person:"
      />
    </form>,
  );
  const form = container.querySelector('form')!;
  const collect = () =>
    collectSocialFields(
      new FormData(form),
      [requiredMedicationField],
      [],
      'person:',
    );
  const choice = within(
    screen.getByRole('group', { name: 'Faz uso de medicamentos?' }),
  );

  await user.click(choice.getByRole('radio', { name: /^Sim/ }));
  await user.type(
    screen.getByLabelText(/^Nome do medicamento 1/),
    'Medicamento A',
  );
  await user.selectOptions(
    screen.getByLabelText(/^Fornecido pelo governo — medicamento 1/),
    'false',
  );
  expect(collect()).toEqual({
    medications: [
      { medicationName: 'Medicamento A', providedByGovernment: false },
    ],
  });

  await user.click(choice.getByRole('radio', { name: /^Não/ }));

  expect(form.checkValidity()).toBe(true);
  expect(collect()).toEqual({ medications: [] });
  expect(screen.queryByLabelText(/^Nome do medicamento/)).toBeNull();

  await user.click(choice.getByRole('radio', { name: /^Sim/ }));

  expect(form.checkValidity()).toBe(false);
  await user.type(
    screen.getByLabelText(/^Nome do medicamento 1/),
    'Medicamento B',
  );
  await user.selectOptions(
    screen.getByLabelText(/^Fornecido pelo governo — medicamento 1/),
    'true',
  );
  expect(collect()).toEqual({
    medications: [
      { medicationName: 'Medicamento B', providedByGovernment: true },
    ],
  });
});

it('preserves optional medication collection with explicitly known empty and unknown lists', async () => {
  const user = userEvent.setup();
  const field = { ...requiredMedicationField, required: false };
  const { container } = render(
    <form>
      <SocialFieldInput field={field} options={[]} prefix="person:" />
    </form>,
  );
  const form = container.querySelector('form')!;
  const collect = () =>
    collectSocialFields(new FormData(form), [field], [], 'person:');

  expect(form.checkValidity()).toBe(true);
  expect(collect()).toEqual({ medications: null });

  await user.click(screen.getByLabelText('Medicamentos conhecidos'));
  expect(collect()).toEqual({ medications: [] });

  await user.click(
    screen.getByRole('button', { name: 'Adicionar medicamento' }),
  );
  await user.type(
    screen.getByLabelText(/^Nome do medicamento 1/),
    'Medicamento A',
  );

  expect(form.checkValidity()).toBe(true);
  expect(collect()).toEqual({
    medications: [
      { medicationName: 'Medicamento A', providedByGovernment: null },
    ],
  });
});

it('collects a masked income as a decimal API value and preserves missing versus explicit zero', async () => {
  const user = userEvent.setup();
  const field: FieldSelectionDto['fields'][number] = {
    fieldKey: 'members[].economy.incomeAmount',
    included: true,
    required: true,
    appliesTo: 'ALL_MEMBERS',
    cardinality: 'SINGLE',
    allowedRoleCodes: ['SOCIAL_ASSISTANCE', 'COORDINATION'],
    purpose: 'Synthetic form evaluation',
    decisionReference: 'SYNTHETIC',
  };
  const { container } = render(
    <form>
      <SocialFieldInput field={field} options={[]} prefix="person:" />
    </form>,
  );
  const form = container.querySelector('form')!;
  const collect = () =>
    collectSocialFields(new FormData(form), [field], [], 'person:');
  expect(collect()).toEqual({ economy: { incomeAmount: null } });
  const income = screen.getByLabelText(/Renda declarada/);
  await user.type(income, '123456');
  expect((income as HTMLInputElement).value).toBe('1.234,56');
  expect(collect()).toEqual({ economy: { incomeAmount: '1234.56' } });
  await user.clear(income);
  await user.type(income, '0');
  expect(collect()).toEqual({ economy: { incomeAmount: '0.00' } });
});
