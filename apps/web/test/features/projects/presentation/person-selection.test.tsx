// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { PersonSelection } from '../../../../src/projects';
import type { HttpProjects } from '../../../../src/projects';

afterEach(cleanup);

const people = [
  { id: 'person-1', name: 'Maria Souza', family: { id: 'f1', code: '12' } },
  { id: 'person-2', name: 'Mario Lima', birthDate: '2010-03-04' },
];

function setup(result: unknown[] = people) {
  const search = vi.fn().mockResolvedValue(result);
  const submitted = vi.fn();
  render(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submitted(new FormData(event.currentTarget).get('personId'));
      }}
    >
      <PersonSelection
        gateway={{ people: search } as unknown as HttpProjects}
      />
      <button>Enviar</button>
    </form>,
  );
  return { search, submitted, user: userEvent.setup() };
}

it('lists matches while typing, without a separate search step', async () => {
  const { search, user } = setup();
  await user.type(
    screen.getByRole('combobox', { name: /^Participante/ }),
    'Mar',
  );
  expect(
    await screen.findByRole('option', { name: /Maria Souza · Família 12/ }),
  ).toBeTruthy();
  expect(
    screen.getByRole('option', {
      name: /Mario Lima · Nascimento 04\/03\/2010/,
    }),
  ).toBeTruthy();
  // Debounced: keystrokes collapse into one request for the final text.
  expect(search).toHaveBeenCalledTimes(1);
  expect(search).toHaveBeenCalledWith('Mar');
});

it('does not query before two characters are typed', async () => {
  const { search, user } = setup();
  await user.type(screen.getByRole('combobox'), 'M');
  await new Promise((resolve) => setTimeout(resolve, 400));
  expect(search).not.toHaveBeenCalled();
  expect(screen.queryByRole('listbox')).toBeNull();
});

it('selects a person straight from the list and submits its id', async () => {
  const { submitted, user } = setup();
  const input = screen.getByRole('combobox');
  await user.type(input, 'Mar');
  await user.click(await screen.findByRole('option', { name: /Maria Souza/ }));
  expect((input as HTMLInputElement).value).toBe('Maria Souza');
  expect(screen.queryByRole('listbox')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Enviar' }));
  expect(submitted).toHaveBeenCalledWith('person-1');
});

it('supports keyboard selection with arrows and Enter', async () => {
  const { submitted, user } = setup();
  const input = screen.getByRole('combobox');
  await user.type(input, 'Mar');
  await screen.findByRole('option', { name: /Mario Lima/ });
  await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
  expect((input as HTMLInputElement).value).toBe('Mario Lima');
  await user.click(screen.getByRole('button', { name: 'Enviar' }));
  expect(submitted).toHaveBeenCalledWith('person-2');
});

it('requires a choice from the list and drops it when the text is edited', async () => {
  const { submitted, user } = setup();
  const input = screen.getByRole('combobox') as HTMLInputElement;
  await user.type(input, 'Mar');
  await user.click(await screen.findByRole('option', { name: /Maria Souza/ }));
  await user.type(input, 'x');
  await user.click(screen.getByRole('button', { name: 'Enviar' }));
  expect(submitted).not.toHaveBeenCalled();
  expect(input.validity.valid).toBe(false);
});

it('reports when nobody matches', async () => {
  const { user } = setup([]);
  await user.type(screen.getByRole('combobox'), 'Zz');
  await waitFor(() =>
    expect(screen.getByText('Nenhuma pessoa encontrada.')).toBeTruthy(),
  );
});
