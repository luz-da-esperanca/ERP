// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { MaskedField } from '../../src/shared/masked-field';

afterEach(cleanup);

it('formats income in reais without treating an empty input as zero', async () => {
  const user = userEvent.setup();
  render(<MaskedField mask="currency" label="Renda (R$)" name="income" />);
  const field = screen.getByLabelText('Renda (R$)') as HTMLInputElement;
  expect(field.value).toBe('');
  await user.type(field, '123456');
  expect(field.value).toBe('1.234,56');
  field.setSelectionRange(2, 3);
  await user.keyboard('8');
  expect(field.value).toBe('1.834,56');
  expect(field.selectionStart).toBe(3);
  await user.clear(field);
  await user.type(field, '0');
  expect(field.value).toBe('0,00');
  await user.clear(field);
  expect(field.value).toBe('');
  await user.click(field);
  await user.paste('R$ 9.876,54');
  expect(field.value).toBe('9.876,54');
});

it('formats a postal code and keeps the cursor when replacing a digit', async () => {
  const user = userEvent.setup();
  render(<MaskedField mask="postalCode" label="CEP" name="postalCode" />);
  const field = screen.getByLabelText('CEP') as HTMLInputElement;
  await user.type(field, '64000000');
  expect(field.value).toBe('64000-000');
  field.setSelectionRange(2, 3);
  await user.keyboard('1');
  expect(field.value).toBe('64100-000');
  expect(field.selectionStart).toBe(3);
  await user.clear(field);
  await user.click(field);
  await user.paste('64001-001');
  expect(field.value).toBe('64001-001');
});

it('formats Brazilian landline and mobile numbers while preserving clearing and paste', async () => {
  const user = userEvent.setup();
  render(<MaskedField mask="phone" label="Telefone" name="phone" />);
  const field = screen.getByLabelText('Telefone') as HTMLInputElement;
  await user.type(field, '8632221234');
  expect(field.value).toBe('(86) 3222-1234');
  await user.clear(field);
  await user.type(field, '86999991234');
  expect(field.value).toBe('(86) 99999-1234');
  await user.clear(field);
  await user.click(field);
  await user.paste('(11) 98888-4321');
  expect(field.value).toBe('(11) 98888-4321');
  await user.clear(field);
  expect(field.value).toBe('');
});
