// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { ReportsPage } from '../../../../src/reports';
import type { HttpReports } from '../../../../src/reports';
import { ApiRequestError } from '../../../../src/shared/api-client';
afterEach(cleanup);
it('uses the total fingerprint for drilldown and discards both totals and details when sources change', async () => {
  const report = {
    generatedAt: '2026-10-05T12:00:00Z',
    filters: { from: '2026-09-01', toExclusive: '2026-10-06' },
    queryFingerprint: 'a'.repeat(64),
    totals: { people: 2, families: 1, sessions: 2, presences: 3 },
  };
  const gateway = {
    reach: vi.fn().mockResolvedValue(report),
    reachRecords: vi
      .fn()
      .mockRejectedValue(new ApiRequestError('REPORT_CHANGED', 409)),
  } as unknown as HttpReports;
  render(
    <MemoryRouter>
      <ReportsPage
        gateway={gateway}
        capabilities={['reports.read', 'attendance.read']}
      />
    </MemoryRouter>,
  );
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/^Início do período/), '2026-09-01');
  await user.type(screen.getByLabelText(/^Fim do período/), '2026-10-06');
  await user.click(screen.getByRole('button', { name: 'Consultar relatório' }));
  await screen.findByRole('heading', { name: 'Totais de alcance' });
  await user.click(screen.getByRole('button', { name: 'Ver pessoas' }));
  await waitFor(() => expect(gateway.reachRecords).toHaveBeenCalledOnce());
  expect(gateway.reachRecords).toHaveBeenCalledWith({
    from: '2026-09-01',
    toExclusive: '2026-10-06',
    unit: 'PERSON',
    expectedQueryFingerprint: 'a'.repeat(64),
    page: 1,
  });
  await screen.findByRole('alert');
  expect(
    screen.queryByRole('heading', { name: 'Totais de alcance' }),
  ).toBeNull();
});
it('keeps institute and project filters identical between reach totals and their contributing records', async () => {
  const reach = vi
    .fn()
    .mockResolvedValue({
      generatedAt: '2026-10-05T12:00:00Z',
      filters: {},
      queryFingerprint: 'b'.repeat(64),
      totals: {},
    });
  const reachRecords = vi
    .fn()
    .mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 20, total: 0 },
    });
  const gateway = { reach, reachRecords } as unknown as HttpReports;
  const projects = {
    overview: vi
      .fn()
      .mockResolvedValue({
        institutes: [{ id: 'institute', name: 'Synthetic Institute' }],
        projects: [{ id: 'project', name: 'Synthetic Project' }],
        activities: [],
      }),
  };
  render(
    <MemoryRouter>
      <ReportsPage
        gateway={gateway}
        capabilities={['reports.read', 'attendance.read', 'projects.read']}
        projects={projects as never}
      />
    </MemoryRouter>,
  );
  const user = userEvent.setup();
  await user.selectOptions(
    await screen.findByLabelText('Instituto'),
    'institute',
  );
  await user.selectOptions(screen.getByLabelText('Projeto'), 'project');
  await user.type(screen.getByLabelText(/^Início do período/), '2026-09-01');
  await user.type(screen.getByLabelText(/^Fim do período/), '2026-10-06');
  await user.click(screen.getByRole('button', { name: 'Consultar relatório' }));
  await screen.findByRole('heading', { name: 'Totais de alcance' });
  await user.click(screen.getByRole('button', { name: 'Ver famílias' }));
  await waitFor(() => expect(reachRecords).toHaveBeenCalledOnce());
  expect(reach.mock.calls[0]?.[0]).toMatchObject({
    instituteId: 'institute',
    projectId: 'project',
  });
  expect(reachRecords.mock.calls[0]?.[0]).toMatchObject({
    ...reach.mock.calls[0]?.[0],
    unit: 'FAMILY',
    expectedQueryFingerprint: 'b'.repeat(64),
  });
});
