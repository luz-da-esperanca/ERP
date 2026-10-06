// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { MembershipsPage } from '../../../../src/registration';
import type {
  HttpComposition,
  HttpRegistration,
} from '../../../../src/registration';
afterEach(cleanup);
it('closes a displayed membership with both captured revisions and an explicit date and reason', async () => {
  const membership = {
    id: 'membership',
    familyId: 'family',
    personId: 'person',
    revision: 7,
    validFrom: '2026-01-01T00:00:00Z',
    validUntil: null,
    isReference: false,
    relationshipToReference: null,
  };
  const close = vi.fn().mockResolvedValue({});
  const gateway = {
    person: vi.fn().mockResolvedValue({
      person: { id: 'person', name: 'Synthetic', revision: 2 },
      memberships: [membership],
      sizeProfile: null,
    }),
    close,
  } as unknown as HttpComposition;
  const registration = {
    getFamily: vi.fn().mockResolvedValue({
      family: { id: 'family', code: '1', revision: 3 },
      members: [],
    }),
  } as unknown as HttpRegistration;
  render(
    <MemoryRouter initialEntries={['/people/person/memberships']}>
      <Routes>
        <Route
          path="people/:id/memberships"
          element={
            <MembershipsPage gateway={gateway} registration={registration} />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  const user = userEvent.setup();
  await user.selectOptions(
    await screen.findByLabelText('Operação sobre o vínculo'),
    'close',
  );
  await user.type(
    screen.getByLabelText(/^Motivo/),
    'Synthetic end of membership',
  );
  await user.click(screen.getByRole('button', { name: 'Confirmar operação' }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(close.mock.calls[0]?.[1]).toMatchObject({
    expectedRevision: 7,
    expectedFamilyRevision: 3,
    reason: 'Synthetic end of membership',
  });
  expect(close.mock.calls[0]?.[1].validUntil).toMatch(/Z$/);
});
