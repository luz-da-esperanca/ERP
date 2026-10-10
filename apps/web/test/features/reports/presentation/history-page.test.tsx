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
import userEvent from '@testing-library/user-event';
import { HistoryPage, type HttpReports } from '../../../../src/reports';
import type { HistoryEventDto } from '@erp/contracts/reports-api';
afterEach(cleanup);
it('queries family facts using the captured filters and links the saved assessment', async () => {
  const familyHistory = vi.fn().mockResolvedValue({
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
  await screen.findByRole('heading', { name: 'Avaliação de aptidão' });
  expect(screen.getByText('01/09/2026, 09:00')).toBeTruthy();
  const technical = screen
    .getByText('Detalhes do registro')
    .closest('details')!;
  expect(technical.open).toBe(false);
  expect(
    screen
      .getByRole('link', { name: 'Consultar avaliação registrada' })
      .getAttribute('href'),
  ).toBe('/eligibility-assessments/assessment');
  fireEvent.change(screen.getByLabelText('Início do período'), {
    target: { value: '2026-09-01' },
  });
  fireEvent.change(screen.getByLabelText('Fim do período'), {
    target: { value: '2026-09-30' },
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
  const user = userEvent.setup();
  await user.click(screen.getByText('Tipos de registros'));
  await user.click(screen.getByRole('checkbox', { name: 'Frequência' }));
  await user.click(screen.getByRole('checkbox', { name: 'Ficha social' }));
  await user.click(screen.getByRole('button', { name: 'Consultar histórico' }));
  await waitFor(() =>
    expect(familyHistory).toHaveBeenLastCalledWith('family', {
      order: 'desc',
      page: 1,
      from: '2026-09-01',
      toExclusive: '2026-10-01',
      eventTypes: 'ATTENDANCE,SOCIAL_FORM',
    }),
  );
});

it('identifies canceled and corrected facts while keeping their origin available', async () => {
  const record: HistoryEventDto = {
    type: 'ATTENDANCE',
    occurredAt: '2026-09-01T12:00:00Z',
    recordedAt: null,
    referenceDate: null,
    sourceType: 'Attendance',
    sourceId: 'attendance',
    personId: 'person',
    familyId: 'family',
    activityId: 'activity',
    valid: false,
    invalidReason: 'SESSION_CANCELED',
    details: { reason: 'Synthetic reason' },
  };
  const gateway = {
    familyHistory: vi.fn().mockResolvedValue({
      data: [
        record,
        { ...record, sourceId: 'correction', invalidReason: 'SUPERSEDED' },
      ],
      pagination: { page: 1, pageSize: 20, total: 2 },
    }),
  } as unknown as HttpReports;
  render(
    <MemoryRouter initialEntries={['/families/family/history']}>
      <Routes>
        <Route
          path="/families/:id/history"
          element={<HistoryPage gateway={gateway} />}
        />
      </Routes>
    </MemoryRouter>,
  );
  expect(await screen.findByText('Encontro cancelado')).toBeTruthy();
  expect(screen.getByText('Registro corrigido')).toBeTruthy();
  const summaries = screen.getAllByText('Detalhes do registro');
  expect(summaries.every((summary) => !summary.closest('details')!.open)).toBe(
    true,
  );
  await userEvent.setup().click(summaries[0]!);
  expect(screen.getByText('attendance')).toBeTruthy();
  expect(screen.getAllByText('Não informada')).toHaveLength(2);
  expect(
    screen
      .getAllByRole('link', { name: 'Consultar atividade' })[0]!
      .getAttribute('href'),
  ).toBe('/activities/activity');
});
