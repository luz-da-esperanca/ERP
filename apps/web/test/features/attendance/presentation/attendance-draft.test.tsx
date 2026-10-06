// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { AttendanceDraft, AttendanceEditor } from '../../../../src/attendance';
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
it('keeps an unrecorded draft read-only until review and retries the exact partial confirmation', async () => {
  const user = userEvent.setup();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async (path, options) => {
      if (options?.method === 'POST') throw new Error('Lost response');
      if (String(path).includes('responsible-candidates'))
        return Response.json({
          data: [{ id, displayName: 'Operador Sintético', active: true }],
          pagination: { page: 1, pageSize: 100, total: 1 },
        });
      return Response.json({ data: context });
    });
  const api = new ApiClient(fetcher);
  render(
    <AttendanceDraft
      gateway={new HttpAttendance(api)}
      projects={new HttpProjects(api)}
      activityId={id}
      responsibleId={id}
      onCompleted={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  await screen.findByRole('option', { name: 'Operador Sintético' });
  fireEvent.change(screen.getByLabelText(/^Data do encontro/), {
    target: { value: '2026-01-02T09:00' },
  });
  await user.click(screen.getByRole('button', { name: 'Preparar chamada' }));
  const choice = await screen.findByLabelText('Marcação de Ana Sintética');
  expect((choice as HTMLSelectElement).value).toBe('');
  expect(
    screen.getByLabelText('Marcação de Bruno Sintético').matches(':disabled'),
  ).toBe(true);
  expect(
    fetcher.mock.calls.every(
      (call) => !call[1]?.method || call[1]?.method === 'GET',
    ),
  ).toBe(true);
  await user.selectOptions(choice, 'PRESENT');
  await user.click(screen.getByRole('button', { name: 'Revisar chamada' }));
  expect(fetcher.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(
    false,
  );
  expect(screen.getByText('Responsável: Operador Sintético')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Confirmar encontro' }));
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button', { name: 'Repetir solicitação' }));
  const writes = fetcher.mock.calls.filter(
    (call) => call[1]?.method === 'POST',
  );
  expect(writes).toHaveLength(2);
  expect(writes[0]).toEqual(writes[1]);
  expect(JSON.parse(String(writes[0]?.[1]?.body))).toEqual({
    occurredAt: context.occurredAt,
    responsibleId: id,
    expectedActivityRevision: 3,
    expectedRosterFingerprint: context.rosterFingerprint,
    guestPersonIds: [],
    entries: [
      {
        personId,
        expectedPersonRevision: 2,
        familyId: id,
        expectedFamilyRevision: 3,
        membershipId: id,
        expectedMembershipRevision: 1,
        status: 'PRESENT',
      },
    ],
  });
});

it('corrects only the selected existing marking and preserves its original family context', async () => {
  const user = userEvent.setup();
  const attendance = {
    id: personId,
    sessionId: id,
    personId,
    familyId: id,
    membershipId: id,
    membershipRevision: 1,
    status: 'ABSENT',
    recordedAt: session.recordedAt,
    recordedBy: id,
    revision: 4,
    supersededById: null,
  };
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async (_path, options) => {
      if (options?.method === 'PUT')
        return Response.json({
          data: {
            session: { ...session, revision: 2 },
            attendances: [attendance],
          },
        });
      return Response.json({
        data: {
          ...context,
          session,
          rows: [
            {
              ...context.rows[0],
              familyId: null,
              membershipId: null,
              expectedFamilyRevision: null,
              expectedMembershipRevision: null,
              attendance,
            },
          ],
        },
      });
    });
  const api = new ApiClient(fetcher);
  const completed = vi.fn();
  const canceled = vi.fn();
  render(
    <AttendanceEditor
      gateway={new HttpAttendance(api)}
      projects={new HttpProjects(api)}
      activityId={id}
      occurredAt={session.occurredAt}
      responsibleId={id}
      session={session}
      onCompleted={completed}
      onCancel={canceled}
    />,
  );
  await user.selectOptions(
    await screen.findByLabelText('Marcação de Ana Sintética'),
    'PRESENT',
  );
  await user.click(screen.getByRole('button', { name: 'Revisar chamada' }));
  const confirm = screen.getByRole('button', { name: 'Confirmar correção' });
  await user.click(confirm);
  expect(fetcher.mock.calls.some((call) => call[1]?.method === 'PUT')).toBe(
    false,
  );
  await user.type(
    screen.getByLabelText(/^Motivo da correção/),
    'Correção sintética',
  );
  await user.click(confirm);
  expect(completed).toHaveBeenCalledWith(
    expect.objectContaining({ revision: 2 }),
  );
  expect(canceled).not.toHaveBeenCalled();
  const write = fetcher.mock.calls.find((call) => call[1]?.method === 'PUT');
  expect(JSON.parse(String(write?.[1]?.body))).toEqual({
    expectedSessionRevision: 1,
    expectedRosterFingerprint: context.rosterFingerprint,
    guestPersonIds: [],
    reason: 'Correção sintética',
    entries: [{ personId, expectedRevision: 4, status: 'PRESENT' }],
  });
});

it('requires a new preview and explicit review after a roster conflict', async () => {
  const user = userEvent.setup();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async (_path, options) => {
      if (options?.method === 'PUT')
        return Response.json(
          {
            error: {
              code: 'DOMAIN_CONFLICT',
              requestId: 'test',
              details: { rule: 'ROSTER_CHANGED' },
            },
          },
          { status: 409 },
        );
      return Response.json({ data: { ...context, session } });
    });
  const api = new ApiClient(fetcher);
  render(
    <AttendanceEditor
      gateway={new HttpAttendance(api)}
      projects={new HttpProjects(api)}
      activityId={id}
      occurredAt={session.occurredAt}
      responsibleId={id}
      session={session}
      onCompleted={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  await user.selectOptions(
    await screen.findByLabelText('Marcação de Ana Sintética'),
    'PRESENT',
  );
  await user.click(screen.getByRole('button', { name: 'Revisar chamada' }));
  await user.type(
    screen.getByLabelText(/^Motivo da correção/),
    'Correção sintética',
  );
  await user.click(screen.getByRole('button', { name: 'Confirmar correção' }));
  await screen.findByRole('alert');
  expect(
    screen.queryByRole('button', { name: 'Confirmar correção' }),
  ).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Atualizar e revisar' }));
  expect(
    await screen.findByLabelText('Marcação de Ana Sintética'),
  ).toBeTruthy();
  expect(
    fetcher.mock.calls.filter((call) => call[1]?.method === 'GET'),
  ).toHaveLength(2);
  expect(
    fetcher.mock.calls.filter((call) => call[1]?.method === 'PUT'),
  ).toHaveLength(1);
});

it('renews the server preview for a guest and submits the first marking without creating an enrollment', async () => {
  const user = userEvent.setup();
  const guestId = '00000000-0000-4000-8000-000000000009';
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async (path, options) => {
      const url = String(path);
      if (options?.method === 'PUT')
        return Response.json({
          data: { session: { ...session, revision: 2 }, attendances: [] },
        });
      if (url.includes('/people?'))
        return Response.json({
          data: [
            {
              id: guestId,
              name: 'Pessoa Avulsa Sintética',
              family: { id, code: '1' },
            },
          ],
          pagination: { page: 1, pageSize: 100, total: 1 },
        });
      const withGuest = url.includes('guestPersonIds=');
      return Response.json({
        data: {
          ...context,
          session,
          rosterFingerprint: (withGuest ? 'b' : 'a').repeat(64),
          rows: withGuest
            ? [
                ...context.rows,
                {
                  ...context.rows[0],
                  personId: guestId,
                  name: 'Pessoa Avulsa Sintética',
                  enrollmentIds: [],
                },
              ]
            : context.rows,
        },
      });
    });
  const api = new ApiClient(fetcher);
  render(
    <AttendanceEditor
      gateway={new HttpAttendance(api)}
      projects={new HttpProjects(api)}
      activityId={id}
      occurredAt={session.occurredAt}
      responsibleId={id}
      session={session}
      onCompleted={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  await user.click(
    await screen.findByRole('button', { name: 'Adicionar pessoa avulsa' }),
  );
  await user.type(screen.getByLabelText('Buscar pessoa'), 'Pessoa');
  await user.click(screen.getByRole('button', { name: 'Buscar' }));
  await user.selectOptions(
    await screen.findByLabelText(/^Participante/),
    guestId,
  );
  await user.click(screen.getByRole('button', { name: 'Incluir na prévia' }));
  await user.selectOptions(
    await screen.findByLabelText('Marcação de Pessoa Avulsa Sintética'),
    'PRESENT',
  );
  await user.click(screen.getByRole('button', { name: 'Revisar chamada' }));
  await user.type(
    screen.getByLabelText(/^Motivo da correção/),
    'Chamada parcial sintética',
  );
  await user.click(screen.getByRole('button', { name: 'Confirmar correção' }));
  const write = fetcher.mock.calls.find((call) => call[1]?.method === 'PUT');
  expect(JSON.parse(String(write?.[1]?.body))).toEqual({
    expectedSessionRevision: 1,
    expectedRosterFingerprint: 'b'.repeat(64),
    guestPersonIds: [guestId],
    reason: 'Chamada parcial sintética',
    entries: [
      {
        personId: guestId,
        expectedRevision: null,
        expectedPersonRevision: 2,
        familyId: id,
        expectedFamilyRevision: 3,
        membershipId: id,
        expectedMembershipRevision: 1,
        status: 'PRESENT',
      },
    ],
  });
  expect(
    fetcher.mock.calls.some((call) => String(call[0]).includes('/enrollments')),
  ).toBe(false);
});
