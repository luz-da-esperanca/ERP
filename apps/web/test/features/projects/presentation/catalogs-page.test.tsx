// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { CatalogsPage } from '../../../../src/projects';
import type { HttpProjects } from '../../../../src/projects';
afterEach(cleanup);
it('edits a fixed institute without creating another institute or removing its history', async () => {
  const updateInstitute = vi.fn().mockResolvedValue({});
  const gateway = {
    overview: vi
      .fn()
      .mockResolvedValue({
        institutes: [
          {
            id: 'institute',
            code: 'SYNTHETIC',
            name: 'Synthetic Institute',
            active: true,
            revision: 4,
          },
        ],
        serviceTypes: [],
        projects: [],
        activities: [],
      }),
    updateInstitute,
  } as unknown as HttpProjects;
  render(<CatalogsPage gateway={gateway} />);
  const user = userEvent.setup();
  await user.type(
    await screen.findByLabelText(/^Motivo da alteração/),
    'Synthetic catalog correction',
  );
  await user.click(screen.getByRole('button', { name: 'Salvar instituto' }));
  await waitFor(() => expect(updateInstitute).toHaveBeenCalledOnce());
  expect(updateInstitute.mock.calls[0]?.[1]).toEqual({
    expectedRevision: 4,
    name: 'Synthetic Institute',
    active: true,
    reason: 'Synthetic catalog correction',
  });
});
