// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { AuditPage } from '../../../../src/audit';
import type { HttpAudit } from '../../../../src/audit';
afterEach(cleanup);
it('limits available audit entities to the account scope of an administrator', async () => {
  const query = vi.fn().mockResolvedValue({
    data: [],
    pagination: { page: 1, pageSize: 20, total: 0 },
  });
  render(
    <MemoryRouter>
      <AuditPage
        gateway={{ query } as unknown as HttpAudit}
        capabilities={['audit.read', 'accounts.manage']}
      />
    </MemoryRouter>,
  );
  await screen.findByText('Nenhuma alteração no filtro consultado.');
  expect(query).toHaveBeenCalledWith({
    entityType: 'UserAccount',
    page: 1,
    pageSize: 20,
  });
  expect(screen.queryByRole('option', { name: 'Ficha social' })).toBeNull();
  expect(screen.queryByRole('option', { name: 'Famílias' })).toBeNull();
});

it('keeps the current audit results and reports invalid filter dates without issuing a query', async () => {
  const query = vi
    .fn()
    .mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 20, total: 0 },
    });
  render(
    <MemoryRouter>
      <AuditPage
        gateway={{ query } as unknown as HttpAudit}
        capabilities={['audit.read', 'accounts.manage']}
      />
    </MemoryRouter>,
  );
  await screen.findByText('Nenhuma alteração no filtro consultado.');
  fireEvent.change(screen.getByLabelText('Lançamentos a partir de'), {
    target: { value: '2026-10-06T12:00' },
  });
  fireEvent.change(screen.getByLabelText('Lançamentos antes de'), {
    target: { value: '2026-10-05T12:00' },
  });
  fireEvent.submit(
    screen
      .getByRole('button', { name: 'Consultar auditoria' })
      .closest('form')!,
  );
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    expect.stringContaining('Revise os campos'),
  );
  expect(query).toHaveBeenCalledTimes(1);
});
