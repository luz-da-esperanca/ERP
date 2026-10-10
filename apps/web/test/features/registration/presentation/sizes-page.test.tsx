// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { SizesPage } from '../../../../src/registration';
import type { HttpComposition } from '../../../../src/registration';
afterEach(cleanup);
it('preserves a missing size revision and does not invent an information date or a size', async () => {
  const sizes = vi.fn().mockResolvedValue({ revision: 1 });
  const gateway = {
    person: vi.fn().mockResolvedValue({
      person: { id: 'person', name: 'Synthetic' },
      sizeProfile: null,
    }),
    sizes,
  } as unknown as HttpComposition;
  render(
    <MemoryRouter initialEntries={['/people/person/sizes']}>
      <Routes>
        <Route
          path="people/:id/sizes"
          element={<SizesPage gateway={gateway} />}
        />
      </Routes>
    </MemoryRouter>,
  );
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Salvar tamanhos' }),
  );
  await waitFor(() => expect(sizes).toHaveBeenCalledOnce());
  expect(sizes.mock.calls[0]?.[1]).toEqual({
    expectedRevision: null,
    shoeSize: null,
    clothingSize: null,
    informedOn: null,
  });
});
