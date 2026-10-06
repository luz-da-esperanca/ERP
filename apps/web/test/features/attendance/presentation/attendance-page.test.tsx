// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { SessionPage } from '../../../../src/attendance';
import userEvent from '@testing-library/user-event';
import { AttendancePage } from '../../../../src/attendance';
import { HttpAttendance } from '../../../../src/attendance';
import { HttpProjects } from '../../../../src/projects';
import { ApiClient } from '../../../../src/shared/api-client';
import {
  id,
  personId,
  context,
  session,
} from '../../../support/attendance-fixtures';

afterEach(cleanup);
it('lists distinct sessions on the same day without creating an encounter', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json({
      data: [
        session,
        {
          ...session,
          id: '00000000-0000-4000-8000-000000000004',
          status: 'CANCELED',
        },
      ],
      pagination: { page: 1, pageSize: 20, total: 2 },
    }),
  );
  const api = new ApiClient(fetcher);
  render(
    <MemoryRouter initialEntries={['/activities/' + id + '/attendance']}>
      <Routes>
        <Route
          path="/activities/:id/attendance"
          element={
            <AttendancePage
              gateway={new HttpAttendance(api)}
              projects={new HttpProjects(api)}
              capabilities={['attendance.read']}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  expect(
    await screen.findAllByRole('link', { name: 'Ver encontro' }),
  ).toHaveLength(2);
  expect(
    screen.getByText('Cancelado', { selector: '.status-badge' }),
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Criar encontro' })).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0]?.[1]?.method).toBe('GET');
});

it('requires a cancellation reason and retains the canceled encounter and its markings', async () => {
  const user = userEvent.setup();
  let current = session;
  const attendance = {
    id: personId,
    sessionId: id,
    personId,
    familyId: id,
    membershipId: id,
    membershipRevision: 1,
    status: 'PRESENT',
    recordedAt: session.recordedAt,
    recordedBy: id,
    revision: 1,
    supersededById: null,
  };
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async (_path, options) => {
      if (options?.method === 'POST') {
        current = { ...current, status: 'CANCELED', revision: 2 };
        return Response.json({
          data: { session: current, attendances: [attendance] },
        });
      }
      return Response.json({
        data: {
          session: current,
          attendances: [attendance],
          context: {
            ...context,
            session: current,
            rows: [{ ...context.rows[0], attendance }],
          },
        },
      });
    });
  const api = new ApiClient(fetcher);
  render(
    <MemoryRouter initialEntries={['/activities/' + id + '/attendance/' + id]}>
      <Routes>
        <Route
          path="/activities/:id/attendance/:sessionId"
          element={
            <SessionPage
              gateway={new HttpAttendance(api)}
              projects={new HttpProjects(api)}
              capabilities={['attendance.read', 'attendance.write']}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  await user.click(
    await screen.findByRole('button', { name: 'Cancelar encontro' }),
  );
  await user.click(
    screen.getByRole('button', { name: 'Confirmar cancelamento' }),
  );
  expect(fetcher.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(
    false,
  );
  await user.type(
    screen.getByLabelText(/^Motivo do cancelamento/),
    'Lançamento duplicado sintético',
  );
  await user.click(
    screen.getByRole('button', { name: 'Confirmar cancelamento' }),
  );
  expect(
    await screen.findByText('Cancelado', { selector: '.status-badge' }),
  ).toBeTruthy();
  expect(screen.getByText('Presente')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Corrigir chamada' })).toBeNull();
  expect(
    screen.queryByRole('button', { name: 'Cancelar encontro' }),
  ).toBeNull();
  expect(
    fetcher.mock.calls.some((call) =>
      String(call[0]).includes('audit-entries'),
    ),
  ).toBe(false);
  const write = fetcher.mock.calls.find((call) => call[1]?.method === 'POST');
  expect(JSON.parse(String(write?.[1]?.body))).toEqual({
    expectedSessionRevision: 1,
    reason: 'Lançamento duplicado sintético',
  });
});

it.each([AttendancePage, SessionPage])(
  'does not request attendance data when the profile lacks read access',
  async (Component) => {
    const fetcher = vi.fn<typeof fetch>();
    const api = new ApiClient(fetcher);
    render(
      <MemoryRouter
        initialEntries={['/activities/' + id + '/attendance/' + id]}
      >
        <Routes>
          <Route
            path="/activities/:id/attendance/:sessionId"
            element={
              <Component
                gateway={new HttpAttendance(api)}
                projects={new HttpProjects(api)}
                capabilities={[]}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(fetcher).not.toHaveBeenCalled();
  },
);
