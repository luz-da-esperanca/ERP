// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { HistoryPage, type HttpReports } from '../../../../src/reports';
afterEach(cleanup);
it('queries family facts using the captured filters and links the saved assessment', async () => {
  const familyHistory = vi
    .fn()
    .mockResolvedValue({
      data: [
        {
          type: 'ELIGIBILITY_ASSESSMENT',
          sourceType: 'EligibilityAssessment',
          sourceId: 'assessment',
          familyId: 'family',
          occurredAt: '2026-09-01T12:00:00Z',
          recordedAt: '2026-09-02T12:00:00Z',
        },
      ],
      pagination: { page: 1, pageSize: 20, total: 1 },
    });
  render(
    <MemoryRouter initialEntries={['/families/family/history']}>
      <Routes>
        <Route
          path="/families/:id/history"
          element={
            <HistoryPage
              gateway={{ familyHistory } as unknown as HttpReports}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByText('Avaliação de aptidão', { selector: 'dd' });
  expect(
    screen
      .getByRole('link', { name: 'Consultar avaliação registrada' })
      .getAttribute('href'),
  ).toBe('/eligibility-assessments/assessment');
  fireEvent.change(screen.getByLabelText('Início do período'), {
    target: { value: '2026-09-01' },
  });
  fireEvent.change(screen.getByLabelText('Fim do período (exclusivo)'), {
    target: { value: '2026-10-01' },
  });
  fireEvent.submit(
    screen
      .getByRole('button', { name: 'Consultar histórico' })
      .closest('form')!,
  );
  await waitFor(() =>
    expect(familyHistory).toHaveBeenLastCalledWith('family', {
      order: 'desc',
      page: 1,
      from: '2026-09-01',
      toExclusive: '2026-10-01',
    }),
  );
});
