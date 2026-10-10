// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { AddressFields } from '../../../../src/registration';

afterEach(cleanup);

it('looks up a complete masked postal code, fills address and neighborhood and allows manual completion', async () => {
  const user = userEvent.setup();
  const lookup = vi.fn().mockResolvedValue({
    street: 'Rua Sintética',
    neighborhood: 'Centro',
    city: 'Teresina',
    state: 'PI',
  });
  render(
    <form>
      <AddressFields lookup={lookup} />
    </form>,
  );
  const postalCode = screen.getByLabelText('CEP') as HTMLInputElement;
  await user.type(postalCode, '6400000');
  expect(lookup).not.toHaveBeenCalled();
  await user.type(postalCode, '0');
  expect(postalCode.value).toBe('64000-000');
  await waitFor(() =>
    expect((screen.getByLabelText('Endereço') as HTMLInputElement).value).toBe(
      'Rua Sintética, Teresina - PI',
    ),
  );
  expect((screen.getByLabelText('Bairro') as HTMLInputElement).value).toBe(
    'Centro',
  );
  await user.type(screen.getByLabelText('Endereço'), ', 123');
  expect((screen.getByLabelText('Endereço') as HTMLInputElement).value).toBe(
    'Rua Sintética, Teresina - PI, 123',
  );
});

it('preserves manual edits and ignores responses for a changed postal code', async () => {
  const user = userEvent.setup();
  const requests: {
    signal: AbortSignal;
    resolve: (value: {
      street: string;
      neighborhood: string;
      city: string;
      state: string;
    }) => void;
  }[] = [];
  const lookup = vi.fn(
    (_code: string, signal: AbortSignal) =>
      new Promise<{
        street: string;
        neighborhood: string;
        city: string;
        state: string;
      }>((resolve) => requests.push({ signal, resolve })),
  );
  render(
    <form>
      <AddressFields lookup={lookup} />
    </form>,
  );
  const code = screen.getByLabelText('CEP');
  await user.type(code, '64000000');
  await user.type(screen.getByLabelText('Endereço'), 'Endereço manual, 123');
  await user.type(screen.getByLabelText('Bairro'), 'Bairro manual');
  requests[0]!.resolve({
    street: 'Rua automática',
    neighborhood: 'Centro',
    city: 'Teresina',
    state: 'PI',
  });
  await screen.findByText(/Endereço localizado/);
  expect((screen.getByLabelText('Endereço') as HTMLInputElement).value).toBe(
    'Endereço manual, 123',
  );
  expect((screen.getByLabelText('Bairro') as HTMLInputElement).value).toBe(
    'Bairro manual',
  );
  await user.clear(code);
  await user.type(code, '64000001');
  await user.clear(code);
  await user.type(code, '64000002');
  expect(requests[1]!.signal.aborted).toBe(true);
  requests[2]!.resolve({
    street: 'Rua atual',
    neighborhood: 'Bairro atual',
    city: 'Teresina',
    state: 'PI',
  });
  await waitFor(() =>
    expect((screen.getByLabelText('Endereço') as HTMLInputElement).value).toBe(
      'Rua atual, Teresina - PI',
    ),
  );
  requests[1]!.resolve({
    street: 'Rua antiga',
    neighborhood: 'Bairro antigo',
    city: 'Teresina',
    state: 'PI',
  });
  await waitFor(() =>
    expect((screen.getByLabelText('Endereço') as HTMLInputElement).value).toBe(
      'Rua atual, Teresina - PI',
    ),
  );
});

it('keeps manual address entry available when the service fails or the postal code is unknown', async () => {
  const user = userEvent.setup();
  const lookup = vi
    .fn()
    .mockResolvedValueOnce(null)
    .mockRejectedValueOnce(new Error('Network failure'));
  render(
    <form>
      <AddressFields
        lookup={lookup}
        initial={{
          address: 'Endereço existente',
          neighborhood: 'Bairro existente',
        }}
      />
    </form>,
  );
  const code = screen.getByLabelText('CEP');
  await user.type(code, '99999999');
  await screen.findByText(/CEP não encontrado/);
  await user.clear(code);
  await user.type(code, '64000000');
  await screen.findByText(/Não foi possível consultar/);
  expect((screen.getByLabelText('Endereço') as HTMLInputElement).value).toBe(
    'Endereço existente',
  );
  await user.type(screen.getByLabelText('Endereço'), ', 123');
  expect((screen.getByLabelText('Endereço') as HTMLInputElement).value).toBe(
    'Endereço existente, 123',
  );
});
