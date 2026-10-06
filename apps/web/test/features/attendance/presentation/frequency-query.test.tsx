// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { FrequencyQuery } from '../../../../src/attendance';
import { HttpAttendance } from '../../../../src/attendance';
import { HttpProjects } from '../../../../src/projects';
import { ApiClient } from '../../../../src/shared/api-client';
import { id, personId, session } from '../../../support/attendance-fixtures';

afterEach(cleanup);
it('shows known counts, unknown percentage, unrecorded opportunities and invalidated coverage from the API', async () => {
  const user = userEvent.setup();
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (path) => {
    if (String(path).includes('/people?'))
      return Response.json({
        data: [
          { id: personId, name: 'Ana Sintética', family: { id, code: '1' } },
        ],
        pagination: { page: 1, pageSize: 100, total: 1 },
      });
    if (String(path).includes('/coverage?'))
      return Response.json({
        data: {
          activityId: id,
          periodStart: '2026-01-01',
          periodEndExclusive: '2026-02-01',
          expectedActivityRevision: 1,
          sourceFingerprint: 'a'.repeat(64),
          sourceVersions: [],
          declarations: [
            {
              id,
              activityId: id,
              periodStart: '2026-01-01',
              periodEndExclusive: '2026-02-01',
              declaredBy: id,
              declaredAt: session.recordedAt,
              sourceVersions: [],
              revision: 2,
              invalidatedPeriods: [
                {
                  from: '2026-01-02',
                  toExclusive: '2026-01-03',
                  recordedAt: session.recordedAt,
                  recordedBy: id,
                  reason: 'Correção sintética',
                },
              ],
            },
          ],
          confirmedPeriods: [],
          gaps: [{ from: '2026-01-02', toExclusive: '2026-01-03' }],
          isComplete: false,
        },
      });
    return Response.json({
      data: {
        personId,
        activityId: id,
        from: '2026-01-01T03:00:00.000Z',
        toExclusive: '2026-02-01T03:00:00.000Z',
        familyId: null,
        denominator: 'ENROLLMENT_OR_RECORDED',
        sessionCount: 2,
        presenceCount: 1,
        absenceCount: 0,
        unrecordedCount: 1,
        attendanceRate: null,
        markingsComplete: false,
        coverageComplete: false,
        contextComplete: true,
        isComplete: false,
        opportunities: [
          {
            personId,
            sessionId: id,
            occurredAt: session.occurredAt,
            familyId: id,
            membershipId: id,
            membershipRevision: 1,
            relevance: 'ENROLLMENT',
            attendance: null,
            sessionRevision: 1,
            enrollmentRevisions: [],
            contextResolved: true,
          },
        ],
        unresolvedOpportunities: [],
        coverageRevisions: [],
      },
    });
  });
  const api = new ApiClient(fetcher);
  render(
    <MemoryRouter>
      <FrequencyQuery
        gateway={new HttpAttendance(api)}
        projects={new HttpProjects(api)}
        activityId={id}
      />
    </MemoryRouter>,
  );
  expect(fetcher).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText('Buscar pessoa'), 'Ana');
  await user.click(screen.getByRole('button', { name: 'Buscar' }));
  await screen.findByRole('option', { name: /Ana Sintética/ });
  await user.selectOptions(screen.getByLabelText(/^Participante/), personId);
  fireEvent.change(screen.getByLabelText(/^Início do período/), {
    target: { value: '2026-01-01' },
  });
  fireEvent.change(screen.getByLabelText(/^Fim exclusivo do período/), {
    target: { value: '2026-02-01' },
  });
  await user.click(
    screen.getByRole('button', { name: 'Consultar frequência' }),
  );
  expect(await screen.findByText('Percentual: desconhecido')).toBeTruthy();
  expect(screen.getByText('Ausências: 0')).toBeTruthy();
  expect(screen.getByText('Não registrados: 1')).toBeTruthy();
  expect(
    within(
      screen.getByRole('table', { name: 'Encontros considerados' }),
    ).getByText('Não registrado'),
  ).toBeTruthy();
  expect(await screen.findByText('Correção sintética')).toBeTruthy();
  expect(screen.queryByText(/0%/)).toBeNull();
  const request = fetcher.mock.calls.find((call) =>
    String(call[0]).includes('/frequency?'),
  );
  const url = new URL(String(request?.[0]), 'http://localhost');
  expect(url.searchParams.get('from')).toBe('2026-01-01T03:00:00.000Z');
  expect(url.searchParams.get('toExclusive')).toBe('2026-02-01T03:00:00.000Z');
});

it('blocks a query without a selected person even while the lookup is unavailable', async () => {
  const fetcher = vi.fn<typeof fetch>();
  const api = new ApiClient(fetcher);
  render(
    <MemoryRouter>
      <FrequencyQuery
        gateway={new HttpAttendance(api)}
        projects={new HttpProjects(api)}
        activityId={id}
      />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText(/^Início do período/), {
    target: { value: '2026-01-01' },
  });
  fireEvent.change(screen.getByLabelText(/^Fim exclusivo do período/), {
    target: { value: '2026-02-01' },
  });
  fireEvent.submit(
    screen
      .getByRole('button', { name: 'Consultar frequência' })
      .closest('form')!,
  );
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    'Selecione uma pessoa para consultar a frequência.',
  );
  expect(fetcher).not.toHaveBeenCalled();
});
