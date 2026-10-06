// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { SessionCorrectionPage } from '../../../../src/attendance';
import type { HttpAttendance } from '../../../../src/attendance';
import type { HttpProjects } from '../../../../src/projects';
import { context, session, id } from '../../../support/attendance-fixtures';
afterEach(cleanup);
it('captures a fresh roster before correcting a session and preserves its original session revision', async () => {
  const freshContext = {
    ...context,
    rows: [],
    rosterFingerprint: 'b'.repeat(64),
    occurredAt: session.occurredAt,
  };
  const correctSession = vi
    .fn()
    .mockResolvedValue({ session, attendances: [] });
  const gateway = {
    detail: vi
      .fn()
      .mockResolvedValue({
        session: { ...session, revision: 4 },
        attendances: [],
        context,
      }),
    context: vi.fn().mockResolvedValue(freshContext),
    correctSession,
  } as unknown as HttpAttendance;
  const projects = {
    responsible: vi
      .fn()
      .mockResolvedValue([
        { id, displayName: 'Synthetic responsible', active: true },
      ]),
  } as unknown as HttpProjects;
  render(
    <MemoryRouter
      initialEntries={[`/activities/${id}/attendance/${id}/correction`]}
    >
      <Routes>
        <Route
          path="activities/:id/attendance/:sessionId/correction"
          element={
            <SessionCorrectionPage gateway={gateway} projects={projects} />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', {
      name: 'Conferir contexto da correção',
    }),
  );
  await screen.findByText('Contexto conferido para a nova data.');
  await user.type(
    screen.getByLabelText(/^Motivo da correção\s*\*$/),
    'Synthetic factual date correction',
  );
  await user.click(screen.getByLabelText(/^Conferi a data/));
  await user.click(
    screen.getByRole('button', { name: 'Confirmar correção do encontro' }),
  );
  await waitFor(() => expect(correctSession).toHaveBeenCalledOnce());
  expect(correctSession.mock.calls[0]?.[1]).toMatchObject({
    expectedSessionRevision: 4,
    expectedRosterFingerprint: 'b'.repeat(64),
    contextCorrections: [],
    reason: 'Synthetic factual date correction',
  });
});
