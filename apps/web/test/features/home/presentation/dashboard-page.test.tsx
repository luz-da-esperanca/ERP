// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { ConnectedDashboardPage } from '../../../../src/home';
import type { HttpErpClient } from '../../../../src/app/http-erp-client';
afterEach(cleanup);
it('uses the server census total and never queries social registration for an administrator without the capability', async () => {
  const searchFamilies = vi
    .fn()
    .mockResolvedValue({
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
