// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { UsersPage } from '../../../../src/access';
import type { HttpUsers } from '../../../../src/access';
afterEach(cleanup);
it('edits explicit account roles against the displayed revision and never grants social access from an administrator checkbox', async () => {
  const account = {
    id: 'account',
    displayName: 'Synthetic Operator',
    login: 'synthetic.operator',
    roleCodes: ['ADMINISTRATOR'],
    active: true,
    mustChangePassword: false,
    revision: 4,
  };
  const update = vi.fn().mockResolvedValue(account);
  const gateway = {
    list: vi.fn().mockResolvedValue({
      data: [account],
      pagination: { page: 1, pageSize: 20, total: 1 },
    }),
    update,
  } as unknown as HttpUsers;
  render(<UsersPage gateway={gateway} />);
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Editar Synthetic Operator' }),
  );
  expect(
    (screen.getByLabelText('Coordenação') as HTMLInputElement).checked,
  ).toBe(false);
  await user.click(screen.getByLabelText('Assistência Social'));
  await user.click(screen.getByRole('button', { name: 'Salvar conta' }));
  await waitFor(() => expect(update).toHaveBeenCalledOnce());
  expect(update.mock.calls[0]?.[1]).toEqual({
    expectedRevision: 4,
    displayName: 'Synthetic Operator',
    roleCodes: ['SOCIAL_ASSISTANCE', 'ADMINISTRATOR'],
  });
  expect(update.mock.calls[0]?.[2]).toMatch(/^[\da-f-]{36}$/);
});
