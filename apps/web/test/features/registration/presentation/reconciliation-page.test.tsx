// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { ReconciliationPage } from '../../../../src/registration';
import type {
  HttpComposition,
  HttpRegistration,
} from '../../../../src/registration';
import type { HttpAttendance } from '../../../../src/attendance';
afterEach(cleanup);
it('requires a preview and explicit review before confirming the exact plan and source fingerprint', async () => {
  const personId = '00000000-0000-4000-8000-000000000001';
  const familyId = '00000000-0000-4000-8000-000000000002';
  const membershipId = '00000000-0000-4000-8000-000000000003';
  const membership = {
    id: membershipId,
    personId,
    familyId,
    revision: 4,
    validFrom: '2026-01-01T00:00:00Z',
    validUntil: null,
    isReference: false,
    relationshipToReference: null,
  };
  const preview = vi.fn().mockResolvedValue({
    sourceFingerprint: 'a'.repeat(64),
    sourceVersions: [],
    conflicts: [],
    affectedAttendanceIds: [],
    proposedMemberships: [membership],
  });
  const reconcile = vi.fn().mockResolvedValue({});
  const gateway = {
    person: vi.fn().mockResolvedValue({
      person: { id: personId, name: 'Synthetic', revision: 2 },
      memberships: [membership],
    }),
    preview,
    reconcile,
  } as unknown as HttpComposition;
  const registration = {
    getFamily: vi.fn().mockResolvedValue({
      family: { id: familyId, code: '1', revision: 3 },
      members: [],
    }),
  } as unknown as HttpRegistration;
  render(
    <MemoryRouter initialEntries={[`/people/${personId}/reconciliation`]}>
      <Routes>
        <Route
          path="people/:id/reconciliation"
          element={
            <ReconciliationPage
              gateway={gateway}
              registration={registration}
              attendance={{} as HttpAttendance}
              canCorrectAttendance={false}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  const user = userEvent.setup();
  await user.type(
    await screen.findByLabelText(/^Motivo da reconciliação/),
    'Synthetic historical correction',
  );
  await user.click(
    screen.getByRole('button', { name: 'Conferir plano de reconciliação' }),
  );
  await screen.findByText('Plano conferido.');
  expect(reconcile).not.toHaveBeenCalled();
  await user.click(screen.getByLabelText(/^Conferi os vínculos/));
  await user.click(
    screen.getByRole('button', { name: 'Confirmar reconciliação' }),
  );
  await waitFor(() => expect(reconcile).toHaveBeenCalledOnce());
  expect(reconcile.mock.calls[0]?.[1]).toEqual({
    ...preview.mock.calls[0]?.[1],
    expectedSourceFingerprint: 'a'.repeat(64),
  });
});
