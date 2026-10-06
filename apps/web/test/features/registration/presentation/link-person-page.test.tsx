// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { LinkPersonPage } from '../../../../src/registration';
import type { HttpProjects } from '../../../../src/projects';
afterEach(cleanup);
it('routes an existing person into explicit reconciliation without creating a second person', async () => {
  const people = vi
    .fn()
    .mockResolvedValue([
      { id: 'person', name: 'Synthetic person', family: null },
    ]);
  function Destination() {
    const location = useLocation();
    return (
      <p>
        {location.pathname}
        {location.search}
      </p>
    );
  }
  render(
    <MemoryRouter initialEntries={['/families/family/members/link']}>
      <Routes>
        <Route
          path="families/:id/members/link"
          element={
            <LinkPersonPage projects={{ people } as unknown as HttpProjects} />
          }
        />
        <Route path="people/:id/reconciliation" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Buscar pessoa'), 'Synthetic');
  await user.click(screen.getByRole('button', { name: 'Buscar' }));
  await user.selectOptions(
    await screen.findByLabelText(/^Pessoa cadastrada/),
    'person',
  );
  await user.click(
    screen.getByRole('button', {
      name: 'Conferir vínculos da pessoa existente',
    }),
  );
  expect(
    await screen.findByText('/people/person/reconciliation?familyId=family'),
  ).toBeTruthy();
});
