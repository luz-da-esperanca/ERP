// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { CpfField } from '../../../../src/registration';

afterEach(cleanup);

it('masks CPF digits while typing and preserves clearing and replacement', async () => {
  const user = userEvent.setup();
  render(<CpfField />);
  const field = screen.getByRole('textbox', {
    name: 'CPF',
  }) as HTMLInputElement;
  await user.type(field, '12345678909');
  expect(field.value).toBe('123.456.789-09');
  expect(field.getAttribute('inputmode')).toBe('numeric');
  await user.clear(field);
  expect(field.value).toBe('');
  await user.type(field, '98765432100');
  expect(field.value).toBe('987.654.321-00');
});

it('masks an existing CPF and accepts a pasted formatted value', async () => {
  const user = userEvent.setup();
  render(<CpfField defaultValue="12345678909" />);
  const field = screen.getByRole('textbox', {
    name: 'CPF',
  }) as HTMLInputElement;
  expect(field.value).toBe('123.456.789-09');
  await user.clear(field);
  await user.click(field);
  await user.paste('987.654.321-00');
  expect(field.value).toBe('987.654.321-00');
});
