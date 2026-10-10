// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { SessionHistory } from '../../../../src/attendance';
import { HttpAttendance } from '../../../../src/attendance';
import { ApiClient } from '../../../../src/shared/api-client';
import { id, personId, session } from '../../../support/attendance-fixtures';

afterEach(cleanup);
it('loads authorized history on demand and shows previous status, new status, reason and authorship', async () => {
  const user = userEvent.setup();
  const attendance = {
    id: personId,
    sessionId: id,
    personId,
    familyId: id,
    membershipId: id,
    membershipRevision: 1,
    status: 'PRESENT' as const,
    recordedAt: session.recordedAt,
    recordedBy: id,
    revision: 2,
    supersededById: null,
  };
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () =>
    Response.json({
      data: [
        {
          id,
          operationId: id,
          entityType: 'Attendance',
          entityId: personId,
          revision: 2,
          action: 'CORRECT',
          actorType: 'USER',
          actorId: id,
          actor: { id, displayName: 'Operador Sintético', active: false },
          recordedAt: session.recordedAt,
          occurredAt: session.occurredAt,
          before: { ...attendance, status: 'ABSENT', revision: 1 },
          after: attendance,
          reason: 'Correção sintética',
          classification: 'ATTENDANCE',
        },
      ],
      pagination: { page: 1, pageSize: 20, total: 1 },
    }),
  );
  render(
    <SessionHistory
      gateway={new HttpAttendance(new ApiClient(fetcher))}
      sessionId={id}
      attendances={[attendance]}
      names={{ [personId]: 'Ana Sintética' }}
    />,
  );
  expect(fetcher).not.toHaveBeenCalled();
  await user.click(screen.getByText('Histórico de operações'));
  await user.selectOptions(
    screen.getByLabelText('Registro do histórico'),
    personId,
  );
  expect(await screen.findByText('Ausente → Presente')).toBeTruthy();
  expect(screen.getByText('Correção sintética')).toBeTruthy();
  expect(screen.getByText(/Operador Sintético/)).toBeTruthy();
  const request = fetcher.mock.calls.find((call) =>
    String(call[0]).includes('entityType=Attendance&'),
  );
  expect(String(request?.[0])).toContain('entityId=' + personId);
});
