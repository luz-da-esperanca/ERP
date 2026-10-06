// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { CoveragePage } from '../../../../src/attendance';
import type { HttpAttendance } from '../../../../src/attendance';
afterEach(cleanup);
it('requires a conscious coverage declaration and sends the queried fingerprint without converting missing markings to absence', async () => {
  const coverage = {
    periodStart: '2026-09-01',
    periodEndExclusive: '2026-10-05',
    expectedActivityRevision: 3,
    sourceFingerprint: 'a'.repeat(64),
    isComplete: false,
    gaps: [],
    confirmedPeriods: [],
    declarations: [],
  };
  const declareCoverage = vi.fn().mockResolvedValue({});
  const gateway = {
    coverage: vi.fn().mockResolvedValue(coverage),
    declareCoverage,
  } as unknown as HttpAttendance;
  render(
    <MemoryRouter initialEntries={['/activities/activity/coverage']}>
      <Routes>
        <Route
          path="activities/:id/coverage"
          element={<CoveragePage gateway={gateway} canWrite />}
        />
      </Routes>
    </MemoryRouter>,
  );
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/^Início do período/), '2026-09-01');
  await user.type(screen.getByLabelText(/^Fim do período/), '2026-10-05');
  await user.click(screen.getByRole('button', { name: 'Consultar cobertura' }));
  await screen.findByText('Cobertura incompleta');
  expect(declareCoverage).not.toHaveBeenCalled();
  await user.click(screen.getByLabelText(/^Confirmo que todos os encontros/));
  await user.type(
    screen.getByLabelText(/^Motivo da declaração/),
    'Synthetic coverage verification',
  );
  await user.click(screen.getByRole('button', { name: 'Declarar cobertura' }));
  await waitFor(() => expect(declareCoverage).toHaveBeenCalledOnce());
  expect(declareCoverage.mock.calls[0]?.[1]).toEqual({
    periodStart: '2026-09-01',
    periodEndExclusive: '2026-10-05',
    expectedActivityRevision: 3,
    expectedSourceFingerprint: 'a'.repeat(64),
    confirmed: true,
    reason: 'Synthetic coverage verification',
  });
});
