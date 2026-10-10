// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
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

it('presents each audit entry with a readable action and a before/after table limited to changed fields', async () => {
  const query = vi.fn().mockResolvedValue({
    data: [
      {
        id: '00000000-0000-4000-8000-000000000010',
        action: 'UPDATE',
        revision: 3,
        actor: { displayName: 'Synthetic Operator' },
        recordedAt: '2026-10-06T12:00:00.000Z',
        occurredAt: null,
        reason: 'Correção de telefone',
        before: { name: 'Maria', contactPhone: '86 90000-0000' },
        after: { name: 'Maria', contactPhone: '86 91111-1111' },
      },
    ],
    pagination: { page: 1, pageSize: 20, total: 1 },
  });
  render(
    <MemoryRouter>
      <AuditPage
        gateway={{ query } as unknown as HttpAudit}
        capabilities={['audit.read', 'accounts.manage']}
      />
    </MemoryRouter>,
  );
  const entry = await screen.findByRole('group');
  expect(entry.textContent).toContain('Alteração');
  expect(entry.textContent).not.toContain('UPDATE');
  const table = within(entry).getByRole('table');
  expect(
    within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent),
  ).toEqual(['Campo', 'Antes', 'Depois']);
  const rows = within(table).getAllByRole('row').slice(1);
  expect(rows).toHaveLength(1);
  expect(rows[0]?.textContent).toContain('Telefone');
  expect(rows[0]?.textContent).toContain('86 90000-0000');
  expect(rows[0]?.textContent).toContain('86 91111-1111');
  expect(table.textContent).not.toContain('Maria');
});

it('lists every field of a creation entry against an empty previous state', async () => {
  const query = vi.fn().mockResolvedValue({
    data: [
      {
        id: '00000000-0000-4000-8000-000000000011',
        action: 'CREATE',
        revision: 1,
        actor: null,
        recordedAt: '2026-10-06T12:00:00.000Z',
        occurredAt: null,
        reason: null,
        before: null,
        after: { name: 'Maria' },
      },
    ],
    pagination: { page: 1, pageSize: 20, total: 1 },
  });
  render(
    <MemoryRouter>
      <AuditPage
        gateway={{ query } as unknown as HttpAudit}
        capabilities={['audit.read', 'accounts.manage']}
      />
    </MemoryRouter>,
  );
  const entry = await screen.findByRole('group');
  expect(entry.textContent).toContain('Criação');
  const row = within(within(entry).getByRole('table')).getAllByRole('row')[1];
  expect(row?.textContent).toContain('Nome');
  expect(row?.textContent).toContain('Maria');
});

it('translates persistence field names into Portuguese labels in the diff table', async () => {
  const query = vi.fn().mockResolvedValue({
    data: [
      {
        id: '00000000-0000-4000-8000-000000000012',
        action: 'UPDATE',
        revision: 2,
        actor: null,
        recordedAt: '2026-10-06T12:00:00.000Z',
        occurredAt: null,
        reason: null,
        before: {
          displayName: 'Maria',
          mustChangePassword: true,
          roleCodes: ['COORDINATION'],
          validFrom: '2026-01-01',
          referencePersonId: null,
        },
        after: {
          displayName: 'Maria S.',
          mustChangePassword: false,
          roleCodes: ['ADMINISTRATOR'],
          validFrom: '2026-02-01',
          referencePersonId: null,
        },
      },
    ],
    pagination: { page: 1, pageSize: 20, total: 1 },
  });
  render(
    <MemoryRouter>
      <AuditPage
        gateway={{ query } as unknown as HttpAudit}
        capabilities={['audit.read', 'accounts.manage']}
      />
    </MemoryRouter>,
  );
  const table = within(await screen.findByRole('group')).getByRole('table');
  const fields = within(table)
    .getAllByRole('rowheader')
    .map((cell) => cell.textContent);
  expect(fields).toEqual([
    'Nome de exibição',
    'Troca de senha obrigatória',
    'Perfis',
    'Início da vigência',
  ]);
});
