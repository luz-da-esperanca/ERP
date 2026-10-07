// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { ConnectedDashboardPage } from '../../../../src/home';
import type { HttpErpClient } from '../../../../src/app/http-erp-client';
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('shows the prototype greeting, local date and dashboard sections', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-06T11:00:00Z'));
  const client = {
    registration: {
      searchFamilies: vi.fn().mockResolvedValue({
        data: [],
        pagination: { page: 1, pageSize: 1, total: 4 },
      }),
    },
    audit: { query: vi.fn().mockResolvedValue({ data: [] }) },
  } as unknown as HttpErpClient;
  render(
    <MemoryRouter>
      <ConnectedDashboardPage
        client={client}
        capabilities={['registration.read', 'audit.read']}
        displayName="Maria Clara"
      />
    </MemoryRouter>,
  );
  expect(
    screen.getByRole('heading', {
      name: 'Bom dia, Maria Clara. Paz e bem.',
      level: 1,
    }),
  ).toBeTruthy();
  expect(screen.getByText('terça-feira, 6 de outubro de 2026')).toBeTruthy();
  expect(
    screen.getByRole('heading', { name: 'Para hoje', level: 2 }),
  ).toBeTruthy();
  expect(
    screen.getByRole('heading', { name: 'Atividade recente', level: 2 }),
  ).toBeTruthy();
  expect(await screen.findByText('4 famílias cadastradas')).toBeTruthy();
});
it('uses the server census total and never queries social registration for an administrator without the capability', async () => {
  const searchFamilies = vi.fn().mockResolvedValue({
    data: [],
    pagination: { page: 1, pageSize: 1, total: 21 },
  });
  const client = {
    registration: { searchFamilies },
    audit: { query: vi.fn() },
  } as unknown as HttpErpClient;
  render(
    <MemoryRouter>
      <ConnectedDashboardPage
        client={client}
        capabilities={['registration.read']}
        displayName="Synthetic"
      />
    </MemoryRouter>,
  );
  expect(await screen.findByText('21 famílias cadastradas')).toBeTruthy();
  cleanup();
  searchFamilies.mockClear();
  render(
    <MemoryRouter>
      <ConnectedDashboardPage
        client={client}
        capabilities={['accounts.manage']}
        displayName="Administrator"
      />
    </MemoryRouter>,
  );
  await screen.findByText(
    'Escolha uma área no menu para consultar os dados do sistema.',
  );
  expect(searchFamilies).not.toHaveBeenCalled();
});

it('shows authorized work links in the daily panel and icons in quick actions', async () => {
  const client = {
    registration: {
      searchFamilies: vi.fn().mockResolvedValue({
        data: [],
        pagination: { page: 1, pageSize: 1, total: 21 },
      }),
    },
    audit: { query: vi.fn() },
  } as unknown as HttpErpClient;
  render(
    <MemoryRouter>
      <ConnectedDashboardPage
        client={client}
        capabilities={[
          'registration.read',
          'registration.write',
          'projects.read',
          'reports.read',
        ]}
        displayName="Synthetic"
      />
    </MemoryRouter>,
  );
  await screen.findByText('21 famílias cadastradas');
  const daily = within(
    screen.getByRole('heading', { name: 'Para hoje' }).closest('section')!,
  );
  expect(
    daily
      .getByRole('link', { name: 'Consultar famílias' })
      .getAttribute('href'),
  ).toBe('/families');
  expect(daily.queryByRole('link', { name: 'Revisar cadastros' })).toBeNull();
  expect(
    daily.getByRole('link', { name: 'Abrir projetos' }).getAttribute('href'),
  ).toBe('/projects');
  expect(
    daily.getByRole('link', { name: 'Ver relatórios' }).getAttribute('href'),
  ).toBe('/reports');
  const quickActions = within(
    screen.getByRole('navigation', { name: 'Ações rápidas' }),
  );
  expect(quickActions.getAllByRole('link')).toHaveLength(3);
  for (const link of quickActions.getAllByRole('link')) {
    expect(link.querySelector('svg')).not.toBeNull();
  }
});

it('identifies recent family changes with their action, record and author', async () => {
  const query = vi.fn().mockResolvedValue({
    data: [
      {
        id: 'audit-1',
        entityType: 'Family',
        entityId: 'family-1',
        action: 'UPDATE',
        after: { code: '1042' },
        actor: { displayName: 'Operadora sintética' },
        recordedAt: '2026-10-06T11:00:00Z',
      },
    ],
  });
  const client = {
    registration: {
      searchFamilies: vi.fn().mockResolvedValue({
        data: [],
        pagination: { page: 1, pageSize: 1, total: 4 },
      }),
    },
    audit: { query },
  } as unknown as HttpErpClient;
  render(
    <MemoryRouter>
      <ConnectedDashboardPage
        client={client}
        capabilities={['registration.read', 'audit.read']}
        displayName="Synthetic"
      />
    </MemoryRouter>,
  );
  const change = await screen.findByRole('link', {
    name: 'Cadastro atualizado — Família 1042',
  });
  expect(change.getAttribute('href')).toBe('/families/family-1');
  expect(
    screen.getByText('Operadora sintética · 06/10/2026, 08:00'),
  ).toBeTruthy();
  expect(query).toHaveBeenCalledWith({ entityType: 'Family', pageSize: 5 });
});
